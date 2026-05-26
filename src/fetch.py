from __future__ import annotations

import io
from datetime import date

import pandas as pd
import requests
import yfinance as yf

FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"
TAIWAN_OVERNIGHT_CSV_URL = "https://www.cbc.gov.tw/public/data/OpenData/WebF2.csv"
TWSE_TAIWAN50_CSV_URL = "https://www.twse.com.tw/indicesReport/TAI50I?response=csv&date={date}"
TWSE_STOCK_DAY_CSV_URL = "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=csv&date={date}&stockNo={stock_no}"
MANUAL_SPLITS = {
    # Yuanta Taiwan 50 Daily 2x split 1 old unit into 22 new units.
    # yfinance adjusted close currently does not carry this ETF split reliably.
    "00631L.TW": [("2026-03-31", 22.0)],
}


def _price_column(ticker: str, df: pd.DataFrame) -> str:
    if ticker.startswith("^"):
        if "Close" not in df.columns:
            raise RuntimeError(f"Close missing for index {ticker}")
        return "Close"
    if "Adj Close" not in df.columns:
        raise RuntimeError(f"Adj Close missing for ETF {ticker}")
    return "Adj Close"


def _month_starts(start_year: int, start_month: int) -> list[date]:
    today = date.today()
    out = []
    year, month = start_year, start_month
    while (year, month) <= (today.year, today.month):
        out.append(date(year, month, 1))
        month += 1
        if month == 13:
            year += 1
            month = 1
    return out


def _parse_roc_date(raw: str, month_start: date) -> pd.Timestamp | None:
    parts = str(raw).strip().replace('"', "").split("/")
    if len(parts) != 3:
        return None
    try:
        if not all(part.strip().isdigit() for part in parts):
            return None
        year = int(parts[0]) + 1911
        month = int(parts[1])
        day = int(parts[2])
        return pd.Timestamp(year=year, month=month, day=day)
    except ValueError:
        return None


def _fetch_twse_taiwan50() -> pd.Series:
    frames = []
    for month_start in _month_starts(2014, 10):
        url = TWSE_TAIWAN50_CSV_URL.format(date=month_start.strftime("%Y%m%d"))
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        text = resp.content.decode("big5", errors="ignore")
        lines = [line for line in text.splitlines() if line.strip()]
        if len(lines) < 3:
            continue
        df = pd.read_csv(io.StringIO("\n".join(lines[1:])))
        if "日期" not in df.columns or "臺灣50指數" not in df.columns:
            continue
        dates = df["日期"].map(lambda v: _parse_roc_date(v, month_start))
        values = pd.to_numeric(
            df["臺灣50指數"].astype(str).str.replace(",", "", regex=False),
            errors="coerce",
        )
        s = pd.Series(values.to_numpy(), index=dates, name="^TW50").dropna()
        frames.append(s)
    if not frames:
        raise RuntimeError("Price history missing for ^TW50")
    out = pd.concat(frames).sort_index()
    out = out[~out.index.isna()]
    out.index = pd.to_datetime(out.index).normalize()
    out = out[out.index <= pd.Timestamp.today().normalize()]
    return out.groupby(level=0).last()


def _apply_manual_splits(ticker: str, s: pd.Series) -> pd.Series:
    out = s.copy()
    for split_date, factor in MANUAL_SPLITS.get(ticker, []):
        out.loc[out.index < pd.Timestamp(split_date)] /= factor
    return out


def _fetch_twse_stock_close(ticker: str, start_year: int, start_month: int) -> pd.Series:
    stock_no = ticker.split(".")[0]
    frames = []
    for month_start in _month_starts(start_year, start_month):
        url = TWSE_STOCK_DAY_CSV_URL.format(
            date=month_start.strftime("%Y%m%d"),
            stock_no=stock_no,
        )
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        text = resp.content.decode("big5", errors="ignore")
        lines = [line for line in text.splitlines() if line.strip()]
        if len(lines) < 3:
            continue
        df = pd.read_csv(io.StringIO("\n".join(lines[1:])))
        if "日期" not in df.columns or "收盤價" not in df.columns:
            continue
        dates = df["日期"].map(lambda v: _parse_roc_date(v, month_start))
        values = pd.to_numeric(
            df["收盤價"].astype(str).str.replace(",", "", regex=False),
            errors="coerce",
        )
        s = pd.Series(values.to_numpy(), index=dates, name=ticker).dropna()
        frames.append(s)
    if not frames:
        raise RuntimeError(f"Price history missing for {ticker}")
    out = pd.concat(frames).sort_index()
    out = out[~out.index.isna()]
    out.index = pd.to_datetime(out.index).normalize()
    out = out[out.index <= pd.Timestamp.today().normalize()]
    out = out.groupby(level=0).last()
    return _apply_manual_splits(ticker, out)


def fetch_prices(tickers: list[str]) -> pd.DataFrame:
    """Pull ETF adjusted close and official index close since inception."""
    frames = []
    for t in tickers:
        if t == "^TW50":
            frames.append(_fetch_twse_taiwan50().rename(t))
            continue
        if t == "00631L.TW":
            frames.append(_fetch_twse_stock_close(t, 2014, 10).rename(t))
            continue
        df = yf.Ticker(t).history(period="max", auto_adjust=False, actions=False)
        if df.empty:
            raise RuntimeError(f"Price history missing for {t}")
        col = _price_column(t, df)
        s = df[col].dropna().rename(t)
        s.index = pd.to_datetime(s.index).tz_localize(None).normalize()
        s = s.groupby(level=0).last()
        s = _apply_manual_splits(t, s)
        frames.append(s)
    out = pd.concat(frames, axis=1)
    out.index.name = "date"
    return out


def _fred_series(series_id: str) -> pd.Series:
    url = FRED_CSV_URL.format(series=series_id)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    df.columns = [c.strip().lower() for c in df.columns]
    date_col = "observation_date" if "observation_date" in df.columns else "date"
    df = df.rename(columns={date_col: "date", series_id.lower(): "rate"})
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df["rate"] = pd.to_numeric(df["rate"], errors="coerce")
    df = df.dropna(subset=["rate"])
    s = df.set_index("date")["rate"] / 100.0
    return s.sort_index()


def fetch_rate(source: str = "SOFR_BLENDED") -> pd.Series:
    """SOFR for 2018-04-03 onward, Fed Funds (DFF) for earlier history."""
    src = source.upper()
    if src == "TWD_INTERBANK_OVERNIGHT":
        df = pd.read_csv(TAIWAN_OVERNIGHT_CSV_URL, encoding="big5")
        date_col = "日期"
        rate_col = "利率[%]"
        df["date"] = pd.to_datetime(df[date_col], errors="coerce").dt.normalize()
        df["rate"] = pd.to_numeric(df[rate_col], errors="coerce") / 100.0
        s = df.dropna(subset=["date", "rate"]).set_index("date")["rate"].sort_index()
        s = s.groupby(level=0).last()
    elif src == "SOFR":
        s = _fred_series("SOFR")
    elif src in ("FEDFUNDS", "DFF"):
        s = _fred_series("DFF")
    else:
        sofr = _fred_series("SOFR")
        dff = _fred_series("DFF")
        s = sofr.combine_first(dff)
    s.name = "annual_rate"
    return s.sort_index()
