"""Ask ORACLE: grounded, read-only answers from records. No language model, no ML.

Each intent reads structured records (decision, forecast, evidence, authority, circuit, the policy)
and composes an answer that cites them inline. A question no record covers gets "No record, no
answer." This is the slot where a retrieval-backed language model can later replace the intent
rules, keeping the same request and response shape.

Inline markup in text blocks: **strong**, ==decision== (gold tint), [[sourceId]] (citation).
"""

import re
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy.orm import Session

from .. import repository, schemas
from . import authority as authority_svc
from . import policy, scenarios
from .decisions import Bundle, load
from .formatting import clock, day_label, join_and, js_round, lower_first, now_on_world_day, pct, reason_label, short_date

T = schemas.TextBlock
FOLLOW_UPS = {
    "lead": ("What if the lead time slips 2 days?", "What if the lead time slips 2 days?"),
    "fallback": ("Why not the fallback of 97?", "Why not the fallback of 97?"),
    "l3": ("When does it earn L3 again?", "When does it earn L3 again?"),
    "observability": ("Which days did it sell out?", "Which days did it sell out?"),
    "why": ("Why 127?", "Why did ORACLE recommend 127 units?"),
    "circuit": ("Is the circuit clear?", "Is the decision circuit clear?"),
    "stress": ("How fragile is 127?", "How fragile is 127 under stress?"),
    "status": ("Has it been approved?", "Has decision #18513 been approved?"),
    "slide": ("Why is Slide Pro benched?", "Why is Slide Pro benched?"),
}


def _fu(key: str) -> schemas.FollowUp:
    label, question = FOLLOW_UPS[key]
    return schemas.FollowUp(label=label, question=question)


def _link(label: str, href: str) -> schemas.FollowUp:
    return schemas.FollowUp(label=label, href=href)


SUGGESTIONS = [_fu(k) for k in ["why", "lead", "fallback", "l3", "observability", "circuit", "status", "slide"]]
DEFAULT_QUESTION = FOLLOW_UPS["why"][1]


@dataclass
class Ctx:
    db: Session
    primary: Bundle
    sim: schemas.Simulation
    circuit: schemas.CircuitRecord
    authority_level: int

    def grade(self, grade_id: str) -> schemas.EvidenceGrade | None:
        ev = self.primary.evidence
        return next((g for g in ev.grades if g.id == grade_id), None) if ev else None


Answer = tuple[str, str | None, list, list[schemas.AskSource], list[schemas.FollowUp]]


def _sources(ctx: Ctx, keys: list[str]) -> list[schemas.AskSource]:
    b = ctx.primary
    d, f = b.decision, b.forecast
    coverage = ctx.grade("forecast")
    observ = ctx.grade("observability")
    value = ctx.grade("value")
    sold_out = sum(1 for h in f.history if h.sold_out)
    hidden = observ.measure.hidden_share if observ and observ.measure.kind == "observability" else 0
    cov = coverage.measure if coverage and coverage.measure.kind == "coverage" else None
    val = value.measure if value and value.measure.kind == "value" else None
    restore = b.evidence.restore if b.evidence else None
    record = b.authority
    all_sources = {
        "decision": schemas.AskSource(id="decision", title=f"Decision #{d.id}", detail=f"Order {d.recommended_order} · {day_label(d.created_at)}, {clock(d.created_at)}", href=f"/decision/{d.id}"),
        "forecast": schemas.AskSource(id="forecast", title=f"Forecast {f.id}", detail=f"{f.horizon_days} days · P10 {f.p10:g} · P50 {f.p50:g} · P90 {f.p90:g}", href=f"/decision/{d.id}"),
        "observability": schemas.AskSource(id="observability", title="Observability", detail=f"{sold_out} sell-outs in {len(f.history)} days · {js_round(hidden * 100)}% hidden", href=f"/evidence/{d.id}", grade=observ.grade if observ else None),
        "probes": schemas.AskSource(id="probes", title=(coverage.records[0] if coverage else "Probe set"), detail=f"Coverage {cov.value:g}% · target {cov.target:g} ± {cov.tolerance:g}" if cov else "Coverage", href=f"/evidence/{d.id}"),
        "value": schemas.AskSource(id="value", title=(value.records[0] if value else "Holdout"), detail=f"Decision value {val.point:+g}% · interval {val.low:+g} to {val.high:+g}" if val else "Decision value", href=f"/evidence/{d.id}", grade=value.grade if value else None),
        "authority": schemas.AskSource(id="authority", title=f"Authority record · SKU {d.sku}", detail=f"{len(record.history)} weeks · earned level L{record.earned_level}" if record else "No record", href=f"/authority/{d.sku}"),
        "circuit": schemas.AskSource(id="circuit", title=f"Decision circuit · {ctx.circuit.scope.split(' · ')[0]}", detail=f"Live state {ctx.circuit.live_state} since {short_date(ctx.circuit.since)}", href="/circuit"),
        "experiment": schemas.AskSource(id="experiment", title=f"Experiment {restore.experiment_id}" if restore else "Experiment", detail=f"Demand probes · {restore.scope.split(' · ')[0]} · {restore.weeks} weeks" if restore else "", href=f"/evidence/{d.id}"),
        "scenario": schemas.AskSource(id="scenario", title="Scenario engine", detail=f"Replenishment policy · critical ratio {d.critical_ratio:.2f}", href=f"/break-my-plan/{d.id}"),
        "ledger": schemas.AskSource(id="ledger", title="Decision ledger", detail="Append-only · chained records", href=f"/ledger?entry={d.id}"),
    }
    return [all_sources[k] for k in keys]


def _has(q: str, words: list[str]) -> int:
    return sum(1 for w in words if w in q)


def _other_decision(ctx: Ctx, q: str):
    for row in repository.list_decision_rows(ctx.db):
        if row.id == ctx.primary.row.id:
            continue
        name = repository.get_product(ctx.db, row.sku).name.lower()
        first = name.split(" ")[0]
        if name in q or row.id in q or re.search(rf"\b{row.sku}\b", q) or re.search(rf"\b{re.escape(first)}\b", q):
            return row
    return None


# ── intents ────────────────────────────────────────────────────────────────────


def _refuse(ctx: Ctx, q: str) -> Answer:
    d = ctx.primary.row.id
    blocks = [
        schemas.RefusalBlock(text="I can't place, change or approve an order. That stays with you."),
        T(text=f"Decision #{d} is open on the decision page: approve, modify or reject it there.[[decision]] Whatever you choose is written to the ledger, with your name and the time.[[ledger]]", tone="secondary"),
    ]
    return "refuse-action", d, blocks, _sources(ctx, ["decision", "ledger"]), [_link(f"Open decision #{d}", f"/decision/{d}"), _fu("why")]


def _other(ctx: Ctx, q: str) -> Answer:
    row = _other_decision(ctx, q)
    b = load(ctx.db, row.id)
    d, p, f, ev, a = b.row, b.product, b.forecast, b.evidence, b.action
    srcs = [schemas.AskSource(id="decision", title=f"Decision #{d.id}", detail=f"{p.name} · SKU {p.sku} · {day_label(d.created_at)}, {clock(d.created_at)}", href=f"/decision/{d.id}")]
    srcs.append(schemas.AskSource(id="forecast", title=f"Forecast {f.id}", detail=f"{f.horizon_days} days · P10 {f.p10:g} · P50 {f.p50:g} · P90 {f.p90:g}", href=f"/decision/{d.id}"))
    if ev:
        srcs.append(schemas.AskSource(id="evidence", title=f"Evidence {ev.id}", detail=ev.rule, href=f"/evidence/{d.id}"))
    if d.circuit == "bench":
        srcs.append(schemas.AskSource(id="circuit", title="Decision circuit · Footwear", detail="Benched for this SKU", href="/circuit"))
    srcs.append(schemas.AskSource(id="ledger", title="Decision ledger", detail="Append-only · chained records", href=f"/ledger?entry={d.id}"))
    if d.circuit == "bench":
        first = f"ORACLE suggested {d.recommended_order} for {p.name}, but it is **benched** for this SKU, so the fallback rule orders **{d.fallback_order} units**.[[decision]][[circuit]]"
        trigger = d.rationale.split(". ")[0]
        rest = f"The trigger: {lower_first(trigger) if trigger.startswith('A ') else trigger}."
    elif d.action == "markdown":
        first, rest = f"ORACLE suggests a ==20% markdown== on {p.name}, shown as advice only.[[decision]]", d.rationale
    elif d.action == "none":
        first, rest = f"ORACLE recommends ==no order== for {p.name} this week, against a fallback of {d.fallback_order}.[[decision]]", d.rationale
    else:
        first, rest = f"ORACLE recommends =={d.recommended_order} units== of {p.name}, against a fallback of {d.fallback_order}.[[decision]]", d.rationale
    if a.status == "pending":
        status = "It is waiting for your review."
    elif a.status == "approved":
        status = f"It was approved{f' at {clock(a.at)}' if a.at else ''}{f' by {a.by}' if a.by else ''}."
    elif a.status == "modified":
        status = f"It was modified to **{a.quantity} units**{f' ({reason_label(a.reason).lower()})' if a.reason else ''}.{f' “{a.note}”' if a.note else ''}"
    else:
        status = f"It was rejected; the fallback orders {d.fallback_order}."
    second = f"{status}[[ledger]] Forecast demand over {f.horizon_days} days is {f.p10:g} to {f.p90:g} pairs.[[forecast]]" + (f" {ev.rule}[[evidence]]" if ev else "")
    blocks = [T(text=f"{first} {rest}"), T(text=second, tone="secondary")]
    if d.circuit == "bench":
        follow = [_link(f"Open decision #{d.id}", f"/decision/{d.id}"), _link("Open the circuit", "/circuit"), _fu("circuit")]
    else:
        follow = [_link(f"Open decision #{d.id}", f"/decision/{d.id}")] + ([_link("Open the evidence", f"/evidence/{d.id}")] if ev else []) + [_fu("why")]
    return "other-decision", d.id, blocks, srcs, follow


def _why(ctx: Ctx, q: str) -> Answer:
    b = ctx.primary
    d, f, a = b.row, b.forecast, b.action
    if a.status == "pending":
        close = "the partial grade is why this order waits for your review."
    else:
        to = f" to {a.quantity}" if a.status == "modified" else ""
        close = f"the partial grade is why the order waited for review. It was {a.status}{to}{f' at {clock(a.at)}' if a.at else ''}."
    _, cu, co = policy.critical_ratio(b.policy)
    ratio = js_round(cu / co)
    history = f.history
    sold_out = sum(1 for h in history if h.sold_out)
    blocks = [
        T(text=f"Expected demand over the next {f.horizon_days} days — the {b.product.lead_time_days}-day lead time plus the weekly review cycle — is **{f.p10:g} to {f.p90:g} units**.[[forecast]] You have {d.on_hand} on hand and {d.on_order} on order, and a stockout costs about {_times(ratio)} more than a leftover pair, so ORACLE targets {d.target_position}: =={d.recommended_order} more units==.[[decision]]"),
        schemas.EquationBlock(
            parts=[schemas.EquationPart(value=str(d.target_position), label="target"), schemas.EquationPart(value=str(d.on_hand), label="on hand"), schemas.EquationPart(value=str(d.on_order), label="on order")],
            result=schemas.EquationResult(value=str(d.recommended_order), label="this order"),
        ),
        T(text=f"One caution: demand observability is partial. This SKU sold out on {sold_out} of the last {len(history)} days, so recent sales understate demand.[[observability]] Forecast coverage is on target[[probes]] — {close}"),
        schemas.FigureBlock(figure="distribution"),
        schemas.FigureBlock(figure="position"),
        schemas.FigureBlock(figure="sales"),
    ]
    return "why", d.id, blocks, _sources(ctx, ["decision", "forecast", "observability", "probes"]), [_fu("lead"), _fu("fallback"), _fu("l3")]


def _times(n: int) -> str:
    words = {2: "twice", 3: "three times", 4: "four times", 5: "five times", 6: "six times", 7: "seven times", 8: "eight times"}
    return words.get(n, f"{n} times")


def _lead(ctx: Ctx, q: str) -> Answer:
    b = ctx.primary
    keep = b.row.recommended_order
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:extra\s*|more\s*)?days?", q)
    extra = max(0.5, min(6.0, float(m.group(1)))) if m else 2.0
    r = policy.solve(b.policy, policy.stress(leadTime=extra), keep)
    flip = policy.flip_point(b.policy, policy.NEUTRAL, "leadTime", keep, 0, 6)
    base = pct(policy.stockout_risk(b.policy, keep))
    lead = b.product.lead_time_days
    flip_text = f"The decision flips at a lead time of **{lead + flip:.1f} days**: past that, {keep} is no longer the right order." if flip is not None else "Within six extra days the decision does not flip."
    blocks = [
        T(text=f"If the supplier takes **{_num(lead + extra)} days** instead of {lead}, demand has to be covered for {_num(b.forecast.horizon_days + extra)} days instead of {b.forecast.horizon_days}, and the best order becomes =={r.order} units==.[[scenario]][[forecast]]"),
        T(text=f"Keeping {keep} would raise the chance of selling out from **{base}** to **{pct(r.risk_if_keep)}**.[[scenario]] {flip_text}[[decision]]"),
        schemas.FigureBlock(figure="flip", lead=extra),
    ]
    return "lead", b.row.id, blocks, _sources(ctx, ["scenario", "forecast", "decision"]), [_link("Open Break My Plan", f"/break-my-plan/{b.row.id}"), _fu("fallback"), _fu("why")]


def _num(v: float) -> str:
    return f"{v:g}"


def _fallback(ctx: Ctx, q: str) -> Answer:
    b = ctx.primary
    d = b.row
    fb = d.fallback_order
    gap = js_round((policy.expected_cost(b.policy, fb) - policy.expected_cost(b.policy, d.recommended_order)) / 10) * 10
    value = ctx.grade("value")
    val = value.measure if value and value.measure.kind == "value" else None
    blocks = [
        T(text=f"The fallback — a {d.fallback_rule.lower()} — would buy **{fb}**. That stops the position at {js_round(policy.position(b.policy, fb))}, barely above the expected {b.forecast.p50:g} and far short of the upper range.[[decision]][[forecast]]"),
        T(text=f"Its chance of selling out is **{pct(policy.stockout_risk(b.policy, fb))}**, against {pct(policy.stockout_risk(b.policy, d.recommended_order))} with =={d.recommended_order}==. On expected cost the fallback gives up about ${gap}.[[scenario]]"),
    ]
    if val:
        blocks.append(T(text=f"ORACLE only replaces the fallback where the evidence says it earns it: on holdouts it added **{val.point:+g}%** contribution, interval {val.low:+g} to {val.high:+g}.[[value]]", tone="secondary"))
    blocks += [schemas.FigureBlock(figure="position"), schemas.FigureBlock(figure="distribution")]
    return "fallback", d.id, blocks, _sources(ctx, ["decision", "forecast", "scenario", "value"]), [_fu("why"), _fu("lead"), _fu("stress")]


def _authority(ctx: Ctx, q: str) -> Answer:
    b = ctx.primary
    record = b.authority
    levels = {lvl.level: lvl for lvl in repository.list_levels(ctx.db)}
    lvl = levels[ctx.authority_level]
    capped = {"bench": " The circuit is benched, which caps it at L1 for now.", "review": " The circuit is in review, which caps it at L2."}.get(ctx.sim.circuit, "")
    held = [h.week for h in record.history if h.level == 3] if record else []
    recent = []
    for w in reversed(held):
        if not recent or recent[-1] - w == 1:
            recent.append(w)
        else:
            break
    recent.reverse()
    now_week = record.history[-1].week if record else 0
    held_text = f"It held L3 in weeks {join_and([str(w) for w in recent])}, then dropped to L{record.history[-1].level} in week {now_week} when observability was graded **partial**." if recent else "Observability is graded **partial**."
    blocks = [
        T(text=f"ORACLE is at ==L{lvl.level} · {lvl.short}== for this SKU. {lvl.detail}{capped}[[authority]]"),
        T(text=f"{held_text}[[observability]] {record.earn.detail}[[authority]]"),
        T(text=f"To earn L3 again: {lower_first(record.earn.headline)} Demand probes would measure the hidden demand instead of estimating it.[[experiment]] It loses authority {lower_first(record.lose.headline)}", tone="secondary"),
        schemas.FigureBlock(figure="authority"),
    ]
    return "authority", b.row.id, blocks, _sources(ctx, ["authority", "observability", "experiment"]), [_link("Open Earned Authority", f"/authority/{b.row.sku}"), _fu("observability"), _fu("circuit")]


def _observability(ctx: Ctx, q: str) -> Answer:
    b = ctx.primary
    days = [h for h in b.forecast.history if h.sold_out]
    hidden = sum(h.hidden_units or 0 for h in days)
    observ = ctx.grade("observability")
    share = observ.measure.hidden_share if observ and observ.measure.kind == "observability" else 0
    blocks = [
        T(text=f"The SKU sold out on **{join_and([day_label(h.date) for h in days])}**. On those days, demand past the last pair on the shelf was never recorded.[[observability]]"),
        T(text=f"An estimated {hidden:g} pairs went unseen — about {js_round(share * 100)}% of demand in the {len(b.forecast.history)} days. Pass needs under 5% for 8 weeks, so the grade is **{observ.grade if observ else 'partial'}**.[[observability]] The forecast corrects for it, and probe days confirm the range is on target.[[probes]]"),
        schemas.FigureBlock(figure="sales"),
    ]
    return "observability", b.row.id, blocks, _sources(ctx, ["observability", "probes", "forecast"]), [_fu("l3"), _fu("why")]


def _circuit(ctx: Ctx, q: str) -> Answer:
    c, state = ctx.circuit, ctx.sim.circuit
    signals = ", ".join(f"{s.label.lower()} {s.readouts[state].value.lower()}" for s in c.signals)
    sim = " This state is simulated on the circuit page." if state != c.live_state else ""
    blocks = [
        T(text=f"The footwear circuit is **{c.states[state].title.lower()}**. {c.states[state].plain}{sim}[[circuit]]"),
        T(text=f"Signals: {signals}.[[circuit]] {c.last_trip} {c.false_trip_budget}", tone="secondary"),
    ]
    return "circuit", ctx.primary.row.id, blocks, _sources(ctx, ["circuit", "authority"]), [_link("Open the circuit", "/circuit"), _fu("l3"), _fu("slide")]


def _status(ctx: Ctx, q: str) -> Answer:
    b = ctx.primary
    d, a = b.row, b.action
    planner = repository.get_world(ctx.db).planner
    if a.status == "pending":
        text = f"Decision #{d.id} is **waiting for your review**. Nothing has been ordered yet.[[decision]]"
    elif a.status == "approved":
        text = f"Decision #{d.id} was **approved** by {a.by or planner}{f' at {clock(a.at)}' if a.at else ''}: =={a.quantity} units==.[[ledger]]"
    elif a.status == "modified":
        text = f"Decision #{d.id} was **modified** to =={a.quantity} units=={f' ({reason_label(a.reason).lower()})' if a.reason else ''}. It will be scored against {d.recommended_order} once the delivery sells through.[[ledger]]"
    else:
        text = f"Decision #{d.id} was **rejected**. The fallback rule orders {d.fallback_order}.[[ledger]]"
    return "status", d.id, [T(text=text)], _sources(ctx, ["decision", "ledger"]), [_link("Open the ledger", f"/ledger?entry={d.id}"), _fu("why")]


def _forecast(ctx: Ctx, q: str) -> Answer:
    f = ctx.primary.forecast
    coverage = ctx.grade("forecast")
    cov = coverage.measure if coverage and coverage.measure.kind == "coverage" else None
    blocks = [
        T(text=f"Forecast {f.id} expects **{f.p50:g} pairs** over the next {f.horizon_days} days, with a P10–P90 range of {f.p10:g} to {f.p90:g}.[[forecast]]"),
        T(text=f"Demand is rising about {js_round(f.demand_trend * 100)}% over the next 28 days." + (f" On probe days, {cov.value:g}% of actual demand fell inside the range — on target.[[probes]]" if cov else ""), tone="secondary"),
        schemas.FigureBlock(figure="distribution"),
        schemas.FigureBlock(figure="sales"),
    ]
    return "forecast", ctx.primary.row.id, blocks, _sources(ctx, ["forecast", "probes"]), [_fu("why"), _fu("observability")]


def _stress(ctx: Ctx, q: str) -> Answer:
    b = ctx.primary
    keep = b.row.recommended_order
    rows = [(s, policy.solve(b.policy, policy.stress(**{s.key: s.value}), keep)) for s in scenarios.presets().singles]
    worst = max(rows, key=lambda x: x[1].risk_if_keep)
    blocks = [
        T(text="One stress at a time, the best order moves to: " + "; ".join(f"{s.label.lower()} → **{r.order}**" for s, r in rows) + ".[[scenario]]"),
        T(text=f"Cost barely moves it. Demand and lead time move it most: under {worst[0].label.lower()}, keeping {keep} would carry a **{pct(worst[1].risk_if_keep)}** chance of selling out.[[scenario]]", tone="secondary"),
        schemas.FigureBlock(figure="flip"),
    ]
    return "stress", b.row.id, blocks, _sources(ctx, ["scenario", "decision"]), [_link("Open Break My Plan", f"/break-my-plan/{b.row.id}"), _fu("lead")]


@dataclass
class Intent:
    id: str
    score: Callable[[Ctx, str], float]
    answer: Callable[[Ctx, str], Answer]


INTENTS = [
    Intent("refuse-action", lambda c, q: 20 if re.match(r"^(please )?(approve|place|order|buy|cancel|reject|change|set|modify|increase|reduce)\b", q) or re.search(r"\b(can|could|will|would) you (approve|place|order|buy|change|reject|modify|cancel)", q) else 0, _refuse),
    Intent("other-decision", lambda c, q: 12 if _other_decision(c, q) else 0, _other),
    Intent("why", lambda c, q: _has(q, ["why", "recommend", "127", "how many", "reason", "explain", "how did", "where does"]) + (2 if "127" in q else 0) + (2 if "recommend" in q else 0), _why),
    Intent("lead", lambda c, q: _has(q, ["lead", "slip", "late", "supplier", "delay", "takes longer", "arrive"]) * 2 + (1 if "what if" in q else 0), _lead),
    Intent("fallback", lambda c, q: _has(q, ["fallback", "97", "naive", "instead", "baseline", "rule"]) * 2, _fallback),
    Intent("authority", lambda c, q: _has(q, ["authority", "l3", "l2", "l1", "l4", "autonomy", "earn", "trust", "why do i approve", "level", "on its own", "automatic"]) * 2, _authority),
    Intent("observability", lambda c, q: _has(q, ["sold out", "sold-out", "sell out", "sell-out", "sellout", "hidden", "observab", "stockout days", "which days", "censor", "unseen"]) * 2, _observability),
    Intent("circuit", lambda c, q: _has(q, ["circuit", "bench", "clear", "trip", "breaker", "warning", "safe"]) * 2, _circuit),
    Intent("status", lambda c, q: _has(q, ["approved", "who approved", "status", "did i", "waiting", "pending", "decided", "been approved", "signed"]) * 2, _status),
    Intent("forecast", lambda c, q: _has(q, ["forecast", "demand", "p10", "p50", "p90", "range", "expect", "sell next"]) * 1.5, _forecast),
    Intent("stress", lambda c, q: _has(q, ["stress", "fragile", "change under", "break", "robust", "sensitive", "what could"]) * 2, _stress),
]


def ask(db: Session, question: str, asked_at: str | None = None) -> schemas.AskAnswer:
    world = repository.get_world(db)
    asked_at = asked_at or now_on_world_day(world.today)
    primary = load(db, world.primary_decision_id)
    sim = repository.get_simulation(db)
    ctx = Ctx(db=db, primary=primary, sim=sim, circuit=repository.get_circuit(db), authority_level=authority_svc.effective(db, primary.row.sku, sim).level)
    q = re.sub(r"\s+", " ", question.lower()).strip()
    best, top = None, 0.0
    for intent in INTENTS:
        s = intent.score(ctx, q)
        if s > top:
            best, top = intent, s
    if best is None or top < 1:
        return schemas.AskAnswer(
            intent="none",
            question=question,
            asked_at=asked_at,
            blocks=[
                schemas.RefusalBlock(text="No record, no answer."),
                T(text="I answer only from ORACLE's records: this week's decisions, forecasts, evidence grades, earned authority, the decision circuit and the scenario engine. Nothing in them matches that question.", tone="secondary"),
            ],
            sources=[],
            follow_ups=SUGGESTIONS[:4],
        )
    intent, about, blocks, sources, follow_ups = best.answer(ctx, q)
    return schemas.AskAnswer(intent=intent, about=about, question=question, asked_at=asked_at, blocks=blocks, sources=sources, follow_ups=follow_ups)
