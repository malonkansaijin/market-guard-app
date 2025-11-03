from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .services.market import parse_symbols, summarize_overview, summarize_symbols


class WarningModel(BaseModel):
    type: str
    code: str
    severity: str
    message: str
    ttl_days: int | None = None
    evidence: dict[str, float | int | None] | None = None


class DailyItemModel(BaseModel):
    date: str
    o: float
    h: float
    l: float
    c: float
    v: float
    pct: float | None
    ma21: float | None
    ma50: float | None
    ma200: float | None
    warnings_top: list[WarningModel]
    warnings_bottom: list[WarningModel]


class FTDInfoModel(BaseModel):
    status: str
    date: str | None = None
    invalidated_on: str | None = None
    day1: str | None = None


class SymbolScan(BaseModel):
    symbol: str
    last_date: str
    regime: str
    dd_25d: int
    churn_25d: int
    ftd: FTDInfoModel
    sparkline: str
    items: list[DailyItemModel]


class SymbolOverview(BaseModel):
    symbol: str
    last_date: str
    regime: str
    dd_25d: int
    churn_25d: int
    ftd: FTDInfoModel
    sparkline: str
    high_priority_warnings: int

app = FastAPI(title="Market Guard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", summary="Health check")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/scan", response_model=list[SymbolScan], summary="Run market scan")
async def api_scan(
    symbols: str = Query("SPY,QQQ", description="Comma-separated ticker list."),
    days: int = Query(
        120,
        ge=30,
        le=365,
        description="Number of trading days to include.",
    ),
) -> list[SymbolScan]:
    tickers = parse_symbols(symbols)
    if not tickers:
        raise HTTPException(status_code=400, detail="No symbols provided.")
    try:
        summaries = summarize_symbols(tickers, days)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return [SymbolScan(**summary.as_payload()) for summary in summaries]


@app.get(
    "/summary",
    response_model=list[SymbolOverview],
    summary="Market overview snapshot",
)
async def api_summary(
    symbols: str = Query("SPY,QQQ", description="Comma-separated ticker list."),
    days: int = Query(
        120,
        ge=30,
        le=365,
        description="Number of trading days to include in calculations.",
    ),
) -> list[SymbolOverview]:
    tickers = parse_symbols(symbols)
    if not tickers:
        raise HTTPException(status_code=400, detail="No symbols provided.")
    try:
        summaries = summarize_symbols(tickers, days)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return [SymbolOverview(**summarize_overview(summary)) for summary in summaries]
