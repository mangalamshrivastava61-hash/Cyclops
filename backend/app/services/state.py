"""The shared application state every page starts from, and the demo simulation switches."""

from sqlalchemy.orm import Session

from .. import repository, schemas
from . import authority


def app_state(db: Session) -> schemas.AppState:
    return schemas.AppState(
        world=repository.get_world(db),
        actions=repository.list_actions(db),
        simulation=repository.get_simulation(db),
        authority=authority.effective_all(db),
        levels=repository.list_levels(db),
    )


def update_simulation(db: Session, update: schemas.SimulationUpdate) -> schemas.SimulationResult:
    sim = repository.get_simulation(db)
    if update.circuit is not None:
        sim.circuit = update.circuit
    if update.probes_preview is not None:
        sim.probes_preview = update.probes_preview
    repository.save_simulation(db, sim)
    db.commit()
    return schemas.SimulationResult(simulation=sim, authority=authority.effective_all(db))
