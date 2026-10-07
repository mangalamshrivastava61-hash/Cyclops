"""The decision ledger: append-only and hash-chained.

Every write takes ``WRITE_LOCK`` so sequence numbers and the chain stay consistent; callers commit
inside the lock. Each new entry's hash covers its content and the previous entry's hash, so editing
or deleting any app-written record breaks ``verify()``.
"""

import json
import threading
from typing import Any

from sqlalchemy.orm import Session

from .. import models, repository, schemas
from .formatting import now_on_world_day

WRITE_LOCK = threading.RLock()


def short_hash(text: str) -> str:
    """Two FNV-1a passes → 'ABCD…EF12', the short form every receipt shows."""
    data = text.encode("utf-8")

    def fnv(seed: int) -> str:
        h = seed & 0xFFFFFFFF
        for byte in data:
            h ^= byte
            h = (h * 16777619) & 0xFFFFFFFF
        return f"{h:08X}"

    return f"{fnv(2166136261)[:4]}…{fnv(0x9E3779B9)[-4:]}"


def _body(row: models.LedgerEntry) -> dict[str, Any]:
    return {
        "seq": row.seq,
        "id": row.id,
        "at": row.at,
        "kind": row.kind,
        "sku": row.sku,
        "decisionId": row.decision_id,
        "eyebrow": row.eyebrow,
        "title": row.title,
        "meta": row.meta,
        "quote": row.quote,
        "chip": row.chip,
        "link": row.link,
        "receipt": row.receipt,
    }


def _hash(prev_hash: str, row: models.LedgerEntry) -> str:
    return short_hash(prev_hash + "|" + json.dumps(_body(row), sort_keys=True, ensure_ascii=False, separators=(",", ":")))


def append(
    db: Session,
    *,
    kind: str,
    eyebrow: str,
    title: str,
    meta: str,
    sku: str | None = None,
    decision_id: str | None = None,
    quote: str | None = None,
    chip: dict[str, str] | None = None,
    link: dict[str, str] | None = None,
    receipt: list[list[dict[str, str]]] | None = None,
) -> models.LedgerEntry:
    """Add the next entry to the session. Call inside ``WRITE_LOCK`` and commit before releasing it."""
    last = repository.last_ledger_row(db)
    world = repository.get_world(db)
    row = models.LedgerEntry(
        seq=last.seq + 1,
        id=str(last.seq + 1),
        at=now_on_world_day(world.today),
        kind=kind,
        sku=sku,
        decision_id=decision_id,
        eyebrow=eyebrow,
        title=title,
        meta=meta,
        quote=quote or None,
        chip=chip,
        link=link,
        receipt=receipt,
        prev_hash=last.hash,
        origin="app",
    )
    row.hash = _hash(last.hash, row)
    db.add(row)
    db.flush()
    return row


def verify(db: Session) -> schemas.LedgerVerify:
    rows = repository.list_ledger_rows(db)
    broken = None
    for i, row in enumerate(rows):
        linked = i == 0 or row.prev_hash == rows[i - 1].hash
        intact = row.origin != "app" or row.hash == _hash(row.prev_hash, row)
        if not (linked and intact):
            broken = row.id
            break
    return schemas.LedgerVerify(ok=broken is None, length=len(rows), last_hash=rows[-1].hash if rows else "", broken_at=broken)


def log_note(db: Session, req: schemas.NoteRequest) -> schemas.LedgerEntry:
    from .presentation import present_one

    if req.decision_id:
        repository.get_decision_row(db, req.decision_id)  # 404 for unknown decisions
    with WRITE_LOCK:
        row = append(db, kind=req.kind, eyebrow=req.eyebrow, title=req.title, meta=req.meta, sku=req.sku, decision_id=req.decision_id)
        db.commit()
    return present_one(db, row)
