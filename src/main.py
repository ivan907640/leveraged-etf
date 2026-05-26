from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .calc import build_pair_frame
from .fetch import fetch_prices, fetch_rate

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config.json"
OUT_DIR = ROOT / "public" / "data"
TICKERS_DIR = OUT_DIR / "tickers"


PER_DAY_FIELDS = [
    "calendar_days_elapsed",
    "annual_rate",
    "benchmark_return",
    "etf_return",
    "ideal_daily_leveraged_return",
    "observed_implied_cost",
    "financing_cost_calendar",
    "residual_cost_calendar",
    "actual_etf_path",
    "perfect_leveraged_path",
    "benchmark_path",
    "naive_leveraged_path",
    "volatility_decay",
    "tracking_drag_gap",
    "actual_vs_naive_gap",
]


def load_config() -> dict:
    with CONFIG_PATH.open() as f:
        return json.load(f)


def _clean(v):
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if isinstance(v, pd.Timestamp):
        if pd.isna(v):
            return None
        return v.date().isoformat()
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(v, "item"):
        try:
            return v.item()
        except (TypeError, ValueError):
            pass
    return v


def _row_to_record(idx: pd.Timestamp, row: pd.Series) -> dict:
    rec = {"date": idx.date().isoformat()}
    for k in PER_DAY_FIELDS:
        v = _clean(row[k]) if k in row.index else None
        if k == "calendar_days_elapsed" and v is not None:
            try:
                v = int(v)
            except (TypeError, ValueError):
                v = None
        rec[k] = v
    return rec


def _summary_for(df: pd.DataFrame) -> dict:
    last = df.iloc[-1]
    return {
        "as_of": df.index[-1].date().isoformat(),
        "inception": df.index[0].date().isoformat(),
        "rows": int(len(df)),
        "actual_etf_path": _clean(last["actual_etf_path"]),
        "perfect_leveraged_path": _clean(last["perfect_leveraged_path"]),
        "benchmark_path": _clean(last["benchmark_path"]),
        "naive_leveraged_path": _clean(last["naive_leveraged_path"]),
        "volatility_decay": _clean(last["volatility_decay"]),
        "tracking_drag_gap": _clean(last["tracking_drag_gap"]),
        "actual_vs_naive_gap": _clean(last["actual_vs_naive_gap"]),
    }


def run() -> None:
    config = load_config()
    etfs = config["etfs"]
    default_rate_source = config.get("rate_source", "SOFR_BLENDED")
    data_basis = config.get("data_basis", "adjusted_close_total_return")

    tickers = sorted({e["ticker"] for e in etfs} | {e["benchmark"] for e in etfs})

    print(f"[fetch] prices for {tickers} (period=max)")
    prices = fetch_prices(tickers)
    print(
        f"[fetch] price rows: {len(prices)} from {prices.index.min().date()} to {prices.index.max().date()}"
    )

    rate_sources = sorted({e.get("rate_source", default_rate_source) for e in etfs})
    rates = {}
    for rate_source in rate_sources:
        print(f"[fetch] rate series: {rate_source}")
        rates[rate_source] = fetch_rate(rate_source)
        rate = rates[rate_source]
        print(
            f"[fetch] rate rows: {len(rate)} from {rate.index.min().date()} to {rate.index.max().date()}"
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TICKERS_DIR.mkdir(parents=True, exist_ok=True)

    last_updated = datetime.now(timezone.utc).date().isoformat()
    summary_entries = []

    for cfg in etfs:
        ticker = cfg["ticker"]
        benchmark = cfg["benchmark"]
        benchmark_name = cfg.get("benchmark_name", benchmark)
        leverage = cfg["leverage"]
        cash_financing_multiple = leverage - 1
        rate_source = cfg.get("rate_source", default_rate_source)
        region = cfg.get("region", "global")
        region_name = cfg.get("region_name", region)
        currency = cfg.get("currency", "USD")
        currency_symbol = cfg.get("currency_symbol", "$")
        display_ticker = cfg.get("display_ticker", ticker)

        print(f"[calc] {ticker} vs {benchmark_name} ({benchmark}, lev={leverage})")
        df = build_pair_frame(ticker, benchmark, prices, rates[rate_source], leverage)
        records = [_row_to_record(idx, row) for idx, row in df.iterrows()]

        out = {
            "metadata": {
                "ticker": ticker,
                "display_ticker": display_ticker,
                "benchmark": benchmark,
                "benchmark_name": benchmark_name,
                "leverage": leverage,
                "cash_financing_multiple": cash_financing_multiple,
                "region": region,
                "region_name": region_name,
                "currency": currency,
                "currency_symbol": currency_symbol,
                "rate_source": rate_source,
                "data_basis": data_basis,
                "last_updated": last_updated,
                "inception": df.index[0].date().isoformat(),
                "as_of": df.index[-1].date().isoformat(),
                "rows": len(records),
            },
            "rows": records,
        }
        path = TICKERS_DIR / f"{ticker}.json"
        with path.open("w") as f:
            json.dump(out, f, separators=(",", ":"))
        print(f"[write] {path} ({len(records)} rows)")

        summary_entries.append(
            {
                "ticker": ticker,
                "display_ticker": display_ticker,
                "benchmark": benchmark,
                "benchmark_name": benchmark_name,
                "leverage": leverage,
                "cash_financing_multiple": cash_financing_multiple,
                "region": region,
                "region_name": region_name,
                "currency": currency,
                "currency_symbol": currency_symbol,
                "rate_source": rate_source,
                **_summary_for(df),
            }
        )

    summary_path = OUT_DIR / "summary.json"
    with summary_path.open("w") as f:
        json.dump(
            {
                "metadata": {
                    "rate_source": default_rate_source,
                    "data_basis": data_basis,
                    "last_updated": last_updated,
                },
                "tickers": summary_entries,
            },
            f,
            indent=2,
        )
    print(f"[write] {summary_path}")

    config_out_path = OUT_DIR / "config.json"
    with config_out_path.open("w") as f:
        json.dump(config, f, indent=2)
    print(f"[write] {config_out_path}")


if __name__ == "__main__":
    run()
