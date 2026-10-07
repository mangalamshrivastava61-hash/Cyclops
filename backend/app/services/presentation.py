"""How ledger entries read right now.

Entries are stored once and never edited. What changes is how a decision entry presents: its status
chip, its meta line and its receipt reflect what the planner has since done with that decision.
"""

from sqlalchemy.orm import Session

from .. import models, repository, schemas
from . import policy
from .decisions import Bundle, can_stress, load
from .formatting import clock, day_label, js_round, money, short_date, signed_money


class _Context:
    """Per-request cache: each decision bundle is loaded once."""

    def __init__(self, db: Session):
        self.db = db
        self.world = repository.get_world(db)
        self.circuit = repository.get_circuit(db)
        self.levels = {lvl.level: lvl for lvl in repository.list_levels(db)}
        self._bundles: dict[str, Bundle | None] = {}

    def bundle(self, decision_id: str) -> Bundle | None:
        if decision_id not in self._bundles:
            try:
                self._bundles[decision_id] = load(self.db, decision_id)
            except Exception:  # an entry may reference a decision outside this dataset
                self._bundles[decision_id] = None
        return self._bundles[decision_id]


def present_all(db: Session) -> list[schemas.LedgerEntry]:
    ctx = _Context(db)
    return [_present(ctx, row) for row in repository.list_ledger_rows(db)]


def present_one(db: Session, row: models.LedgerEntry) -> schemas.LedgerEntry:
    return _present(_Context(db), row)


def _present(ctx: _Context, row: models.LedgerEntry) -> schemas.LedgerEntry:
    b = ctx.bundle(row.decision_id) if row.decision_id else None
    chip = row.chip
    meta = row.meta
    receipt = row.receipt
    receipt_authority = None
    links = schemas.EntryLinks()
    if b:
        links = schemas.EntryLinks(evidence=b.evidence is not None, stress=can_stress(b.row))
        chip, meta = _live_status(row, b, ctx.world.planner)
        receipt, receipt_authority = _receipt(ctx, b)
    return schemas.LedgerEntry(
        id=row.id,
        seq=row.seq,
        at=row.at,
        kind=row.kind,
        sku=row.sku,
        decision_id=row.decision_id,
        eyebrow=row.eyebrow,
        title=row.title,
        meta=meta,
        quote=row.quote,
        chip=chip,
        link=row.link,
        receipt=receipt,
        receipt_authority=receipt_authority,
        links=links,
        hash=row.hash,
        prev_hash=row.prev_hash,
    )


def _live_status(row: models.LedgerEntry, b: Bundle, planner: str) -> tuple[dict | None, str]:
    """An order entry that was waiting for review shows what happened to it since."""
    chip, meta = row.chip, row.meta
    if row.kind != "order" or not chip or chip.get("kind") != "review":
        return chip, meta
    a = b.action
    labels = {"approved": ("Review · approved", "review"), "modified": ("Review · modified", "review"), "rejected": ("Rejected", "advisory"), "pending": ("Review · waiting", "review")}
    label, kind = labels[a.status]
    chip = {"label": label, "kind": kind}
    if b.row.seed_status == "pending" and a.status != "pending":
        who = a.by or planner
        if a.status == "approved":
            meta = f"{_grades_short(b)} · approved {clock(a.at) if a.at else ''} by {who}"
        elif a.status == "modified":
            meta = f"Modified to {a.quantity} by {who}"
        else:
            meta = f"Rejected · the fallback orders {b.row.fallback_order}"
    return chip, meta


def _grades_short(b: Bundle) -> str:
    if not b.evidence:
        return "Evidence pending"
    grades = [g.grade for g in b.evidence.grades]
    parts = [f"{grades.count('pass')} pass"] + ([f"{grades.count('partial')} partial"] if "partial" in grades else [])
    return " · ".join(parts)


def _grade_summary(grades: list[str]) -> str:
    order = ["pass", "partial", "insufficient", "failed"]
    return " · ".join(f"{grades.count(g)} {g}" for g in order if grades.count(g))


def _receipt(ctx: _Context, b: Bundle) -> tuple[list[list[dict]], dict]:
    d, p, f, a = b.row, b.product, b.forecast, b.action
    planner = ctx.world.planner
    if d.action == "markdown":
        groups = [
            [
                {"label": "SKU", "value": f"{p.sku} · {p.name}"},
                {"label": "Action", "value": "Markdown 20% (advice)", "emphasis": "decision"},
                {"label": "On hand", "value": f"{d.on_hand} units · {f.cover_days_now:g} days cover"},
                {"label": f"Demand · {f.horizon_days} d", "value": f"{f.p10:g} · {f.p50:g} · {f.p90:g}"},
            ],
            [
                {"label": "Evidence", "value": _grade_summary([g.grade for g in b.evidence.grades]) if b.evidence else "—"},
                {"label": "Authority", "value": "L1 · Advisory"},
                {"label": "Acknowledged", "value": f"{a.by or planner} · {clock(a.at) if a.at else ''}" if a.status == "approved" else "Not yet"},
            ],
        ]
        return groups, {"label": "L1 · Advisory", "kind": "advisory"}

    benched = d.circuit == "bench"
    qty = d.fallback_order if a.status == "rejected" or benched else a.quantity
    pos = js_round(policy.position(b.policy, qty))
    risk = policy.stockout_risk(b.policy, qty)
    contribution = policy.contribution_for(b.policy, qty, d.recommended_order, d.expected_contribution)
    lvl = 1 if benched else d.authority
    short = ctx.levels[lvl].short if lvl in ctx.levels else ""
    approval = {
        "approved": f"{a.by or planner} · {clock(a.at) if a.at else ''}",
        "modified": f"{a.by or planner} · modified {clock(a.at) if a.at else ''}",
        "rejected": f"Rejected · {clock(a.at) if a.at else ''}",
    }.get(a.status, "Awaiting review")
    if d.action == "none" and qty == 0:
        action_line = "No order"
    elif benched or a.status == "rejected":
        action_line = f"Fallback orders {qty} units"
    elif a.status == "modified":
        action_line = f"Order {qty} units (ORACLE {d.recommended_order})"
    else:
        action_line = f"Order {qty} units"
    vs = f"{signed_money(d.contribution_vs_fallback)} vs fallback" if qty == d.recommended_order else f"{signed_money(contribution - d.expected_contribution)} vs ORACLE"
    groups = [
        [
            {"label": "SKU", "value": f"{p.sku} · {p.name}"},
            {"label": "Action", "value": action_line, "emphasis": "decision"},
            {"label": "Arrives", "value": f"{day_label(d.arrival)} · {p.lead_time_days}-day lead"},
            {"label": "Fallback", "value": f"{d.fallback_order} units"},
            {"label": f"Demand · {f.horizon_days} d", "value": f"{f.p10:g} · {f.p50:g} · {f.p90:g}"},
            {"label": "Position", "value": f"{d.on_hand} + {d.on_order} + {qty} = {pos}"},
            {"label": "Stockout risk", "value": f"{js_round(risk * 100)}%"},
            {"label": "Contribution", "value": f"{money(contribution)} {vs}"},
        ],
        [
            {"label": "Evidence", "value": _grade_summary([g.grade for g in b.evidence.grades]) if b.evidence else "4 pass"},
            {"label": "Authority", "value": f"L{lvl} {short}"},
            {"label": "Circuit", "value": "Bench · in-stock gate" if benched else f"Clear since {short_date(ctx.circuit.since)}"},
            {"label": "Approval", "value": approval, **({"emphasis": "strong"} if a.status != "pending" else {})},
        ],
    ]
    kind = "bench" if benched else "advisory" if lvl <= 1 else "review" if lvl == 2 else "act"
    return groups, {"label": f"L{lvl} · {short}", "kind": kind}
