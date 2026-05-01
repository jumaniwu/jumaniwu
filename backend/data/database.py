"""SQLite database layer using SQLAlchemy async."""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean, Column, DateTime, Float, Integer, String, Text,
    UniqueConstraint, select, update, delete,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pair = Column(String, nullable=False)
    side = Column(String, nullable=False)          # buy | sell
    mode = Column(String, nullable=False)          # paper | live
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float)
    quantity = Column(Float, nullable=False)
    stop_loss = Column(Float)
    take_profit = Column(Float)
    status = Column(String, nullable=False, default="open")  # open | closed | cancelled
    pnl = Column(Float)
    pnl_pct = Column(Float)
    ai_reasoning = Column(Text)
    close_reason = Column(String)                 # signal | stop_loss | take_profit | manual
    opened_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    closed_at = Column(DateTime)
    exchange_order_id = Column(String)


class Position(Base):
    __tablename__ = "positions"
    __table_args__ = (UniqueConstraint("pair"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    pair = Column(String, nullable=False)
    side = Column(String, nullable=False)
    entry_price = Column(Float, nullable=False)
    current_price = Column(Float)
    quantity = Column(Float, nullable=False)
    stop_loss = Column(Float)
    take_profit = Column(Float)
    unrealized_pnl = Column(Float, default=0.0)
    pnl_pct = Column(Float, default=0.0)
    trade_id = Column(Integer)
    opened_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_updated = Column(DateTime, nullable=False, default=datetime.utcnow)


class AgentDecision(Base):
    __tablename__ = "agent_decisions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pair = Column(String, nullable=False)
    decision = Column(String, nullable=False)      # buy | sell | hold
    confidence = Column(Float)
    reasoning = Column(Text)
    risk_factors = Column(Text)                    # JSON array as string
    supporting_signals = Column(Text)             # JSON array as string
    signals_json = Column(Text)                    # full TA analysis JSON
    raw_response = Column(Text)
    executed = Column(Boolean, default=False)
    trade_id = Column(Integer)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class OHLCVCache(Base):
    __tablename__ = "ohlcv_cache"
    __table_args__ = (UniqueConstraint("pair", "timeframe", "timestamp"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    pair = Column(String, nullable=False)
    timeframe = Column(String, nullable=False)
    timestamp = Column(Integer, nullable=False)    # epoch ms
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    fetched_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class PerformanceSnapshot(Base):
    __tablename__ = "performance_snapshots"
    __table_args__ = (UniqueConstraint("date"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, nullable=False)          # YYYY-MM-DD
    portfolio_value = Column(Float, nullable=False)
    daily_pnl = Column(Float, nullable=False)
    daily_pnl_pct = Column(Float, nullable=False)
    total_trades = Column(Integer, nullable=False)
    winning_trades = Column(Integer, nullable=False)
    mode = Column(String, nullable=False)
    snapshot_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Database:
    def __init__(self, db_path: str):
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        url = f"sqlite+aiosqlite:///{db_path}"
        self._engine = create_async_engine(url, echo=False)
        self._session_factory = async_sessionmaker(self._engine, expire_on_commit=False)

    async def init(self) -> None:
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def close(self) -> None:
        await self._engine.dispose()

    # ── Trades ──────────────────────────────────────────────────────────────

    async def save_trade(self, data: dict) -> dict:
        async with self._session_factory() as s:
            trade = Trade(**data)
            s.add(trade)
            await s.commit()
            await s.refresh(trade)
            return self._row(trade)

    async def update_trade(self, trade_id: int, **kwargs) -> dict | None:
        async with self._session_factory() as s:
            await s.execute(update(Trade).where(Trade.id == trade_id).values(**kwargs))
            await s.commit()
            row = await s.get(Trade, trade_id)
            return self._row(row) if row else None

    async def get_open_trades(self) -> list[dict]:
        async with self._session_factory() as s:
            result = await s.execute(select(Trade).where(Trade.status == "open"))
            return [self._row(r) for r in result.scalars()]

    async def get_trades(self, limit: int = 100, offset: int = 0) -> list[dict]:
        async with self._session_factory() as s:
            result = await s.execute(
                select(Trade).order_by(Trade.opened_at.desc()).limit(limit).offset(offset)
            )
            return [self._row(r) for r in result.scalars()]

    # ── Positions ────────────────────────────────────────────────────────────

    async def upsert_position(self, data: dict) -> dict:
        async with self._session_factory() as s:
            result = await s.execute(select(Position).where(Position.pair == data["pair"]))
            existing = result.scalar_one_or_none()
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
                existing.last_updated = datetime.utcnow()
            else:
                existing = Position(**data)
                s.add(existing)
            await s.commit()
            await s.refresh(existing)
            return self._row(existing)

    async def get_positions(self) -> list[dict]:
        async with self._session_factory() as s:
            result = await s.execute(select(Position))
            return [self._row(r) for r in result.scalars()]

    async def delete_position(self, pair: str) -> None:
        async with self._session_factory() as s:
            await s.execute(delete(Position).where(Position.pair == pair))
            await s.commit()

    # ── Agent Decisions ──────────────────────────────────────────────────────

    async def save_decision(self, data: dict) -> dict:
        async with self._session_factory() as s:
            dec = AgentDecision(**data)
            s.add(dec)
            await s.commit()
            await s.refresh(dec)
            return self._row(dec)

    async def get_decisions(self, limit: int = 20) -> list[dict]:
        async with self._session_factory() as s:
            result = await s.execute(
                select(AgentDecision).order_by(AgentDecision.created_at.desc()).limit(limit)
            )
            return [self._row(r) for r in result.scalars()]

    # ── OHLCV Cache ──────────────────────────────────────────────────────────

    async def get_ohlcv_cache(self, pair: str, timeframe: str, limit: int) -> list[list] | None:
        async with self._session_factory() as s:
            result = await s.execute(
                select(OHLCVCache)
                .where(OHLCVCache.pair == pair, OHLCVCache.timeframe == timeframe)
                .order_by(OHLCVCache.timestamp.asc())
            )
            rows = result.scalars().all()
            if len(rows) < limit:
                return None
            return [[r.timestamp, r.open, r.high, r.low, r.close, r.volume] for r in rows[-limit:]]

    async def save_ohlcv_cache(self, pair: str, timeframe: str, rows: list[list]) -> None:
        async with self._session_factory() as s:
            for row in rows:
                ts, o, h, l, c, v = row
                existing = await s.execute(
                    select(OHLCVCache).where(
                        OHLCVCache.pair == pair,
                        OHLCVCache.timeframe == timeframe,
                        OHLCVCache.timestamp == ts,
                    )
                )
                if existing.scalar_one_or_none() is None:
                    s.add(OHLCVCache(pair=pair, timeframe=timeframe,
                                     timestamp=ts, open=o, high=h, low=l, close=c, volume=v))
            await s.commit()

    # ── Performance ──────────────────────────────────────────────────────────

    async def save_performance_snapshot(self, data: dict) -> None:
        async with self._session_factory() as s:
            result = await s.execute(
                select(PerformanceSnapshot).where(PerformanceSnapshot.date == data["date"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                s.add(PerformanceSnapshot(**data))
            await s.commit()

    async def get_performance_snapshots(self, limit: int = 30) -> list[dict]:
        async with self._session_factory() as s:
            result = await s.execute(
                select(PerformanceSnapshot).order_by(PerformanceSnapshot.date.desc()).limit(limit)
            )
            return [self._row(r) for r in result.scalars()]

    # ── Stats ────────────────────────────────────────────────────────────────

    async def get_trade_stats(self) -> dict:
        trades = await self.get_trades(limit=10000)
        closed = [t for t in trades if t["status"] == "closed"]
        winners = [t for t in closed if (t["pnl"] or 0) > 0]
        total_pnl = sum(t["pnl"] or 0 for t in closed)
        return {
            "total_trades": len(closed),
            "winning_trades": len(winners),
            "win_rate": len(winners) / len(closed) if closed else 0.0,
            "total_pnl": total_pnl,
        }

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _row(obj: Any) -> dict:
        result = {}
        for col in obj.__table__.columns:
            v = getattr(obj, col.name)
            if isinstance(v, datetime):
                v = v.isoformat() + "Z"
            result[col.name] = v
        return result
