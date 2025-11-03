from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Tuple


def _get_env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _parse(name: str, cast, default):
    raw = _get_env(name)
    if raw is None:
        return default
    try:
        return cast(raw)
    except Exception:
        return default


def _parse_symbols(name: str, default: Tuple[str, ...]) -> Tuple[str, ...]:
    raw = _get_env(name)
    if raw is None:
        return default
    parts = [part.strip().upper() for part in raw.split(",")]
    items = tuple(part for part in parts if part)
    return items or default


@dataclass(frozen=True)
class ThresholdConfig:
    dd_ttl_days: int = 25
    dd_drop_pct: float = -0.2
    churn_range: float = 0.2
    ftd_window_min: int = 4
    ftd_window_max: int = 10
    ftd_gain_pct: float = 1.7
    dd_cluster_alert: int = 4
    dd_cluster_high: int = 6
    churn_cluster_boost: int = 2

    @classmethod
    def from_env(cls) -> "ThresholdConfig":
        return cls(
            dd_ttl_days=_parse("DD_TTL_DAYS", int, cls.dd_ttl_days),
            dd_drop_pct=_parse("DD_DROP_PCT", float, cls.dd_drop_pct),
            churn_range=_parse("CHURN_RANGE", float, cls.churn_range),
            ftd_window_min=_parse("FTD_WINDOW_MIN", int, cls.ftd_window_min),
            ftd_window_max=_parse("FTD_WINDOW_MAX", int, cls.ftd_window_max),
            ftd_gain_pct=_parse("FTD_GAIN_PCT", float, cls.ftd_gain_pct),
            dd_cluster_alert=_parse("DD_CLUSTER_ALERT", int, cls.dd_cluster_alert),
            dd_cluster_high=_parse("DD_CLUSTER_HIGH", int, cls.dd_cluster_high),
            churn_cluster_boost=_parse("CHURN_CLUSTER_BOOST", int, cls.churn_cluster_boost),
        )


CONFIG = ThresholdConfig.from_env()


@dataclass(frozen=True)
class AppSettings:
    leading_symbols: Tuple[str, ...]
    post_ftd_monitor_days: int = 10

    @classmethod
    def from_env(cls) -> "AppSettings":
        default_leaders = (
            "TSLA",
            "NVDA",
            "MSFT",
            "AMZN",
            "META",
            "GOOGL",
            "AAPL",
            "LLY",
        )
        return cls(
            leading_symbols=_parse_symbols("LEADING_SYMBOLS", default_leaders),
            post_ftd_monitor_days=_parse("POST_FTD_MONITOR_DAYS", int, cls.post_ftd_monitor_days),
        )


SETTINGS = AppSettings.from_env()
