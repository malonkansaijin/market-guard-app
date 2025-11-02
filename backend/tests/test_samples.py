from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.main import SymbolOverview, SymbolScan


def _load_sample(path: str) -> list[dict]:
    file_path = Path(__file__).resolve().parents[1] / "samples" / path
    with file_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def test_scan_sample_schema() -> None:
    data = _load_sample("scan_SPY_QQQ.json")
    models = [SymbolScan(**payload) for payload in data]
    assert models, "sample scan response must contain at least one symbol"
    first = models[0]
    assert first.items, "sample scan response should include daily items"
    assert {"warnings_top", "warnings_bottom"} <= set(first.items[0].model_dump().keys())


def test_summary_sample_schema() -> None:
    data = _load_sample("summary_SPY_QQQ.json")
    models = [SymbolOverview(**payload) for payload in data]
    assert models, "sample summary response must contain at least one symbol"
    assert models[0].high_priority_warnings >= 0
