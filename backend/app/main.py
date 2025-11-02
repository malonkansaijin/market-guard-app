from fastapi import FastAPI

app = FastAPI(title="Market Guard API")


@app.get("/health", summary="Health check")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
