"""Read-only records: products, forecasts, evidence, authority, the circuit, replays, scenario presets."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import repository, schemas
from ..db import get_db
from ..services import authority, scenarios
from ..services.errors import NotFound

router = APIRouter(prefix="/api", tags=["records"])


@router.get("/products", response_model=list[schemas.Product])
def products(db: Session = Depends(get_db)) -> list[schemas.Product]:
    return repository.list_products(db)


@router.get("/products/{sku}", response_model=schemas.Product)
def product(sku: str, db: Session = Depends(get_db)) -> schemas.Product:
    return repository.get_product(db, sku)


@router.get("/forecasts/{forecast_id}", response_model=schemas.Forecast)
def forecast(forecast_id: str, db: Session = Depends(get_db)) -> schemas.Forecast:
    f = repository.get_forecast(db, forecast_id)
    if f is None:
        raise NotFound(f"No forecast {forecast_id}.")
    return f


@router.get("/evidence/{decision_id}", response_model=schemas.EvidenceReport, summary="Evidence report for a decision")
def evidence(decision_id: str, db: Session = Depends(get_db)) -> schemas.EvidenceReport:
    report = repository.get_evidence(db, decision_id)
    if report is None:
        raise NotFound(f"No evidence report for decision #{decision_id}.")
    return report


@router.get("/authority/levels", response_model=list[schemas.AuthorityLevelDef], summary="The L0–L4 ladder")
def levels(db: Session = Depends(get_db)) -> list[schemas.AuthorityLevelDef]:
    return repository.list_levels(db)


@router.get("/authority/{sku}", response_model=schemas.AuthorityRecord, summary="Earned-authority record for a SKU")
def authority_record(sku: str, db: Session = Depends(get_db)) -> schemas.AuthorityRecord:
    record = repository.get_authority_record(db, sku)
    if record is None:
        raise NotFound(f"No authority record for SKU {sku}.")
    return record


@router.get("/authority/{sku}/effective", response_model=schemas.EffectiveAuthority, summary="What ORACLE may do for a SKU right now")
def effective_authority(sku: str, db: Session = Depends(get_db)) -> schemas.EffectiveAuthority:
    repository.get_product(db, sku)
    return authority.effective(db, sku)


@router.get("/circuit", response_model=schemas.CircuitRecord, summary="Decision circuit: live state, signals, what each state allows")
def circuit(db: Session = Depends(get_db)) -> schemas.CircuitRecord:
    return repository.get_circuit(db)


@router.get("/replays", response_model=list[schemas.Replay])
def replays(db: Session = Depends(get_db)) -> list[schemas.Replay]:
    return repository.list_replays(db)


@router.get("/replays/{replay_id}", response_model=schemas.Replay, summary="A sealed Time Machine replay")
def replay(replay_id: str, db: Session = Depends(get_db)) -> schemas.Replay:
    return repository.get_replay(db, replay_id)


@router.get("/scenarios/presets", response_model=schemas.ScenarioPresets, summary="Break My Plan's opening stress and single-stress presets")
def scenario_presets() -> schemas.ScenarioPresets:
    return scenarios.presets()
