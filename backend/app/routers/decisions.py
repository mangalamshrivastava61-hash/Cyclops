"""Decisions and the planner's actions on them."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..services import decisions, scenarios

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


@router.get("", response_model=list[schemas.DecisionSummary], summary="This week's decisions")
def list_decisions(db: Session = Depends(get_db)) -> list[schemas.DecisionSummary]:
    return decisions.summaries(db)


@router.get("/{decision_id}", response_model=schemas.DecisionBundle, summary="A decision with its product, forecast, evidence, authority and policy inputs")
def get_decision(decision_id: str, db: Session = Depends(get_db)) -> schemas.DecisionBundle:
    return decisions.load(db, decision_id).as_schema()


@router.post("/{decision_id}/approve", response_model=schemas.MutationResult, summary="Approve ORACLE's recommendation (or acknowledge advice)")
def approve(decision_id: str, db: Session = Depends(get_db)) -> schemas.MutationResult:
    return decisions.approve(db, decision_id)


@router.post("/{decision_id}/modify", response_model=schemas.MutationResult, summary="Order a different quantity, with a reason")
def modify(decision_id: str, body: schemas.ModifyRequest, db: Session = Depends(get_db)) -> schemas.MutationResult:
    return decisions.modify(db, decision_id, body)


@router.post("/{decision_id}/reject", response_model=schemas.MutationResult, summary="Reject; the fallback rule orders instead")
def reject(decision_id: str, body: schemas.RejectRequest, db: Session = Depends(get_db)) -> schemas.MutationResult:
    return decisions.reject(db, decision_id, body)


@router.post("/{decision_id}/scenario", response_model=schemas.ScenarioResponse, summary="Re-solve the order under stress (what-if)")
def scenario(decision_id: str, body: schemas.ScenarioRequest, db: Session = Depends(get_db)) -> schemas.ScenarioResponse:
    return scenarios.run(decisions.load(db, decision_id), body.stress)
