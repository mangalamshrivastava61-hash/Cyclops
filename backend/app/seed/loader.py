"""Load the synthetic Store 03 world into the database.

The JSON files in ./data are the single source of the demo records (exported from the original
frontend mock data). ``seed_if_empty`` runs on startup; ``reset`` restores everything, which is what
"Reset the simulation" calls.
"""

import json
import re
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..db import Base

DATA = Path(__file__).resolve().parent / "data"


def _load(name: str) -> Any:
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def _snake(key: str) -> str:
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", key).lower()


def _row(model: type[Base], record: dict[str, Any], **overrides: Any) -> Base:
    columns = {c.key for c in model.__table__.columns}
    values = {_snake(k): v for k, v in record.items() if _snake(k) in columns}
    values.update(overrides)
    return model(**values)


def is_seeded(db: Session) -> bool:
    return db.scalar(select(models.World.id)) is not None


def seed_if_empty(db: Session) -> bool:
    if is_seeded(db):
        return False
    _insert_all(db)
    db.commit()
    return True


def reset(db: Session) -> None:
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    _insert_all(db)
    db.commit()


def _insert_all(db: Session) -> None:
    world = _load("world")
    db.add(_row(models.World, world, id=1))

    for p in _load("products"):
        db.add(_row(models.Product, p))
    db.flush()

    for f in _load("forecasts"):
        db.add(_row(models.Forecast, f))
    db.flush()

    decisions = _load("decisions")
    for d in decisions:
        db.add(_row(models.Decision, d, seed_status=d["status"]))
    db.flush()

    # what the planner had already done when the world was frozen
    modified = _load("decision_actions")
    for d in decisions:
        mod = modified.get(d["id"])
        if mod:
            action = models.DecisionAction(decision_id=d["id"], status="modified", quantity=mod["quantity"], reason=mod["reason"], note=mod["note"], at=mod["at"], by=world["planner"])
        elif d["status"] == "approved":
            action = models.DecisionAction(decision_id=d["id"], status="approved", quantity=d["recommendedOrder"], at=d["createdAt"])
        else:
            action = models.DecisionAction(decision_id=d["id"], status=d["status"], quantity=d["recommendedOrder"])
        db.add(action)

    for e in _load("evidence"):
        db.add(_row(models.EvidenceReport, e))

    for lvl in _load("authority_levels"):
        db.add(_row(models.AuthorityLevel, lvl))
    for a in _load("authority_records"):
        db.add(_row(models.AuthorityRecord, a))

    db.add(_row(models.Circuit, _load("circuit"), id=1))
    db.add(models.Simulation(id=1, circuit_state=_load("circuit")["liveState"], probes_preview=False))

    for entry in _load("ledger"):
        db.add(_row(models.LedgerEntry, entry, origin="seed"))

    for r in _load("replays"):
        db.add(models.Replay(id=r["id"], sku=r["sku"], payload=r))
    db.flush()
