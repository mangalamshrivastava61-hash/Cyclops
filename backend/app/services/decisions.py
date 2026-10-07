"""Decisions: assembling what a page needs, and the planner's actions on them.

A decision record is what ORACLE issued and never changes. Approve, modify and reject write the
planner's action and append a ledger entry in one transaction.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from .. import models, repository, schemas
from . import ledger, policy
from .errors import Conflict
from .forecast import get_forecast_provider
from .formatting import reason_label


@dataclass
class Bundle:
    row: models.Decision
    decision: schemas.Decision
    product: schemas.Product
    forecast: schemas.Forecast
    evidence: schemas.EvidenceReport | None
    authority: schemas.AuthorityRecord | None
    policy: policy.PolicyInput
    action: schemas.DecisionAction

    @property
    def can_stress(self) -> bool:
        return can_stress(self.row)

    def as_schema(self) -> schemas.DecisionBundle:
        return schemas.DecisionBundle(
            decision=self.decision,
            product=self.product,
            forecast=self.forecast,
            evidence=self.evidence,
            authority=self.authority,
            policy=self.policy.as_schema(),
            action=self.action,
            can_stress=self.can_stress,
            has_evidence=self.evidence is not None,
        )


def can_stress(row: models.Decision) -> bool:
    """Break My Plan applies to live orders; not to markdowns, no-order weeks or benched SKUs."""
    return row.action == "order" and row.circuit != "bench"


def load(db: Session, decision_id: str) -> Bundle:
    row = repository.get_decision_row(db, decision_id)
    action = repository.get_action(db, decision_id)
    product = repository.get_product(db, row.sku)
    forecast = get_forecast_provider().forecast_for(db, row)
    decision = repository.to_decision(row, action)
    return Bundle(
        row=row,
        decision=decision,
        product=product,
        forecast=forecast,
        evidence=repository.get_evidence(db, decision_id),
        authority=repository.get_authority_record(db, row.sku),
        policy=policy.policy_input(decision, forecast, product),
        action=action,
    )


def summaries(db: Session) -> list[schemas.DecisionSummary]:
    actions = repository.list_actions(db)
    names = {p.sku: p.name for p in repository.list_products(db)}
    with_evidence = repository.evidence_decision_ids(db)
    return [
        schemas.DecisionSummary(
            id=r.id,
            sku=r.sku,
            name=names[r.sku],
            action=r.action,
            recommended_order=r.recommended_order,
            fallback_order=r.fallback_order,
            circuit=r.circuit,
            current=actions[r.id],
            can_stress=can_stress(r),
            has_evidence=r.id in with_evidence,
        )
        for r in repository.list_decision_rows(db)
    ]


# ── planner actions ────────────────────────────────────────────────────────────


def _require_actionable(b: Bundle) -> None:
    if b.action.status != "pending":
        raise Conflict(f"Decision #{b.row.id} is already {b.action.status}. Reset the simulation to act on it again.")
    if b.row.circuit == "bench":
        raise Conflict(f"ORACLE is benched for SKU {b.row.sku}; the fallback rule orders {b.row.fallback_order} until the gate clears.")


def _commit(db: Session, decision_id: str, action: schemas.DecisionAction, entry: models.LedgerEntry) -> schemas.MutationResult:
    from .presentation import present_one

    repository.save_action(db, decision_id, action)
    db.commit()
    return schemas.MutationResult(action=action, entry=present_one(db, entry))


def approve(db: Session, decision_id: str) -> schemas.MutationResult:
    with ledger.WRITE_LOCK:
        b = load(db, decision_id)
        _require_actionable(b)
        planner = repository.get_world(db).planner
        sku, name, qty = b.row.sku, b.product.name, b.action.quantity
        if b.row.action == "markdown":
            texts = dict(eyebrow=f"ACKNOWLEDGED · SKU {sku} · #{decision_id}", title=f"{name} — markdown advice acknowledged", meta=f"Acknowledged by {planner} · advice only, nothing is repriced", chip={"label": "ADVISORY · ACKNOWLEDGED", "kind": "advisory"})
        elif b.row.action == "none":
            texts = dict(eyebrow=f"APPROVAL · SKU {sku} · #{decision_id}", title=f"{name} — no order confirmed", meta=f"Confirmed by {planner} · sealed to #{decision_id}", chip={"label": "REVIEW · APPROVED", "kind": "review"})
        else:
            texts = dict(eyebrow=f"APPROVAL · SKU {sku} · #{decision_id}", title=f"{name} — {qty} approved", meta=f"Approved by {planner} · sealed to #{decision_id}", chip={"label": "REVIEW · APPROVED", "kind": "review"})
        entry = ledger.append(db, kind="approval", sku=sku, decision_id=decision_id, **texts)
        action = schemas.DecisionAction(status="approved", quantity=qty, at=entry.at, by=planner)
        return _commit(db, decision_id, action, entry)


def modify(db: Session, decision_id: str, req: schemas.ModifyRequest) -> schemas.MutationResult:
    with ledger.WRITE_LOCK:
        b = load(db, decision_id)
        _require_actionable(b)
        if b.row.action == "markdown":
            raise Conflict("Markdown advice can only be acknowledged, not modified.")
        if req.quantity == b.row.recommended_order:
            raise Conflict(f"{req.quantity} is ORACLE's own recommendation; approve it instead.")
        planner = repository.get_world(db).planner
        rec = b.row.recommended_order
        entry = ledger.append(
            db,
            kind="modification",
            sku=b.row.sku,
            decision_id=decision_id,
            eyebrow=f"OVERRIDE · SKU {b.row.sku} · {reason_label(req.reason).upper()}",
            title=f"{b.product.name} — {rec} → {req.quantity}",
            meta=f"{planner} · scored against {rec} after delivery",
            quote=req.note.strip() or None,
            chip={"label": "REVIEW · MODIFIED", "kind": "review"},
        )
        action = schemas.DecisionAction(status="modified", quantity=req.quantity, reason=req.reason, note=req.note.strip() or None, at=entry.at, by=planner)
        return _commit(db, decision_id, action, entry)


def reject(db: Session, decision_id: str, req: schemas.RejectRequest) -> schemas.MutationResult:
    with ledger.WRITE_LOCK:
        b = load(db, decision_id)
        _require_actionable(b)
        if b.row.action == "markdown":
            raise Conflict("Markdown advice can only be acknowledged, not rejected.")
        planner = repository.get_world(db).planner
        entry = ledger.append(
            db,
            kind="rejection",
            sku=b.row.sku,
            decision_id=decision_id,
            eyebrow=f"REJECTION · SKU {b.row.sku} · #{decision_id}",
            title=f"{b.product.name} — {b.action.quantity} rejected",
            meta=f"{req.reason.strip()} · the fallback rule orders {b.row.fallback_order}",
            chip={"label": "REJECTED", "kind": "advisory"},
        )
        action = schemas.DecisionAction(status="rejected", quantity=b.row.fallback_order, reason=req.reason.strip(), at=entry.at, by=planner)
        return _commit(db, decision_id, action, entry)
