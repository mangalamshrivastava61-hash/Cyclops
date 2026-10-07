"""Effective authority: what ORACLE may do for a SKU right now.

Earned level from the authority record, replaced by the experiment's restore level while the probe
preview is on, then capped by the decision circuit's state (review caps at L2, bench at L1).
"""

from sqlalchemy.orm import Session

from .. import repository, schemas


def effective(db: Session, sku: str, sim: schemas.Simulation | None = None, circuit: schemas.CircuitRecord | None = None) -> schemas.EffectiveAuthority:
    sim = sim or repository.get_simulation(db)
    circuit = circuit or repository.get_circuit(db)
    record = repository.get_authority_record(db, sku)
    earned = record.earned_level if record else 1
    level = earned
    if sim.probes_preview:
        restore = _restore_level(db, sku)
        if restore is not None:
            level = restore
    cap = circuit.states[sim.circuit].authority_cap
    if cap is not None:
        level = min(level, cap)
    return schemas.EffectiveAuthority(level=level, earned=earned, preview=sim.probes_preview, cap=cap, circuit=sim.circuit)


def effective_all(db: Session) -> dict[str, schemas.EffectiveAuthority]:
    sim = repository.get_simulation(db)
    circuit = repository.get_circuit(db)
    return {p.sku: effective(db, p.sku, sim, circuit) for p in repository.list_products(db)}


def _restore_level(db: Session, sku: str) -> int | None:
    """Level the SKU's evidence experiment would restore, if one is proposed."""
    for row in repository.list_decision_rows(db):
        if row.sku == sku:
            report = repository.get_evidence(db, row.id)
            if report:
                return report.restore.level
    return None
