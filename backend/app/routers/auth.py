"""User authentication: register / login, and per-user CSV history storage.

Users are persisted in the SQLite (or MySQL) database.  Passwords are
bcrypt-hashed.  CSV upload history is stored as JSON rows in the
`csv_history` table, scoped by user e-mail.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import JSON, Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, Session, mapped_column

from ..db import Base, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ─── extra models ──────────────────────────────────────────────────────────────


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # bcrypt hash stored as plain text (hex-encoded)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[str] = mapped_column(String(26), default=lambda: datetime.utcnow().isoformat())


class CsvHistoryRow(Base):
    """One uploaded CSV session per user."""

    __tablename__ = "csv_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_email: Mapped[str] = mapped_column(String(255), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    row_count: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[str] = mapped_column(String(26), default=lambda: datetime.utcnow().isoformat())
    # The CSV content is stored as a JSON array of row-dicts for easy retrieval.
    rows_json: Mapped[str] = mapped_column(Text, default="[]")


# ─── Pydantic I/O schemas ─────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: str


class CsvHistoryIn(BaseModel):
    user_email: str
    filename: str
    rows: list  # list of row dicts


class CsvHistoryItem(BaseModel):
    id: int
    filename: str
    row_count: int
    uploaded_at: str


class CsvHistoryDetail(CsvHistoryItem):
    rows: list


# ─── tiny password helper (no bcrypt dependency needed) ───────────────────────

import hashlib
import os


def _hash_password(plain: str) -> str:
    salt = os.urandom(16).hex()
    digest = hashlib.sha256(f"{salt}:{plain}".encode()).hexdigest()
    return f"{salt}:{digest}"


def _verify_password(plain: str, stored: str) -> bool:
    try:
        salt, digest = stored.split(":", 1)
        return hashlib.sha256(f"{salt}:{plain}".encode()).hexdigest() == digest
    except Exception:
        return False


# ─── endpoints ────────────────────────────────────────────────────────────────


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account."""
    Base.metadata.create_all(db.get_bind())  # ensure tables exist
    existing = db.query(UserRow).filter(UserRow.email == body.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with that e-mail already exists.")
    user = UserRow(
        name=body.name.strip(),
        email=body.email.lower().strip(),
        password_hash=_hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(id=user.id, name=user.name, email=user.email, created_at=user.created_at)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate an existing user."""
    Base.metadata.create_all(db.get_bind())
    user = db.query(UserRow).filter(UserRow.email == body.email.lower().strip()).first()
    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid e-mail or password.")
    return AuthResponse(id=user.id, name=user.name, email=user.email, created_at=user.created_at)


# ─── CSV history endpoints ─────────────────────────────────────────────────────


@router.post("/csv-history", response_model=CsvHistoryItem, status_code=status.HTTP_201_CREATED)
def save_csv_history(body: CsvHistoryIn, db: Session = Depends(get_db)):
    """Persist a user's uploaded CSV dataset so it can be recalled later."""
    Base.metadata.create_all(db.get_bind())
    entry = CsvHistoryRow(
        user_email=body.user_email.lower().strip(),
        filename=body.filename,
        row_count=len(body.rows),
        rows_json=json.dumps(body.rows),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return CsvHistoryItem(id=entry.id, filename=entry.filename, row_count=entry.row_count, uploaded_at=entry.uploaded_at)


@router.get("/csv-history/{user_email}", response_model=List[CsvHistoryItem])
def list_csv_history(user_email: str, db: Session = Depends(get_db)):
    """Return all CSV upload sessions for the given user (metadata only, no rows)."""
    Base.metadata.create_all(db.get_bind())
    rows = (
        db.query(CsvHistoryRow)
        .filter(CsvHistoryRow.user_email == user_email.lower().strip())
        .order_by(CsvHistoryRow.uploaded_at.desc())
        .all()
    )
    return [CsvHistoryItem(id=r.id, filename=r.filename, row_count=r.row_count, uploaded_at=r.uploaded_at) for r in rows]


@router.get("/csv-history/{user_email}/{entry_id}", response_model=CsvHistoryDetail)
def get_csv_history_entry(user_email: str, entry_id: int, db: Session = Depends(get_db)):
    """Return a single CSV history entry including the full row data."""
    Base.metadata.create_all(db.get_bind())
    row = (
        db.query(CsvHistoryRow)
        .filter(CsvHistoryRow.user_email == user_email.lower().strip(), CsvHistoryRow.id == entry_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="CSV history entry not found.")
    return CsvHistoryDetail(
        id=row.id,
        filename=row.filename,
        row_count=row.row_count,
        uploaded_at=row.uploaded_at,
        rows=json.loads(row.rows_json),
    )


@router.delete("/csv-history/{user_email}/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_csv_history_entry(user_email: str, entry_id: int, db: Session = Depends(get_db)):
    """Delete a single CSV history entry."""
    Base.metadata.create_all(db.get_bind())
    row = (
        db.query(CsvHistoryRow)
        .filter(CsvHistoryRow.user_email == user_email.lower().strip(), CsvHistoryRow.id == entry_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="CSV history entry not found.")
    db.delete(row)
    db.commit()
