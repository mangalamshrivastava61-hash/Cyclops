"""The append-only decision ledger."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import repository, schemas
from ..db import get_db
from ..services import ledger, presentation

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


@router.get("", response_model=list[schemas.LedgerEntry], summary="All entries, oldest first")
def list_entries(db: Session = Depends(get_db)) -> list[schemas.LedgerEntry]:
    return presentation.present_all(db)


@router.get("/verify", response_model=schemas.LedgerVerify, summary="Check the hash chain")
def verify(db: Session = Depends(get_db)) -> schemas.LedgerVerify:
    return ledger.verify(db)


@router.get("/{entry_id}", response_model=schemas.LedgerEntry)
def get_entry(entry_id: str, db: Session = Depends(get_db)) -> schemas.LedgerEntry:
    return presentation.present_one(db, repository.get_ledger_row(db, entry_id))


@router.post("/notes", response_model=schemas.NoteResult, status_code=201, summary="Append a note (supplier check, proposed experiment)")
def add_note(body: schemas.NoteRequest, db: Session = Depends(get_db)) -> schemas.NoteResult:
    return schemas.NoteResult(entry=ledger.log_note(db, body))
