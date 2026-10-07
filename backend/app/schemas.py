"""API contract. Field names are snake_case in Python and camelCase on the wire, matching
frontend/src/types/index.ts one to one."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Grade = Literal["pass", "partial", "insufficient", "failed"]
DecisionStatus = Literal["pending", "approved", "rejected", "modified"]
CircuitState = Literal["clear", "review", "bench"]
ChipKind = Literal["act", "review", "advisory", "bench", "sealed"]
StressKey = Literal["demand", "leadTime", "cost", "penalty", "bias", "shock", "shortfall"]
LedgerKind = Literal["order", "authority", "override", "circuit", "replay", "markdown", "approval", "rejection", "modification", "note"]
ModifyReason = Literal["LOCAL_EVENT", "SUPPLIER", "PROMOTION", "SPACE", "STRESS_TEST", "OTHER"]


class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ── world and catalogue ────────────────────────────────────────────────────────


class World(Schema):
    today: str
    today_label: str
    yesterday: str
    yesterday_label: str
    week: int
    store: str
    category: str
    planner: str
    planner_initials: str
    primary_decision_id: str


class Product(Schema):
    sku: str
    name: str
    colorway: str
    category: str
    store: str
    price: float
    unit_cost: float
    case_pack: int
    lead_time_days: int
    review_cycle_days: int
    authority_chip: Literal["act", "review", "advisory", "bench"]


# ── forecasts ──────────────────────────────────────────────────────────────────


class ForecastDay(Schema):
    date: str
    p10: float
    p50: float
    p90: float


class SalesDay(Schema):
    date: str
    units: float
    sold_out: bool
    hidden_units: float | None = None


class PolicyParams(Schema):
    sd: float
    goodwill: float
    overage_rate: float
    daily_beyond_horizon: float


class Forecast(Schema):
    id: str
    sku: str
    issued_at: str
    horizon_days: int
    p10: float
    p50: float
    p90: float
    daily: list[ForecastDay]
    history: list[SalesDay]
    demand_trend: float
    cover_days_now: float
    cover_days_end: float
    policy: PolicyParams


# ── decisions ──────────────────────────────────────────────────────────────────


class Decision(Schema):
    id: str
    sku: str
    forecast_id: str
    evidence_id: str
    created_at: str
    action: Literal["order", "markdown", "none"]
    recommended_order: int
    fallback_order: int
    fallback_rule: str
    on_hand: int
    on_order: int
    on_order_due: str
    arrival: str
    next_delivery: str
    target_position: int
    stockout_risk: float
    expected_contribution: float
    contribution_vs_fallback: float
    critical_ratio: float
    authority: int
    status: DecisionStatus = Field(description="Current status, from the planner's action.")
    circuit: CircuitState
    rationale: str
    data_snapshot: str
    record_hash: str
    prev_hash: str


class DecisionAction(Schema):
    status: DecisionStatus
    quantity: int
    reason: str | None = None
    note: str | None = None
    at: str | None = None
    by: str | None = None


class PolicyInput(Schema):
    """Inputs the replenishment policy needs; the frontend recomputes what-ifs from these."""

    mean: float
    horizon: float
    sd: float
    goodwill: float
    overage_rate: float
    daily_beyond: float
    price: float
    unit_cost: float
    on_hand: float
    on_order: float


# ── evidence ───────────────────────────────────────────────────────────────────


class CoverageMeasure(Schema):
    kind: Literal["coverage"]
    value: float
    target: float
    tolerance: float


class ObservabilityMeasure(Schema):
    kind: Literal["observability"]
    days: list[SalesDay]
    hidden_share: float


class ServiceMeasure(Schema):
    kind: Literal["service"]
    value: float
    target: float


class ValueMeasure(Schema):
    kind: Literal["value"]
    point: float
    low: float
    high: float


class IdentificationMeasure(Schema):
    kind: Literal["identification"]
    rung: int


Measure = Annotated[CoverageMeasure | ObservabilityMeasure | ServiceMeasure | ValueMeasure | IdentificationMeasure, Field(discriminator="kind")]


class EvidenceGrade(Schema):
    id: str
    index: str
    name: str
    grade: Grade
    finding: str
    method: str
    window: str
    threshold: str
    records: list[str]
    measure: Measure


class AuthorityRef(Schema):
    level: int
    label: str


class Restore(Schema):
    level: int
    experiment_id: str
    summary: str
    scope: str
    weeks: int
    cost: float
    measures: str


class EvidenceReport(Schema):
    id: str
    decision_id: str
    graded_at: str
    grades: list[EvidenceGrade]
    authority_before: AuthorityRef
    authority_now: AuthorityRef
    rule: str
    restore: Restore


# ── authority and circuit ──────────────────────────────────────────────────────


class AuthorityLevelDef(Schema):
    level: int
    short: str
    plain: str
    detail: str


class AuthorityHistoryPoint(Schema):
    week: int
    level: int
    note: str | None = None


class AuthorityEarn(Schema):
    headline: str
    detail: str
    requirement: str
    metric: float
    threshold: float


class AuthorityLose(Schema):
    headline: str
    detail: str


class AuthorityRecord(Schema):
    sku: str
    earned_level: int
    real_world_start: int
    levels: list[AuthorityLevelDef]
    history: list[AuthorityHistoryPoint]
    earn: AuthorityEarn
    lose: AuthorityLose


class EffectiveAuthority(Schema):
    """What ORACLE may do for a SKU right now: earned level, capped by the circuit, or the probe preview."""

    level: int
    earned: int
    preview: bool
    cap: int | None
    circuit: CircuitState


class CircuitReadout(Schema):
    value: str
    sub: str
    frac: float
    tripped: bool


class CircuitSignal(Schema):
    id: str
    label: str
    readouts: dict[CircuitState, CircuitReadout]
    threshold: float
    threshold_label: str


class CircuitStateDef(Schema):
    title: str
    plain: str
    authority_cap: int | None


class CircuitRecord(Schema):
    live_state: CircuitState
    since: str
    scope: str
    signals: list[CircuitSignal]
    states: dict[CircuitState, CircuitStateDef]
    last_trip: str
    false_trip_budget: str


class Simulation(Schema):
    circuit: CircuitState
    probes_preview: bool


class SimulationUpdate(Schema):
    circuit: CircuitState | None = None
    probes_preview: bool | None = None


class SimulationResult(Schema):
    simulation: Simulation
    authority: dict[str, EffectiveAuthority]


# ── ledger ─────────────────────────────────────────────────────────────────────


class ReceiptLine(Schema):
    label: str
    value: str
    emphasis: Literal["decision", "strong"] | None = None


class Chip(Schema):
    label: str
    kind: ChipKind


class Link(Schema):
    label: str
    href: str


class EntryLinks(Schema):
    """Which related pages exist for an entry's decision."""

    evidence: bool = False
    stress: bool = False


class LedgerEntry(Schema):
    id: str
    seq: int
    at: str
    kind: LedgerKind
    sku: str | None = None
    decision_id: str | None = None
    eyebrow: str
    title: str
    meta: str
    quote: str | None = None
    chip: Chip | None = None
    link: Link | None = None
    receipt: list[list[ReceiptLine]] | None = None
    receipt_authority: Chip | None = Field(default=None, description="Authority chip shown on the receipt.")
    links: EntryLinks = Field(default_factory=EntryLinks)
    hash: str
    prev_hash: str


class LedgerVerify(Schema):
    ok: bool
    length: int
    last_hash: str
    broken_at: str | None = None


class NoteRequest(Schema):
    kind: Literal["note"] = "note"
    eyebrow: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=200)
    meta: str = Field(min_length=1, max_length=400)
    sku: str | None = None
    decision_id: str | None = None


class NoteResult(Schema):
    entry: LedgerEntry


# ── bundles, actions and state ─────────────────────────────────────────────────


class DecisionBundle(Schema):
    """Everything a decision page needs, joined."""

    decision: Decision
    product: Product
    forecast: Forecast
    evidence: EvidenceReport | None
    authority: AuthorityRecord | None
    policy: PolicyInput
    action: DecisionAction
    can_stress: bool
    has_evidence: bool


class DecisionSummary(Schema):
    id: str
    sku: str
    name: str
    action: Literal["order", "markdown", "none"]
    recommended_order: int
    fallback_order: int
    circuit: CircuitState
    current: DecisionAction
    can_stress: bool
    has_evidence: bool


class ModifyRequest(Schema):
    quantity: int = Field(ge=1, le=2000)
    reason: ModifyReason
    note: str = Field(default="", max_length=200)


class RejectRequest(Schema):
    reason: str = Field(min_length=1, max_length=80)


class MutationResult(Schema):
    action: DecisionAction
    entry: LedgerEntry


class AppState(Schema):
    """What every page shares: the world, the planner's actions, the simulation and authority."""

    world: World
    actions: dict[str, DecisionAction]
    simulation: Simulation
    authority: dict[str, EffectiveAuthority]
    levels: list[AuthorityLevelDef]


# ── replays and scenarios ──────────────────────────────────────────────────────


class ReplayKnownDay(Schema):
    date: str
    units: float
    sold_out: bool


class ReplayDay(Schema):
    date: str
    units: float
    oracle_on_hand: float
    fallback_on_hand: float


class ReplayKnew(Schema):
    on_hand: int
    on_order: int
    sell_outs28: int


class ReplayPredicted(Schema):
    p10: float
    p50: float
    p90: float
    horizon_days: int


class ReplayDecided(Schema):
    order: int
    fallback: int
    approved_at: str


class Replay(Schema):
    id: str
    sku: str
    sealed_at: str
    data_hash: str
    seed: str
    leakage_rows: int
    known: list[ReplayKnownDay]
    knew: ReplayKnew
    predicted: ReplayPredicted
    decided: ReplayDecided
    window: list[ReplayDay]


class StressToggle(Schema):
    on: bool
    value: float


class SingleStress(Schema):
    key: StressKey
    value: float
    label: str


class ScenarioPresets(Schema):
    initial: dict[StressKey, StressToggle]
    singles: list[SingleStress]


class ScenarioRequest(Schema):
    stress: dict[StressKey, float] = Field(default_factory=dict, description="Offsets (penalty is a multiplier); missing keys are neutral.")


class ScenarioResult(Schema):
    order: int
    target: int
    mean: float
    sd: float
    critical_ratio: float
    risk_if_keep: float
    risk_at_order: float
    changed: bool
    delta: int


class ScenarioResponse(Schema):
    decision_id: str
    keep: int
    stress: dict[StressKey, float]
    result: ScenarioResult
    flip_lead_time: float | None = Field(description="Lead time in days at which the order leaves the ±10% band, other stresses held.")


# ── ask ────────────────────────────────────────────────────────────────────────


class AskRequest(Schema):
    question: str = Field(min_length=1, max_length=300)
    asked_at: str | None = None


class AskSource(Schema):
    id: str
    title: str
    detail: str
    href: str
    grade: Grade | None = None


class TextBlock(Schema):
    type: Literal["text"] = "text"
    text: str
    tone: Literal["primary", "secondary"] | None = None


class EquationPart(Schema):
    value: str
    label: str
    decision: bool | None = None


class EquationResult(Schema):
    value: str
    label: str


class EquationBlock(Schema):
    type: Literal["equation"] = "equation"
    parts: list[EquationPart]
    result: EquationResult


class FigureBlock(Schema):
    type: Literal["figure"] = "figure"
    figure: Literal["distribution", "position", "sales", "flip", "authority"]
    lead: float | None = None


class RefusalBlock(Schema):
    type: Literal["refusal"] = "refusal"
    text: str


AskBlock = Annotated[TextBlock | EquationBlock | FigureBlock | RefusalBlock, Field(discriminator="type")]


class FollowUp(Schema):
    label: str
    question: str | None = None
    href: str | None = None


class AskAnswer(Schema):
    intent: str
    about: str | None = None
    question: str
    asked_at: str
    blocks: list[AskBlock]
    sources: list[AskSource]
    follow_ups: list[FollowUp]


class Health(Schema):
    status: Literal["ok"]
    version: str
    database: str
    forecast_provider: str
    records: dict[str, int]
