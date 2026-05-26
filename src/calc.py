from __future__ import annotations

import pandas as pd


CALENDAR_DAYS_PER_YEAR = 365


def build_pair_frame(
    etf_ticker: str,
    benchmark_ticker: str,
    prices: pd.DataFrame,
    rate: pd.Series,
    leverage: float,
) -> pd.DataFrame:
    df = pd.DataFrame(
        {
            "etf_total_return_price": prices[etf_ticker],
            "benchmark_total_return_price": prices[benchmark_ticker],
        }
    ).dropna()

    rate_aligned = rate.reindex(df.index.union(rate.index)).sort_index().ffill()
    df["annual_rate"] = rate_aligned.reindex(df.index)
    df = df.dropna(subset=["annual_rate"]).sort_index()

    prev_dt = pd.Series(df.index, index=df.index).shift(1)
    df["calendar_days_elapsed"] = (
        (df.index.to_series() - prev_dt).dt.days.astype("Int64")
    )

    df["benchmark_return"] = df["benchmark_total_return_price"].pct_change()
    df["etf_return"] = df["etf_total_return_price"].pct_change()
    df["ideal_daily_leveraged_return"] = leverage * df["benchmark_return"]
    df["observed_implied_cost"] = (
        df["ideal_daily_leveraged_return"] - df["etf_return"]
    )

    cash_financing_multiple = leverage - 1
    days = df["calendar_days_elapsed"].astype("float64")
    df["financing_cost_calendar"] = (
        cash_financing_multiple * df["annual_rate"] * days / CALENDAR_DAYS_PER_YEAR
    )
    df["residual_cost_calendar"] = (
        df["observed_implied_cost"] - df["financing_cost_calendar"]
    )

    actual_path = (1 + df["etf_return"].fillna(0)).cumprod()
    perfect_path = (1 + df["ideal_daily_leveraged_return"].fillna(0)).cumprod()
    benchmark_path = (1 + df["benchmark_return"].fillna(0)).cumprod()
    naive_path = 1 + leverage * (benchmark_path - 1)

    df["actual_etf_path"] = actual_path
    df["perfect_leveraged_path"] = perfect_path
    df["benchmark_path"] = benchmark_path
    df["naive_leveraged_path"] = naive_path

    df["volatility_decay"] = perfect_path - naive_path
    df["tracking_drag_gap"] = actual_path - perfect_path
    df["actual_vs_naive_gap"] = actual_path - naive_path

    return df
