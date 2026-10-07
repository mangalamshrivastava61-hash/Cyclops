"""Database tables.

Scalar facts the API filters or joins on are columns. Nested, read-mostly structures (forecast curves,
sales history, evidence grades, receipts) are stored as JSON documents to keep the schema small.
"""

from typing import Any

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class World(Base):
    """The synthetic world's calendar and owner. One row."""

    __tablename__ = "world"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    today: Mapped[str] = mapped_column(String(10))
    today_label: Mapped[str] = mapped_column(String(20))
    yesterday: Mapped[str] = mapped_column(String(10))
    yesterday_label: Mapped[str] = mapped_column(String(20))
    week: Mapped[int] = mapped_column(Integer)
    store: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(40))
    planner: Mapped[str] = mapped_column(String(80))
    planner_initials: Mapped[str] = mapped_column(String(4))
    primary_decision_id: Mapped[str] = mapped_column(String(20))


class Product(Base):
    __tablename__ = "products"

    sku: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    colorway: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(40))
    store: Mapped[str] = mapped_column(String(40))
    price: Mapped[float] = mapped_column(Float)
    unit_cost: Mapped[float] = mapped_column(Float)
    case_pack: Mapped[int] = mapped_column(Integer)
    lead_time_days: Mapped[int] = mapped_column(Integer)
    review_cycle_days: Mapped[int] = mapped_column(Integer)
    authority_chip: Mapped[str] = mapped_column(String(20))


class Forecast(Base):
    __tablename__ = "forecasts"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"), index=True)
    issued_at: Mapped[str] = mapped_column(String(19))
    horizon_days: Mapped[int] = mapped_column(Integer)
    p10: Mapped[float] = mapped_column(Float)
    p50: Mapped[float] = mapped_column(Float)
    p90: Mapped[float] = mapped_column(Float)
    demand_trend: Mapped[float] = mapped_column(Float)
    cover_days_now: Mapped[float] = mapped_column(Float)
    cover_days_end: Mapped[float] = mapped_column(Float)
    policy: Mapped[dict[str, Any]] = mapped_column(JSON)
    daily: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    history: Mapped[list[dict[str, Any]]] = mapped_column(JSON)


class Decision(Base):
    """A recommendation as ORACLE issued it. Never edited; what the planner does lives in DecisionAction."""

    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"), index=True)
    forecast_id: Mapped[str] = mapped_column(ForeignKey("forecasts.id"))
    evidence_id: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[str] = mapped_column(String(19))
    action: Mapped[str] = mapped_column(String(20))  # order | markdown | none
    recommended_order: Mapped[int] = mapped_column(Integer)
    fallback_order: Mapped[int] = mapped_column(Integer)
    fallback_rule: Mapped[str] = mapped_column(String(80))
    on_hand: Mapped[int] = mapped_column(Integer)
    on_order: Mapped[int] = mapped_column(Integer)
    on_order_due: Mapped[str] = mapped_column(String(10))
    arrival: Mapped[str] = mapped_column(String(10))
    next_delivery: Mapped[str] = mapped_column(String(10))
    target_position: Mapped[int] = mapped_column(Integer)
    stockout_risk: Mapped[float] = mapped_column(Float)
    expected_contribution: Mapped[float] = mapped_column(Float)
    contribution_vs_fallback: Mapped[float] = mapped_column(Float)
    critical_ratio: Mapped[float] = mapped_column(Float)
    authority: Mapped[int] = mapped_column(Integer)
    seed_status: Mapped[str] = mapped_column(String(20))  # status when the record was issued
    circuit: Mapped[str] = mapped_column(String(20))
    rationale: Mapped[str] = mapped_column(Text)
    data_snapshot: Mapped[str] = mapped_column(String(40))
    record_hash: Mapped[str] = mapped_column(String(20))
    prev_hash: Mapped[str] = mapped_column(String(20))


class DecisionAction(Base):
    """What the planner did with a decision: the current, mutable state."""

    __tablename__ = "decision_actions"

    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), primary_key=True)
    status: Mapped[str] = mapped_column(String(20))  # pending | approved | modified | rejected
    quantity: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(String(80), nullable=True)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    at: Mapped[str | None] = mapped_column(String(19), nullable=True)
    by: Mapped[str | None] = mapped_column(String(80), nullable=True)


class EvidenceReport(Base):
    __tablename__ = "evidence_reports"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), unique=True)
    graded_at: Mapped[str] = mapped_column(String(19))
    grades: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    authority_before: Mapped[dict[str, Any]] = mapped_column(JSON)
    authority_now: Mapped[dict[str, Any]] = mapped_column(JSON)
    rule: Mapped[str] = mapped_column(Text)
    restore: Mapped[dict[str, Any]] = mapped_column(JSON)


class AuthorityLevel(Base):
    __tablename__ = "authority_levels"

    level: Mapped[int] = mapped_column(Integer, primary_key=True)
    short: Mapped[str] = mapped_column(String(40))
    plain: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str] = mapped_column(Text)


class AuthorityRecord(Base):
    __tablename__ = "authority_records"

    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"), primary_key=True)
    earned_level: Mapped[int] = mapped_column(Integer)
    real_world_start: Mapped[int] = mapped_column(Integer)
    history: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    earn: Mapped[dict[str, Any]] = mapped_column(JSON)
    lose: Mapped[dict[str, Any]] = mapped_column(JSON)


class Circuit(Base):
    """The decision circuit for the category: live state, signals and what each state allows."""

    __tablename__ = "circuit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    live_state: Mapped[str] = mapped_column(String(20))
    since: Mapped[str] = mapped_column(String(10))
    scope: Mapped[str] = mapped_column(String(80))
    signals: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    states: Mapped[dict[str, Any]] = mapped_column(JSON)
    last_trip: Mapped[str] = mapped_column(String(120))
    false_trip_budget: Mapped[str] = mapped_column(String(120))


class Simulation(Base):
    """Demo switches: a simulated circuit state and the probe-experiment preview. One row."""

    __tablename__ = "simulation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    circuit_state: Mapped[str] = mapped_column(String(20))
    probes_preview: Mapped[bool] = mapped_column(Boolean, default=False)


class LedgerEntry(Base):
    """Append-only, hash-chained record of everything ORACLE and the planner did."""

    __tablename__ = "ledger_entries"

    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    id: Mapped[str] = mapped_column(String(20), unique=True)
    at: Mapped[str] = mapped_column(String(19), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    sku: Mapped[str | None] = mapped_column(String(20), nullable=True)
    decision_id: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    eyebrow: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(200))
    meta: Mapped[str] = mapped_column(Text)
    quote: Mapped[str | None] = mapped_column(String(200), nullable=True)
    chip: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    link: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    receipt: Mapped[list[list[dict[str, Any]]] | None] = mapped_column(JSON, nullable=True)
    hash: Mapped[str] = mapped_column(String(20))
    prev_hash: Mapped[str] = mapped_column(String(20))
    origin: Mapped[str] = mapped_column(String(10), default="app")  # seed | app


class Replay(Base):
    __tablename__ = "replays"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
