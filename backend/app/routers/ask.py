"""Ask ORACLE: grounded answers from records."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..services import ask as ask_svc

router = APIRouter(prefix="/api/ask", tags=["ask"])


@router.post("", response_model=schemas.AskAnswer, summary="Ask a question; the answer cites the records it used")
def ask(body: schemas.AskRequest, db: Session = Depends(get_db)) -> schemas.AskAnswer:
    return ask_svc.ask(db, body.question, body.asked_at)


@router.get("/suggestions", response_model=list[schemas.FollowUp])
def suggestions() -> list[schemas.FollowUp]:
    return ask_svc.SUGGESTIONS
