"""Demo switches: simulate a circuit state, preview the probe experiment, reset everything."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import repository, schemas
from ..db import get_db
from ..seed import loader
from ..services import ledger
from ..services.state import app_state, update_simulation

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


@router.get("", response_model=schemas.Simulation)
def get_simulation(db: Session = Depends(get_db)) -> schemas.Simulation:
    return repository.get_simulation(db)


@router.put("", response_model=schemas.SimulationResult, summary="Set the simulated circuit state and/or the probe preview")
def put_simulation(body: schemas.SimulationUpdate, db: Session = Depends(get_db)) -> schemas.SimulationResult:
    return update_simulation(db, body)


@router.post("/reset", response_model=schemas.AppState, summary="Restore the synthetic world (clears every action and new ledger entry)")
def reset(db: Session = Depends(get_db)) -> schemas.AppState:
    with ledger.WRITE_LOCK:
        loader.reset(db)
    return app_state(db)
