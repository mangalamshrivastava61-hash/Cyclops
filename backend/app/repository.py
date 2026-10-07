"""Reads and writes against the database, returning API schemas. The only module that touches ORM rows
for reads; services build on it."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas
from .services.errors import NotFound

_DECISION_FIELDS = [f for f in schemas.Decision.model_fields if f != "status"]


# ── world and catalogue ────────────────────────────────────────────────────────


def get_world(db: Session) -> schemas.World:
    row = db.get(models.World, 1)
    if row is None:
        raise NotFound("The database has not been seeded.")
    return schemas.World.model_validate(row)


def list_products(db: Session) -> list[schemas.Product]:
    return [schemas.Product.model_validate(r) for r in db.scalars(select(models.Product).order_by(models.Product.sku))]


def get_product(db: Session, sku: str) -> schemas.Product:
    row = db.get(models.Product, sku)
    if row is None:
        raise NotFound(f"No product with SKU {sku}.")
    return schemas.Product.model_validate(row)


def get_forecast(db: Session, forecast_id: str) -> schemas.Forecast | None:
    row = db.get(models.Forecast, forecast_id)
    return schemas.Forecast.model_validate(row) if row else None


# ── decisions and actions ──────────────────────────────────────────────────────


def list_decision_rows(db: Session) -> list[models.Decision]:
    return list(db.scalars(select(models.Decision).order_by(models.Decision.id)))


def get_decision_row(db: Session, decision_id: str) -> models.Decision:
    row = db.get(models.Decision, decision_id)
    if row is None:
        raise NotFound(f"No decision #{decision_id}.")
    return row


def to_decision(row: models.Decision, action: schemas.DecisionAction) -> schemas.Decision:
    return schemas.Decision(**{f: getattr(row, f) for f in _DECISION_FIELDS}, status=action.status)


def get_action(db: Session, decision_id: str) -> schemas.DecisionAction:
    row = db.get(models.DecisionAction, decision_id)
    if row is None:
        raise NotFound(f"No decision #{decision_id}.")
    return schemas.DecisionAction.model_validate(row)


def list_actions(db: Session) -> dict[str, schemas.DecisionAction]:
    return {r.decision_id: schemas.DecisionAction.model_validate(r) for r in db.scalars(select(models.DecisionAction))}


def save_action(db: Session, decision_id: str, action: schemas.DecisionAction) -> None:
    row = db.get(models.DecisionAction, decision_id)
    if row is None:
        raise NotFound(f"No decision #{decision_id}.")
    for field, value in action.model_dump().items():
        setattr(row, field, value)


# ── evidence, authority, circuit ───────────────────────────────────────────────


def get_evidence(db: Session, decision_id: str) -> schemas.EvidenceReport | None:
    row = db.scalar(select(models.EvidenceReport).where(models.EvidenceReport.decision_id == decision_id))
    return schemas.EvidenceReport.model_validate(row) if row else None


def evidence_decision_ids(db: Session) -> set[str]:
    return set(db.scalars(select(models.EvidenceReport.decision_id)))


def list_levels(db: Session) -> list[schemas.AuthorityLevelDef]:
    return [schemas.AuthorityLevelDef.model_validate(r) for r in db.scalars(select(models.AuthorityLevel).order_by(models.AuthorityLevel.level))]


def get_authority_record(db: Session, sku: str) -> schemas.AuthorityRecord | None:
    row = db.get(models.AuthorityRecord, sku)
    if row is None:
        return None
    return schemas.AuthorityRecord(
        sku=row.sku,
        earned_level=row.earned_level,
        real_world_start=row.real_world_start,
        levels=list_levels(db),
        history=row.history,
        earn=row.earn,
        lose=row.lose,
    )


def get_circuit(db: Session) -> schemas.CircuitRecord:
    row = db.get(models.Circuit, 1)
    if row is None:
        raise NotFound("No decision circuit configured.")
    return schemas.CircuitRecord.model_validate(row)


def get_simulation(db: Session) -> schemas.Simulation:
    row = db.get(models.Simulation, 1)
    if row is None:
        raise NotFound("The database has not been seeded.")
    return schemas.Simulation(circuit=row.circuit_state, probes_preview=row.probes_preview)


def save_simulation(db: Session, sim: schemas.Simulation) -> None:
    row = db.get(models.Simulation, 1)
    if row is None:
        raise NotFound("The database has not been seeded.")
    row.circuit_state = sim.circuit
    row.probes_preview = sim.probes_preview


# ── ledger and replays ─────────────────────────────────────────────────────────


def list_ledger_rows(db: Session) -> list[models.LedgerEntry]:
    return list(db.scalars(select(models.LedgerEntry).order_by(models.LedgerEntry.seq)))


def last_ledger_row(db: Session) -> models.LedgerEntry:
    row = db.scalar(select(models.LedgerEntry).order_by(models.LedgerEntry.seq.desc()).limit(1))
    if row is None:
        raise NotFound("The ledger is empty; seed the database first.")
    return row


def get_ledger_row(db: Session, entry_id: str) -> models.LedgerEntry:
    row = db.scalar(select(models.LedgerEntry).where(models.LedgerEntry.id == entry_id))
    if row is None:
        raise NotFound(f"No ledger entry #{entry_id}.")
    return row


def list_replays(db: Session) -> list[schemas.Replay]:
    return [schemas.Replay.model_validate(r.payload) for r in db.scalars(select(models.Replay).order_by(models.Replay.id))]


def get_replay(db: Session, replay_id: str) -> schemas.Replay:
    row = db.get(models.Replay, replay_id)
    if row is None:
        raise NotFound(f"No replay {replay_id}.")
    return schemas.Replay.model_validate(row.payload)


def counts(db: Session) -> dict[str, int]:
    from sqlalchemy import func

    tables = {"products": models.Product, "decisions": models.Decision, "forecasts": models.Forecast, "ledgerEntries": models.LedgerEntry, "replays": models.Replay}
    return {name: db.scalar(select(func.count()).select_from(model)) or 0 for name, model in tables.items()}
