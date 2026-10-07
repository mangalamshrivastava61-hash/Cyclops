"""Health, the synthetic world and the shared app state."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import __version__, repository, schemas
from ..db import get_db
from ..services.forecast import get_forecast_provider
from ..services.state import app_state

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health", response_model=schemas.Health, summary="Is the API up, and what is it serving?")
def health(db: Session = Depends(get_db)) -> schemas.Health:
    dialect = db.get_bind().dialect.name
    return schemas.Health(status="ok", version=__version__, database=dialect, forecast_provider=get_forecast_provider().name, records=repository.counts(db))


@router.get("/world", response_model=schemas.World, summary="The synthetic world: today, store, planner")
def world(db: Session = Depends(get_db)) -> schemas.World:
    return repository.get_world(db)


@router.get("/state", response_model=schemas.AppState, summary="Everything every page shares (the frontend loads this first)")
def state(db: Session = Depends(get_db)) -> schemas.AppState:
    return app_state(db)
