/**
 * ORACLE domain types. Every page reads these shapes from the service layer
 * (src/lib/services), so a real backend can replace the mock data without UI changes.
 */

export type ISODate = string; // "2026-09-26"
export type ISODateTime = string; // "2026-09-26T09:42:07"

export type AuthorityLevel = 0 | 1 | 2 | 3 | 4;
export type AuthorityChipKind = "act" | "review" | "advisory" | "bench";

export type Grade = "pass" | "partial" | "insufficient" | "failed";

export type DecisionStatus = "pending" | "approved" | "rejected" | "modified";

export type CircuitState = "clear" | "review" | "bench";

export interface Product {
  sku: string;
  name: string;
  colorway: string;
  category: string;
  store: string;
  price: number;
  unitCost: number;
  casePack: number;
  leadTimeDays: number;
  reviewCycleDays: number;
  /** Authority chip shown next to this SKU's current decision */
  authorityChip: AuthorityChipKind;
}

export interface ForecastDay {
  date: ISODate;
  p10: number;
  p50: number;
  p90: number;
}

export interface SalesDay {
  date: ISODate;
  units: number;
  /** True when the SKU sold out that day, so demand beyond stock was never observed */
  soldOut: boolean;
  /** Estimated demand that was not observed because of the sell-out */
  hiddenUnits?: number;
}

export interface Forecast {
  id: string;
  sku: string;
  issuedAt: ISODateTime;
  /** Protection period: lead time + review cycle */
  horizonDays: number;
  p10: number;
  p50: number;
  p90: number;
  daily: ForecastDay[];
  history: SalesDay[];
  demandTrend: number; // +0.12 = +12% over the window
  coverDaysNow: number;
  coverDaysEnd: number;
  /** Parameters the replenishment policy uses for this SKU (see src/lib/model/policy.ts). */
  policy: PolicyParams;
}

export interface PolicyParams {
  /** Standard deviation of demand over the protection period, as the policy sees it */
  sd: number;
  /** Goodwill cost of a lost sale beyond the lost margin, per unit */
  goodwill: number;
  /** Cost of a leftover unit as a share of unit cost (holding + markdown) */
  overageRate: number;
  /** Expected units per day beyond the forecast horizon */
  dailyBeyondHorizon: number;
}

export interface EvidenceSummary {
  pass: number;
  partial: number;
  insufficient: number;
  failed: number;
}

export interface Decision {
  id: string;
  sku: string;
  forecastId: string;
  evidenceId: string;
  createdAt: ISODateTime;
  action: "order" | "markdown" | "none";
  recommendedOrder: number;
  fallbackOrder: number;
  fallbackRule: string;
  onHand: number;
  onOrder: number;
  onOrderDue: ISODate;
  arrival: ISODate;
  nextDelivery: ISODate;
  targetPosition: number;
  stockoutRisk: number; // 0.16
  expectedContribution: number;
  contributionVsFallback: number;
  criticalRatio: number;
  authority: AuthorityLevel;
  status: DecisionStatus;
  circuit: CircuitState;
  rationale: string;
  dataSnapshot: string;
  recordHash: string;
  prevHash: string;
}

export interface EvidenceGrade {
  id: string;
  index: string;
  name: string;
  grade: Grade;
  finding: string;
  method: string;
  window: string;
  threshold: string;
  records: string[];
  measure:
    | { kind: "coverage"; value: number; target: number; tolerance: number }
    | { kind: "observability"; days: SalesDay[]; hiddenShare: number }
    | { kind: "service"; value: number; target: number }
    | { kind: "value"; point: number; low: number; high: number }
    | { kind: "identification"; rung: 0 | 1 | 2 };
}

export interface EvidenceReport {
  id: string;
  decisionId: string;
  gradedAt: ISODateTime;
  grades: EvidenceGrade[];
  authorityBefore: { level: AuthorityLevel; label: string };
  authorityNow: { level: AuthorityLevel; label: string };
  rule: string;
  restore: {
    level: AuthorityLevel;
    experimentId: string;
    summary: string;
    scope: string;
    weeks: number;
    cost: number;
    measures: string;
  };
}

export interface AuthorityLevelDef {
  level: AuthorityLevel;
  short: string;
  plain: string;
  detail: string;
}

export interface AuthorityRecord {
  sku: string;
  earnedLevel: AuthorityLevel;
  realWorldStart: AuthorityLevel;
  levels: AuthorityLevelDef[];
  history: { week: number; level: AuthorityLevel; note?: string }[];
  earn: { headline: string; detail: string; requirement: string; metric: number; threshold: number };
  lose: { headline: string; detail: string };
}

export interface CircuitSignal {
  id: string;
  label: string;
  /** readout per circuit state, so the instrument can be simulated */
  readouts: Record<CircuitState, { value: string; sub: string; frac: number; tripped: boolean }>;
  threshold: number; // 0..1 along the gauge
  thresholdLabel: string;
}

export interface CircuitRecord {
  liveState: CircuitState;
  since: ISODate;
  scope: string;
  signals: CircuitSignal[];
  states: Record<CircuitState, { title: string; plain: string; authorityCap: AuthorityLevel | null }>;
  lastTrip: string;
  falseTripBudget: string;
}

export type LedgerKind =
  | "order"
  | "authority"
  | "override"
  | "circuit"
  | "replay"
  | "markdown"
  | "approval"
  | "rejection"
  | "modification"
  | "note";

export interface ReceiptLine {
  label: string;
  value: string;
  emphasis?: "decision" | "strong";
}

export interface LedgerEntry {
  id: string;
  seq: number;
  at: ISODateTime;
  kind: LedgerKind;
  sku?: string;
  decisionId?: string;
  eyebrow: string;
  title: string;
  meta: string;
  quote?: string;
  chip?: { label: string; kind: AuthorityChipKind | "sealed" };
  link?: { label: string; href: string };
  /** Static receipt for entries that are not backed by a decision record */
  receipt?: ReceiptLine[][];
  hash: string;
  prevHash: string;
}

export interface ReplayDay {
  date: ISODate;
  units: number;
  /** position left at close with ORACLE's order / the fallback's order */
  oracleOnHand: number;
  fallbackOnHand: number;
}

export interface Replay {
  id: string;
  sku: string;
  sealedAt: ISODateTime;
  dataHash: string;
  seed: string;
  leakageRows: number;
  known: { date: ISODate; units: number; soldOut: boolean }[];
  knew: { onHand: number; onOrder: number; sellOuts28: number };
  predicted: { p10: number; p50: number; p90: number; horizonDays: number };
  decided: { order: number; fallback: number; approvedAt: string };
  window: ReplayDay[];
}

export interface StressControlDef {
  id: StressKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  preset: number;
  neutral: number;
  format: (v: number) => string;
  group: "primary" | "more";
}

export type StressKey =
  | "demand"
  | "leadTime"
  | "cost"
  | "penalty"
  | "bias"
  | "shock"
  | "shortfall";

export type StressState = Record<StressKey, { on: boolean; value: number }>;

export interface ScenarioResult {
  order: number;
  target: number;
  mean: number;
  sd: number;
  criticalRatio: number;
  riskIfKeep: number; // stockout risk if the original order is kept
  riskAtOrder: number;
  changed: boolean;
  delta: number;
}

export interface AskSource {
  id: string;
  title: string;
  detail: string;
  href: string;
  grade?: Grade;
}

export type AskBlock =
  /** Inline markup: **strong**, ==decision== (gold tint), [[sourceId]] (citation marker). */
  | { type: "text"; text: string; tone?: "primary" | "secondary" }
  | { type: "equation"; parts: { value: string; label: string; decision?: boolean }[]; result: { value: string; label: string } }
  | { type: "figure"; figure: "distribution" | "position" | "sales" | "flip" | "authority"; /** extra lead-time days for the flip figure */ lead?: number }
  | { type: "refusal"; text: string };

export interface AskAnswer {
  intent: string;
  /** Decision the answer is about, when there is one. */
  about?: string;
  question: string;
  askedAt: string;
  blocks: AskBlock[];
  sources: AskSource[];
  followUps: { label: string; question?: string; href?: string }[];
}
