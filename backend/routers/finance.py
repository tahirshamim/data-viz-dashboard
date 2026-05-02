from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from db.database import get_db
from models.data_model import StockPrice
from datetime import datetime
from typing import Optional

router = APIRouter()

@router.get("/prices")
async def get_stock_prices(
    symbol:     Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    limit:      int           = Query(1000, le=10000),
    db:         AsyncSession  = Depends(get_db)
):
    filters = []
    if symbol:
        filters.append(StockPrice.symbol == symbol.upper())
    if start_date:
        filters.append(StockPrice.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        filters.append(StockPrice.timestamp <= datetime.fromisoformat(end_date))

    stmt = (
        select(StockPrice)
        .where(and_(*filters))
        .order_by(StockPrice.timestamp.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id":        r.id,
            "symbol":    r.symbol,
            "open":      r.open,
            "high":      r.high,
            "low":       r.low,
            "close":     r.close,
            "volume":    r.volume,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in rows
    ]

@router.get("/summary")
async def get_finance_summary(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func
    stmt = select(
        func.count(StockPrice.id).label("total_records"),
        func.count(func.distinct(StockPrice.symbol)).label("symbols"),
        func.avg(StockPrice.close).label("avg_close"),
        func.sum(StockPrice.volume).label("total_volume"),
    )
    result = await db.execute(stmt)
    row = result.one()
    return {
        "total_records": row.total_records or 0,
        "symbols":       row.symbols       or 0,
        "avg_close":     round(row.avg_close or 0, 2),
        "total_volume":  row.total_volume  or 0,
    }


    
@router.get("/trigger-fetch")
async def trigger_stock_fetch(background_tasks: BackgroundTasks):
    """Returns immediately — runs fetch in background."""
    from tasks.ingestion import _fetch_stocks
    background_tasks.add_task(_fetch_stocks)
    return {"status": "ok", "message": "Stock fetch started in background"}