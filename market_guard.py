"""Market Guard CLI.

This tool scans major market ETFs using Investor's Business Daily style
signals (Distribution Days, Follow-Through Days, moving averages) to help
assess the current market regime.

Setup
-----
python -m venv .venv
source .venv/bin/activate
pip install yfinance pandas numpy rich typer matplotlib

Usage
-----
python market_guard.py scan
python market_guard.py scan --symbols SPY,QQQ,XLK --days 180
python market_guard.py plot --out charts
python market_guard.py plot --symbols QQQ --days 200 --out charts
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Sequence

import matplotlib

matplotlib.use("Agg")  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np
import pandas as pd
import typer
import yfinance as yf
from rich import box
from rich.console import Console
from rich.table import Table

console = Console()
app = typer.Typer(add_completion=False, no_args_is_help=True)

SPARKLINE_BARS = "▁▂▃▄▅▆▇█"


@dataclass
class SymbolSummary:
    symbol: str
    data: pd.DataFrame
    close: float
    dd_count: int
    churn_count: int
    last_ftd: Optional[pd.Timestamp]
    regime: str
    sparkline: str


def parse_symbols(symbols: str) -> List[str]:
    items = [token.strip().upper() for token in symbols.split(",")]
    return [item for item in items if item]


def _resolve_column(df: pd.DataFrame, target: str) -> Optional[str]:
    lower_target = target.lower()
    for column in df.columns:
        if isinstance(column, tuple):
            name = column[0]
        else:
            name = column
        if str(name).lower() == lower_target:
            return column
    return None


def fetch_history(symbol: str, days: int) -> pd.DataFrame:
    fetch_days = max(days + 50, 220)
    df = yf.download(
        symbol,
        period=f"{fetch_days}d",
        interval="1d",
        progress=False,
        auto_adjust=False,
        actions=False,
        threads=False,
    )
    if df.empty:
        raise RuntimeError(f"No data returned for {symbol}.")

    close_col = _resolve_column(df, "Close")
    volume_col = _resolve_column(df, "Volume")
    if close_col is None or volume_col is None:
        raise RuntimeError("Required columns Close/Volume missing.")

    adj_col = _resolve_column(df, "Adj Close")
    raw_df = df.copy()
    df = df.loc[:, [close_col, volume_col]].copy()
    df.columns = ["Close", "Volume"]

    if adj_col is not None:
        adj_series = raw_df.loc[:, adj_col]
        if isinstance(adj_series, pd.DataFrame):
            adj_series = adj_series.squeeze(axis=1)
        if not adj_series.isna().all():
            df["Close"] = adj_series

    if getattr(df.index, "tz", None) is not None:
        df = df.tz_localize(None)
    df = df.dropna(subset=["Close", "Volume"])
    return df


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_index().copy()
    df["pct_change"] = df["Close"].pct_change() * 100.0
    df["volume_up"] = df["Volume"] > df["Volume"].shift(1)
    df["dd_flag"] = (df["pct_change"] <= -0.2) & df["volume_up"]
    churn_band = df["pct_change"].abs() <= 0.2
    df["churn_flag"] = churn_band & df["volume_up"]
    for window in (21, 50, 200):
        df[f"ma{window}"] = df["Close"].rolling(window=window, min_periods=window).mean()
    df["dd_count_25"] = df["dd_flag"].rolling(window=25, min_periods=1).sum()
    df["churn_count_25"] = df["churn_flag"].rolling(window=25, min_periods=1).sum()
    df["ftd_flag"] = False
    mark_ftd(df)
    return df


def mark_ftd(df: pd.DataFrame) -> None:
    if df.empty:
        return
    closes = df["Close"].to_numpy()
    pct_change = df["pct_change"].to_numpy()
    volume_up = df["volume_up"].fillna(False).to_numpy()
    flag_col = df.columns.get_loc("ftd_flag")
    for idx in range(1, len(df)):
        pct = pct_change[idx]
        if np.isnan(pct) or pct < 1.7:
            continue
        if not volume_up[idx]:
            continue
        start = max(0, idx - 10)
        window = closes[start:idx]
        if window.size == 0:
            continue
        low_rel = int(np.argmin(window))
        low_idx = start + low_rel
        distance = idx - low_idx
        if 4 <= distance <= 10:
            df.iat[idx, flag_col] = True


def determine_regime(latest: pd.Series, dd_count: int, has_ftd: bool) -> str:
    close = latest["Close"]
    ma21 = latest.get("ma21")
    ma50 = latest.get("ma50")
    if dd_count >= 6 or (not math.isnan(ma50) and close < ma50):
        return "Correction"
    if dd_count >= 4 or (not math.isnan(ma21) and close < ma21):
        return "Under Pressure"
    if has_ftd:
        return "Uptrend"
    return "Neutral"


def build_sparkline(values: Sequence[float], length: int = 30) -> str:
    if not values:
        return ""
    window = list(values[-length:])
    if len(window) == 1:
        return SPARKLINE_BARS[0]
    minimum = min(window)
    maximum = max(window)
    if math.isclose(minimum, maximum):
        return SPARKLINE_BARS[-1] * len(window)
    scale = (len(SPARKLINE_BARS) - 1) / (maximum - minimum)
    return "".join(SPARKLINE_BARS[int((value - minimum) * scale)] for value in window)


def summarize_symbol(symbol: str, days: int) -> SymbolSummary:
    raw_history = fetch_history(symbol, days)
    enriched = compute_indicators(raw_history)
    tail_days = min(days, len(enriched))
    view = enriched.iloc[-tail_days:].copy()
    dd_count = int(enriched["dd_flag"].tail(25).sum())
    churn_count = int(enriched["churn_flag"].tail(25).sum())
    ftd_dates = enriched.index[enriched["ftd_flag"]]
    last_ftd = ftd_dates[-1] if len(ftd_dates) else None
    latest = view.iloc[-1]
    regime = determine_regime(latest, dd_count, last_ftd is not None)
    sparkline = build_sparkline(view["Close"].tolist())
    return SymbolSummary(
        symbol=symbol,
        data=view,
        close=float(latest["Close"]),
        dd_count=dd_count,
        churn_count=churn_count,
        last_ftd=last_ftd,
        regime=regime,
        sparkline=sparkline,
    )


def fmt_price(value: float) -> str:
    if value is None or np.isnan(value):
        return "—"
    return f"{value:,.2f}"


def fmt_date(date: Optional[pd.Timestamp]) -> str:
    if date is None or pd.isna(date):
        return "—"
    return date.strftime("%Y-%m-%d")


def regime_style(regime: str) -> str:
    mapping = {
        "Uptrend": "bold green",
        "Under Pressure": "bold yellow",
        "Correction": "bold red",
        "Neutral": "bold cyan",
    }
    return mapping.get(regime, "bold")


@app.command()
def scan(
    symbols: str = typer.Option(
        "SPY,QQQ",
        "--symbols",
        "-s",
        help="Comma separated list of tickers to analyze.",
    ),
    days: int = typer.Option(
        120,
        "--days",
        "-d",
        min=30,
        max=365,
        help="Number of trading days to include in the scan.",
    ),
) -> None:
    """Run a textual market scan for the requested symbols."""
    tickers = parse_symbols(symbols)
    if not tickers:
        console.print("[red]No symbols specified.[/red]")
        raise typer.Exit(code=1)
    table = Table(title="Market Guard Scan", box=box.MINIMAL_DOUBLE_HEAD)
    table.add_column("Symbol", style="bold cyan")
    table.add_column("Regime")
    table.add_column("Close", justify="right")
    table.add_column("DD (25d)", justify="center")
    table.add_column("Churn (25d)", justify="center")
    table.add_column("Last FTD", justify="center")
    table.add_column("MA21/50/200", justify="center")
    table.add_column("Sparkline", justify="left", no_wrap=True)

    for symbol in tickers:
        try:
            summary = summarize_symbol(symbol, days)
        except Exception as exc:  # pragma: no cover - defensive
            console.print(f"[red]{symbol}: {exc}[/red]")
            continue
        latest_row = summary.data.iloc[-1]
        ma21 = fmt_price(latest_row.get("ma21"))
        ma50 = fmt_price(latest_row.get("ma50"))
        ma200 = fmt_price(latest_row.get("ma200"))
        table.add_row(
            symbol,
            f"[{regime_style(summary.regime)}]{summary.regime}[/{regime_style(summary.regime)}]",
            fmt_price(summary.close),
            str(summary.dd_count),
            str(summary.churn_count),
            fmt_date(summary.last_ftd),
            f"{ma21}/{ma50}/{ma200}",
            summary.sparkline or "—",
        )
    console.print(table)


def ensure_output_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def plot_symbol(symbol: str, summary: SymbolSummary, out_dir: Path) -> Path:
    data = summary.data
    figure, axis = plt.subplots(figsize=(10, 5), dpi=120)
    axis.plot(data.index, data["Close"], label="Close", color="#1f77b4")
    if not data["ma21"].isna().all():
        axis.plot(data.index, data["ma21"], label="MA21", color="#2ca02c", linewidth=1.2)
    if not data["ma50"].isna().all():
        axis.plot(data.index, data["ma50"], label="MA50", color="#ff7f0e", linewidth=1.2)
    if not data["ma200"].isna().all():
        axis.plot(data.index, data["ma200"], label="MA200", color="#9467bd", linewidth=1.2)

    dd_points = data.index[data["dd_flag"]]
    axis.scatter(
        dd_points,
        data.loc[dd_points, "Close"],
        color="#d62728",
        marker="v",
        label="DD",
        zorder=5,
    )

    ftd_points = data.index[data["ftd_flag"]]
    for date in ftd_points:
        axis.axvline(date, color="#17becf", linestyle="--", alpha=0.6, linewidth=1.2)

    axis.set_title(f"{symbol} Market Guard")
    axis.set_ylabel("Price")
    axis.grid(True, which="major", linestyle=":", alpha=0.3)
    axis.legend()
    figure.autofmt_xdate()

    out_path = out_dir / f"{symbol}_market_guard.png"
    figure.tight_layout()
    figure.savefig(out_path, bbox_inches="tight")
    plt.close(figure)
    return out_path


@app.command()
def plot(
    symbols: str = typer.Option(
        "SPY,QQQ",
        "--symbols",
        "-s",
        help="Comma separated list of tickers to plot.",
    ),
    days: int = typer.Option(
        180,
        "--days",
        "-d",
        min=60,
        max=365,
        help="Number of trading days included in the chart.",
    ),
    out: Path = typer.Option(
        Path("charts"),
        "--out",
        "-o",
        help="Directory where charts will be saved.",
    ),
) -> None:
    """Render PNG charts containing price, moving averages, DD markers, and FTD signals."""
    tickers = parse_symbols(symbols)
    if not tickers:
        console.print("[red]No symbols specified.[/red]")
        raise typer.Exit(code=1)
    out_dir = ensure_output_dir(out)
    for symbol in tickers:
        try:
            summary = summarize_symbol(symbol, days)
        except Exception as exc:  # pragma: no cover - defensive
            console.print(f"[red]{symbol}: {exc}[/red]")
            continue
        path = plot_symbol(symbol, summary, out_dir)
        console.print(f"[green]Saved[/green] {symbol}: {path}")


if __name__ == "__main__":
    app()
