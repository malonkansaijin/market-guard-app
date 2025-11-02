from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

import pandas as pd
import yfinance as yf

from ..config import CONFIG

SPARKLINE_BARS = "▁▂▃▄▅▆▇█"


@dataclass
class WarningPayload:
    type: str
    code: str
    severity: str
    message: str
    ttl_days: Optional[int] = None
    evidence: Optional[Dict[str, Optional[float]]] = None

    def to_dict(self) -> Dict[str, object]:
        payload: Dict[str, object] = {
            "type": self.type,
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
        }
        if self.ttl_days is not None:
            payload["ttl_days"] = self.ttl_days
        if self.evidence:
            payload["evidence"] = self.evidence
        return payload


@dataclass
class DailyItem:
    date: pd.Timestamp
    open: float
    high: float
    low: float
    close: float
    volume: float
    pct: Optional[float]
    ma21: Optional[float]
    ma50: Optional[float]
    ma200: Optional[float]
    warnings_top: List[WarningPayload]
    warnings_bottom: List[WarningPayload]

    def to_dict(self) -> Dict[str, object]:
        return {
            "date": self.date.strftime("%Y-%m-%d"),
            "o": self.open,
            "h": self.high,
            "l": self.low,
            "c": self.close,
            "v": self.volume,
            "pct": self.pct,
            "ma21": self.ma21,
            "ma50": self.ma50,
            "ma200": self.ma200,
            "warnings_top": [warning.to_dict() for warning in self.warnings_top],
            "warnings_bottom": [warning.to_dict() for warning in self.warnings_bottom],
        }


@dataclass
class SymbolSummary:
    symbol: str
    last_date: str
    regime: str
    dd_25d: int
    churn_25d: int
    ftd: Dict[str, Optional[str]]
    sparkline: str
    items: List[DailyItem]

    def as_payload(self) -> Dict[str, object]:
        return {
            "symbol": self.symbol,
            "last_date": self.last_date,
            "regime": self.regime,
            "dd_25d": self.dd_25d,
            "churn_25d": self.churn_25d,
            "ftd": self.ftd,
            "sparkline": self.sparkline,
            "items": [item.to_dict() for item in self.items],
        }


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

    selected = pd.DataFrame(index=df.index)
    for column in ("Open", "High", "Low", "Close", "Adj Close", "Volume"):
        resolved = _resolve_column(df, column)
        if resolved is not None:
            selected[column] = df[resolved]

    if "Close" not in selected or "Volume" not in selected:
        raise RuntimeError("Required columns Close/Volume missing.")

    if "Adj Close" in selected and not selected["Adj Close"].isna().all():
        selected["Close"] = selected["Adj Close"]
    selected = selected.drop(columns=["Adj Close"], errors="ignore")

    if getattr(selected.index, "tz", None) is not None:
        selected = selected.tz_localize(None)
    selected = selected.dropna(subset=["Close", "Volume"])
    return selected


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_index().copy()
    df["pct_change"] = df["Close"].pct_change() * 100.0
    df["volume_up"] = df["Volume"] > df["Volume"].shift(1)
    df["dd_flag"] = (df["pct_change"] <= CONFIG.dd_drop_pct) & df["volume_up"]
    churn_band = df["pct_change"].abs() <= CONFIG.churn_range
    df["churn_flag"] = churn_band & df["volume_up"]
    for window in (21, 50, 200):
        df[f"ma{window}"] = df["Close"].rolling(window=window, min_periods=window).mean()
    df["dd_count_25"] = df["dd_flag"].rolling(window=25, min_periods=1).sum()
    df["churn_count_25"] = df["churn_flag"].rolling(window=25, min_periods=1).sum()
    return df


def determine_regime(latest: pd.Series, dd_count: int, has_ftd: bool) -> str:
    close = latest["Close"]
    ma21 = latest.get("ma21")
    ma50 = latest.get("ma50")
    if dd_count >= CONFIG.dd_cluster_high or (not math.isnan(ma50) and close < ma50):
        return "Correction"
    if dd_count >= CONFIG.dd_cluster_alert or (not math.isnan(ma21) and close < ma21):
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


def _float_or_none(value: object) -> Optional[float]:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, (float, int)):
        return float(value)
    return None


def _volume_ratio(current: float, previous: Optional[float]) -> Optional[float]:
    if previous is None or previous == 0:
        return None
    return current / previous


def _create_warning(
    w_type: str,
    code: str,
    severity: str,
    message: str,
    ttl_days: Optional[int] = None,
    evidence: Optional[Dict[str, Optional[float]]] = None,
) -> WarningPayload:
    return WarningPayload(
        type=w_type,
        code=code,
        severity=severity,
        message=message,
        ttl_days=ttl_days,
        evidence=evidence,
    )


def summarize_symbol(symbol: str, days: int) -> SymbolSummary:
    raw_history = fetch_history(symbol, days)
    enriched = compute_indicators(raw_history)
    tail_days = min(days, len(enriched))
    df = enriched.iloc[-tail_days:].copy()

    dd_25d = int(df["dd_count_25"].iloc[-1] if not df.empty else 0)
    churn_25d = int(df["churn_count_25"].iloc[-1] if not df.empty else 0)
    sparkline = build_sparkline(df["Close"].tolist())

    items: List[DailyItem] = []
    recent_low_idx = 0
    day1_idx: Optional[int] = None
    ftd_idx: Optional[int] = None
    ftd_status = {"status": "none", "date": None, "invalidated_on": None, "day1": None}
    dd_post_ftd: List[int] = []

    lows = df["Low"].to_numpy()

    for idx, (date, row) in enumerate(df.iterrows()):
        warnings_top: List[WarningPayload] = []
        warnings_bottom: List[WarningPayload] = []

        prev_row = df.iloc[idx - 1] if idx > 0 else None
        pct_change = row["pct_change"]
        volume_ratio = _volume_ratio(row["Volume"], prev_row["Volume"]) if prev_row is not None else None

        if row.get("dd_flag", False):
            evidence = {}
            if pct_change is not None and not math.isnan(pct_change):
                evidence["pct"] = round(pct_change, 2)
            if volume_ratio is not None:
                evidence["vol_ratio"] = round(volume_ratio, 2)
            warnings_top.append(
                _create_warning(
                    "top",
                    "DD",
                    "watch",
                    "Distribution Day: price fell with higher volume.",
                    ttl_days=CONFIG.dd_ttl_days,
                    evidence=evidence or None,
                )
            )

        if row.get("churn_flag", False):
            evidence = {}
            if pct_change is not None and not math.isnan(pct_change):
                evidence["pct"] = round(pct_change, 2)
            if volume_ratio is not None:
                evidence["vol_ratio"] = round(volume_ratio, 2)
            warnings_top.append(
                _create_warning(
                    "top",
                    "CHURN",
                    "info",
                    "Churn: tight price action on higher volume.",
                    ttl_days=CONFIG.dd_ttl_days,
                    evidence=evidence or None,
                )
            )

        dd_count_25 = int(row.get("dd_count_25", 0))
        churn_count_25 = int(row.get("churn_count_25", 0))
        cluster_severity = None
        if dd_count_25 >= CONFIG.dd_cluster_high:
            cluster_severity = "high"
        elif dd_count_25 >= CONFIG.dd_cluster_alert:
            cluster_severity = "alert"
            if churn_count_25 >= CONFIG.churn_cluster_boost:
                cluster_severity = "high"
        if cluster_severity:
            warnings_top.append(
                _create_warning(
                    "top",
                    "DD_CLUSTER",
                    cluster_severity,
                    f"Distribution Days in last 25 sessions: {dd_count_25}.",
                    evidence={"dd_25d": dd_count_25, "churn_25d": churn_count_25},
                )
            )

        ma21 = row.get("ma21")
        ma50 = row.get("ma50")
        if not pd.isna(ma50) and row["Close"] < ma50 and bool(row.get("volume_up", False)):
            warnings_top.append(
                _create_warning(
                    "top",
                    "MA50_BREAK",
                    "alert",
                    "Close below 50-day moving average on higher volume.",
                    evidence={"close": float(row["Close"]), "ma50": float(ma50)},
                )
            )
        elif not pd.isna(ma21) and row["Close"] < ma21:
            warnings_top.append(
                _create_warning(
                    "top",
                    "MA21_BELOW",
                    "watch",
                    "Close below 21-day moving average.",
                    evidence={"close": float(row["Close"]), "ma21": float(ma21)},
                )
            )

        if (
            idx > 0
            and not pd.isna(ma21)
            and not pd.isna(prev_row.get("ma21"))
            and row["Close"] > ma21
            and prev_row["Close"] <= prev_row["ma21"]
            and bool(row.get("volume_up", False))
        ):
            warnings_bottom.append(
                _create_warning(
                    "bottom",
                    "MA21_RECLAIM",
                    "watch",
                    "Reclaimed 21-day moving average on higher volume.",
                    evidence={"close": float(row["Close"]), "ma21": float(ma21)},
                )
            )

        current_low = _float_or_none(row["Low"])
        reference_low = _float_or_none(df.iloc[recent_low_idx]["Low"])
        if current_low is not None and (reference_low is None or current_low <= reference_low):
            recent_low_idx = idx
            if day1_idx is not None and idx > day1_idx:
                day1_low = _float_or_none(df.iloc[day1_idx]["Low"])
                if day1_low is not None and current_low < day1_low:
                    day1_idx = None

        if (
            idx > recent_low_idx
            and pct_change is not None
            and not math.isnan(pct_change)
            and pct_change > 0
            and prev_row is not None
            and row["Low"] >= prev_row["Low"]
            and row["Close"] > prev_row["Close"]
        ):
            day1_idx = idx
            ftd_status["day1"] = date.strftime("%Y-%m-%d")
            warnings_bottom.append(
                _create_warning(
                    "bottom",
                    "RALLY_DAY1",
                    "info",
                    "Rally attempt day 1: closed up without undercutting prior low.",
                    evidence={"pct": round(pct_change, 2)},
                )
            )

        if (
            day1_idx is not None
            and idx - day1_idx >= CONFIG.ftd_window_min
            and idx - day1_idx <= CONFIG.ftd_window_max
            and pct_change is not None
            and not math.isnan(pct_change)
            and pct_change >= CONFIG.ftd_gain_pct
            and bool(row.get("volume_up", False))
            and ftd_status["status"] != "active"
        ):
            ftd_idx = idx
            ftd_status["status"] = "active"
            ftd_status["date"] = date.strftime("%Y-%m-%d")
            dd_post_ftd = []
            evidence = {
                "pct": round(pct_change, 2),
                "volume_ratio": round(volume_ratio, 2) if volume_ratio is not None else None,
            }
            evidence = {key: value for key, value in evidence.items() if value is not None}
            warnings_bottom.append(
                _create_warning(
                    "bottom",
                    "FTD",
                    "alert",
                    "Follow-Through Day confirmed.",
                    evidence=evidence or None,
                )
            )

        if ftd_idx is not None and ftd_status["status"] == "active":
            if row.get("dd_flag", False):
                dd_post_ftd.append(idx)
            day1_low = lows[day1_idx] if day1_idx is not None else None
            invalidated = False
            if dd_post_ftd:
                dd_within_window = [d for d in dd_post_ftd if d - ftd_idx <= 5]
                if len(dd_within_window) >= 2:
                    invalidated = True
            if day1_low is not None and row["Low"] < day1_low:
                invalidated = True

            if invalidated:
                ftd_status["status"] = "invalidated"
                ftd_status["invalidated_on"] = date.strftime("%Y-%m-%d")
                warnings_bottom.append(
                    _create_warning(
                        "bottom",
                        "FTD_INVALID",
                        "invalidated",
                        "Follow-Through Day invalidated.",
                    )
                )
                ftd_idx = None
                day1_idx = None
                dd_post_ftd = []

        items.append(
            DailyItem(
                date=date,
                open=float(row["Open"]),
                high=float(row["High"]),
                low=float(row["Low"]),
                close=float(row["Close"]),
                volume=float(row["Volume"]),
                pct=None if pct_change is None or math.isnan(pct_change) else round(pct_change, 2),
                ma21=_float_or_none(ma21),
                ma50=_float_or_none(ma50),
                ma200=_float_or_none(row.get("ma200")),
                warnings_top=warnings_top,
                warnings_bottom=warnings_bottom,
            )
        )

    ftd_active = ftd_status["status"] == "active"
    regime = determine_regime(df.iloc[-1], dd_25d, ftd_active) if not df.empty else "Neutral"
    last_date = df.index[-1].strftime("%Y-%m-%d") if not df.empty else ""

    return SymbolSummary(
        symbol=symbol,
        last_date=last_date,
        regime=regime,
        dd_25d=dd_25d,
        churn_25d=churn_25d,
        ftd=ftd_status,
        sparkline=sparkline,
        items=items,
    )


def summarize_symbols(symbols: List[str], days: int) -> List[SymbolSummary]:
    return [summarize_symbol(symbol, days) for symbol in symbols]


def summarize_overview(summary: SymbolSummary) -> Dict[str, object]:
    latest_item = summary.items[-1] if summary.items else None
    high_priority = 0
    if latest_item is not None:
        for warning in latest_item.warnings_top + latest_item.warnings_bottom:
            if warning.severity in {"alert", "high"}:
                high_priority += 1

    return {
        "symbol": summary.symbol,
        "last_date": summary.last_date,
        "regime": summary.regime,
        "dd_25d": summary.dd_25d,
        "churn_25d": summary.churn_25d,
        "ftd": summary.ftd,
        "sparkline": summary.sparkline,
        "high_priority_warnings": high_priority,
    }
