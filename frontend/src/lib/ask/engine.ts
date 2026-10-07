/**
 * Ask ORACLE: a grounded, read-only question engine. It never generates facts. Each intent reads
 * structured records (decision, forecast, evidence, authority, circuit, scenario engine) and
 * composes an answer that cites them inline. No matching record → no answer.
 *
 * Inline markup in text blocks: **strong**, ==decision== (gold tint), [[sourceId]] (citation).
 */
import type { AskAnswer, AskBlock, AskSource, CircuitState, Decision } from "@/types";
import type { DecisionAction } from "@/lib/store/oracle-store";
import * as repo from "@/lib/services/repository";
import { NEUTRAL, expectedCost, flipPoint, position, solve, stockoutRisk } from "@/lib/model/policy";
import { clock, dayLabel, reasonLabel, shortDate } from "@/lib/format";

export interface AskContext {
  /** Live planner action for any decision (store state, including seeded actions). */
  actionFor: (decisionId: string) => DecisionAction;
  circuit: CircuitState;
  authorityLevel: number;
}

const PRIMARY = "18513";
const primary = () => repo.decisionBundle(PRIMARY)!;
const pctOf = (v: number) => `${Math.round(v * 100)}%`;

type SourceKey = "decision" | "forecast" | "observability" | "probes" | "value" | "authority" | "circuit" | "experiment" | "scenario" | "ledger";

function sources(keys: SourceKey[]): AskSource[] {
  const b = primary();
  const c = repo.getCircuit();
  const all: Record<SourceKey, AskSource> = {
    decision: { id: "decision", title: `Decision #${b.decision.id}`, detail: `Order ${b.decision.recommendedOrder} · ${dayLabel(b.decision.createdAt)}, ${clock(b.decision.createdAt)}`, href: `/decision/${b.decision.id}` },
    forecast: { id: "forecast", title: `Forecast ${b.forecast.id}`, detail: `${b.forecast.horizonDays} days · P10 ${b.forecast.p10} · P50 ${b.forecast.p50} · P90 ${b.forecast.p90}`, href: `/decision/${b.decision.id}` },
    observability: { id: "observability", title: "Observability", detail: "3 sell-outs in 28 days · 11% hidden", href: `/evidence/${b.decision.id}`, grade: "partial" },
    probes: { id: "probes", title: "Probe set P-120", detail: "Coverage 79% · target 80 ± 5", href: `/evidence/${b.decision.id}` },
    value: { id: "value", title: "Holdout H-0806", detail: "Decision value +1.8% · interval +0.4 to +3.1", href: `/evidence/${b.decision.id}`, grade: "pass" },
    authority: { id: "authority", title: "Authority record · SKU 1842", detail: "26 weeks · earned level L2", href: "/authority/1842" },
    circuit: { id: "circuit", title: "Decision circuit · Footwear", detail: `Live state ${c.liveState} since ${shortDate(c.since)}`, href: "/circuit" },
    experiment: { id: "experiment", title: "Experiment E-38", detail: "Demand probes · 2% of SKU-weeks · 4 weeks", href: `/evidence/${b.decision.id}` },
    scenario: { id: "scenario", title: "Scenario engine", detail: `Replenishment policy · critical ratio ${b.decision.criticalRatio.toFixed(2)}`, href: `/break-my-plan/${b.decision.id}` },
    ledger: { id: "ledger", title: "Decision ledger", detail: "Append-only · chained records", href: `/ledger?entry=${b.decision.id}` },
  };
  return keys.map((k) => all[k]);
}

const has = (q: string, words: string[]) => words.reduce((s, w) => s + (q.includes(w) ? 1 : 0), 0);

interface Intent {
  id: string;
  score: (q: string) => number;
  answer: (q: string, ctx: AskContext) => Omit<AskAnswer, "question" | "askedAt">;
}

const FOLLOW_UPS = {
  lead: { label: "What if the lead time slips 2 days?", question: "What if the lead time slips 2 days?" },
  fallback: { label: "Why not the fallback of 97?", question: "Why not the fallback of 97?" },
  l3: { label: "When does it earn L3 again?", question: "When does it earn L3 again?" },
  observability: { label: "Which days did it sell out?", question: "Which days did it sell out?" },
  why: { label: "Why 127?", question: "Why did ORACLE recommend 127 units?" },
  circuit: { label: "Is the circuit clear?", question: "Is the decision circuit clear?" },
  stress: { label: "How fragile is 127?", question: "How fragile is 127 under stress?" },
  status: { label: "Has it been approved?", question: "Has decision #18513 been approved?" },
  slide: { label: "Why is Slide Pro benched?", question: "Why is Slide Pro benched?" },
};

/** Other decisions this week, matched by product name, SKU or decision id. */
function otherDecision(q: string): Decision | undefined {
  return repo.listDecisions().find((d) => {
    if (d.id === PRIMARY) return false;
    const p = repo.getProduct(d.sku)!;
    return q.includes(p.name.toLowerCase()) || q.includes(d.id) || new RegExp(`\\b${d.sku}\\b`).test(q) || new RegExp(`\\b${p.name.toLowerCase().split(" ")[0]}\\b`).test(q);
  });
}

const intents: Intent[] = [
  {
    id: "refuse-action",
    score: (q) => (/^(please )?(approve|place|order|buy|cancel|reject|change|set|modify|increase|reduce)\b/.test(q) || /\b(can|could|will|would) you (approve|place|order|buy|change|reject|modify|cancel)/.test(q) ? 20 : 0),
    answer: () => ({
      intent: "refuse-action",
      about: PRIMARY,
      blocks: [
        { type: "refusal", text: "I can't place, change or approve an order. That stays with you." },
        { type: "text", text: "Decision #18513 is open on the decision page: approve, modify or reject it there.[[decision]] Whatever you choose is written to the ledger, with your name and the time.[[ledger]]", tone: "secondary" },
      ],
      sources: sources(["decision", "ledger"]),
      followUps: [{ label: "Open decision #18513", href: "/decision/18513" }, FOLLOW_UPS.why],
    }),
  },
  {
    id: "other-decision",
    score: (q) => (otherDecision(q) ? 12 : 0),
    answer: (q, ctx) => {
      const d = otherDecision(q)!;
      const p = repo.getProduct(d.sku)!;
      const f = repo.forecastForSku(d.sku);
      const ev = repo.getEvidence(d.id);
      const a = ctx.actionFor(d.id);
      const src: AskSource[] = [
        { id: "decision", title: `Decision #${d.id}`, detail: `${p.name} · SKU ${p.sku} · ${dayLabel(d.createdAt)}, ${clock(d.createdAt)}`, href: `/decision/${d.id}` },
        ...(f ? [{ id: "forecast", title: `Forecast ${f.id}`, detail: `${f.horizonDays} days · P10 ${f.p10} · P50 ${f.p50} · P90 ${f.p90}`, href: `/decision/${d.id}` }] : []),
        ...(ev ? [{ id: "evidence", title: `Evidence ${ev.id}`, detail: ev.rule, href: `/evidence/${d.id}` }] : []),
        ...(d.circuit === "bench" ? [{ id: "circuit", title: "Decision circuit · Footwear", detail: "Benched for this SKU", href: "/circuit" }] : []),
        { id: "ledger", title: "Decision ledger", detail: "Append-only · chained records", href: `/ledger?entry=${d.id}` },
      ];
      const first =
        d.circuit === "bench"
          ? `ORACLE suggested ${d.recommendedOrder} for ${p.name}, but it is **benched** for this SKU, so the fallback rule orders **${d.fallbackOrder} units**.[[decision]][[circuit]]`
          : d.action === "markdown"
            ? `ORACLE suggests a ==20% markdown== on ${p.name}, shown as advice only.[[decision]]`
            : d.action === "none"
              ? `ORACLE recommends ==no order== for ${p.name} this week, against a fallback of ${d.fallbackOrder}.[[decision]]`
              : `ORACLE recommends ==${d.recommendedOrder} units== of ${p.name}, against a fallback of ${d.fallbackOrder}.[[decision]]`;
      const status =
        a.status === "pending"
          ? "It is waiting for your review."
          : a.status === "approved"
            ? `It was approved${a.at ? ` at ${clock(a.at)}` : ""}${a.by ? ` by ${a.by}` : ""}.`
            : a.status === "modified"
              ? `It was modified to **${a.quantity} units**${a.reason ? ` (${reasonLabel(a.reason).toLowerCase()})` : ""}.${a.note ? ` “${a.note}”` : ""}`
              : `It was rejected; the fallback orders ${d.fallbackOrder}.`;
      const blocks: AskBlock[] = [
        { type: "text", text: `${first} ${d.circuit === "bench" ? `The trigger: ${d.rationale.split(". ")[0].replace(/^A /, "a ")}.` : d.rationale}` },
        { type: "text", text: `${status}[[ledger]]${f ? ` Forecast demand over ${f.horizonDays} days is ${f.p10} to ${f.p90} pairs.[[forecast]]` : ""}${ev ? ` ${ev.rule}[[evidence]]` : ""}`, tone: "secondary" },
      ];
      return {
        intent: "other-decision",
        about: d.id,
        blocks,
        sources: src,
        followUps:
          d.circuit === "bench"
            ? [{ label: `Open decision #${d.id}`, href: `/decision/${d.id}` }, { label: "Open the circuit", href: "/circuit" }, FOLLOW_UPS.circuit]
            : [{ label: `Open decision #${d.id}`, href: `/decision/${d.id}` }, ...(ev ? [{ label: "Open the evidence", href: `/evidence/${d.id}` }] : []), FOLLOW_UPS.why],
      };
    },
  },
  {
    id: "why",
    score: (q) => has(q, ["why", "recommend", "127", "how many", "reason", "explain", "how did", "where does"]) + (q.includes("127") ? 2 : 0) + (q.includes("recommend") ? 2 : 0),
    answer: (_q, ctx) => {
      const b = primary();
      const d = b.decision;
      const f = b.forecast;
      const a = ctx.actionFor(PRIMARY);
      const close =
        a.status === "pending"
          ? "the partial grade is why this order waits for your review."
          : `the partial grade is why the order waited for review. It was ${a.status}${a.status === "modified" ? ` to ${a.quantity}` : ""}${a.at ? ` at ${clock(a.at)}` : ""}.`;
      const blocks: AskBlock[] = [
        {
          type: "text",
          text: `Expected demand over the next ${f.horizonDays} days — the ${b.product.leadTimeDays}-day lead time plus the weekly review cycle — is **${f.p10} to ${f.p90} units**.[[forecast]] You have ${d.onHand} on hand and ${d.onOrder} on order, and a stockout costs about five times more than a leftover pair, so ORACLE targets ${d.targetPosition}: ==${d.recommendedOrder} more units==.[[decision]]`,
        },
        {
          type: "equation",
          parts: [
            { value: String(d.targetPosition), label: "target" },
            { value: String(d.onHand), label: "on hand" },
            { value: String(d.onOrder), label: "on order" },
          ],
          result: { value: String(d.recommendedOrder), label: "this order" },
        },
        { type: "text", text: `One caution: demand observability is partial. This SKU sold out on 3 of the last 28 days, so recent sales understate demand.[[observability]] Forecast coverage is on target[[probes]] — ${close}` },
        { type: "figure", figure: "distribution" },
        { type: "figure", figure: "position" },
        { type: "figure", figure: "sales" },
      ];
      return { intent: "why", about: PRIMARY, blocks, sources: sources(["decision", "forecast", "observability", "probes"]), followUps: [FOLLOW_UPS.lead, FOLLOW_UPS.fallback, FOLLOW_UPS.l3] };
    },
  },
  {
    id: "lead",
    score: (q) => has(q, ["lead", "slip", "late", "supplier", "delay", "takes longer", "arrive"]) * 2 + (q.includes("what if") ? 1 : 0),
    answer: (q) => {
      const b = primary();
      const keep = b.decision.recommendedOrder;
      const m = q.match(/(\d+(?:\.\d+)?)\s*(extra\s*|more\s*)?days?/);
      const extra = m ? Math.max(0.5, Math.min(6, Number(m[1]))) : 2;
      const r = solve(b.policy, { ...NEUTRAL, leadTime: extra }, keep);
      const flip = flipPoint(b.policy, NEUTRAL, "leadTime", keep, [0, 6]);
      const base = pctOf(stockoutRisk(b.policy, keep));
      const lead = b.product.leadTimeDays;
      return {
        intent: "lead",
        about: PRIMARY,
        blocks: [
          { type: "text", text: `If the supplier takes **${lead + extra} days** instead of ${lead}, demand has to be covered for ${b.forecast.horizonDays + extra} days instead of ${b.forecast.horizonDays}, and the best order becomes ==${r.order} units==.[[scenario]][[forecast]]` },
          { type: "text", text: `Keeping ${keep} would raise the chance of selling out from **${base}** to **${pctOf(r.riskIfKeep)}**.[[scenario]] ${flip !== null ? `The decision flips at a lead time of **${(lead + flip).toFixed(1)} days**: past that, ${keep} is no longer the right order.` : "Within six extra days the decision does not flip."}[[decision]]` },
          { type: "figure", figure: "flip", lead: extra },
        ],
        sources: sources(["scenario", "forecast", "decision"]),
        followUps: [{ label: "Open Break My Plan", href: "/break-my-plan/18513" }, FOLLOW_UPS.fallback, FOLLOW_UPS.why],
      };
    },
  },
  {
    id: "fallback",
    score: (q) => has(q, ["fallback", "97", "naive", "instead", "baseline", "rule"]) * 2,
    answer: () => {
      const b = primary();
      const d = b.decision;
      const fb = d.fallbackOrder;
      const gap = Math.round((expectedCost(b.policy, fb) - expectedCost(b.policy, d.recommendedOrder)) / 10) * 10;
      return {
        intent: "fallback",
        about: PRIMARY,
        blocks: [
          { type: "text", text: `The fallback — a ${d.fallbackRule.toLowerCase()} — would buy **${fb}**. That stops the position at ${Math.round(position(b.policy, fb))}, barely above the expected ${b.forecast.p50} and far short of the upper range.[[decision]][[forecast]]` },
          { type: "text", text: `Its chance of selling out is **${pctOf(stockoutRisk(b.policy, fb))}**, against ${pctOf(stockoutRisk(b.policy, d.recommendedOrder))} with ==${d.recommendedOrder}==. On expected cost the fallback gives up about $${gap}.[[scenario]]` },
          { type: "text", text: "ORACLE only replaces the fallback where the evidence says it earns it: on holdouts it added **+1.8%** contribution, interval +0.4 to +3.1.[[value]]", tone: "secondary" },
          { type: "figure", figure: "position" },
          { type: "figure", figure: "distribution" },
        ],
        sources: sources(["decision", "forecast", "scenario", "value"]),
        followUps: [FOLLOW_UPS.why, FOLLOW_UPS.lead, FOLLOW_UPS.stress],
      };
    },
  },
  {
    id: "authority",
    score: (q) => has(q, ["authority", "l3", "l2", "l1", "l4", "autonomy", "earn", "trust", "why do i approve", "level", "on its own", "automatic"]) * 2,
    answer: (_q, ctx) => {
      const a = repo.getAuthority("1842")!;
      const lvl = repo.levels.find((l) => l.level === ctx.authorityLevel)!;
      const capped = ctx.circuit === "bench" ? " The circuit is benched, which caps it at L1 for now." : ctx.circuit === "review" ? " The circuit is in review, which caps it at L2." : "";
      return {
        intent: "authority",
        about: PRIMARY,
        blocks: [
          { type: "text", text: `ORACLE is at ==L${lvl.level} · ${lvl.short}== for this SKU. ${lvl.detail}${capped}[[authority]]` },
          { type: "text", text: `It held L3 in weeks 24 and 25, then dropped to L2 in week 26 when observability was graded **partial**.[[observability]] ${a.earn.detail}[[authority]]` },
          { type: "text", text: `To earn L3 again: ${a.earn.headline.charAt(0).toLowerCase()}${a.earn.headline.slice(1)} Demand probes would measure the hidden demand instead of estimating it.[[experiment]] It loses authority ${a.lose.headline.charAt(0).toLowerCase()}${a.lose.headline.slice(1)}`, tone: "secondary" },
          { type: "figure", figure: "authority" },
        ],
        sources: sources(["authority", "observability", "experiment"]),
        followUps: [{ label: "Open Earned Authority", href: "/authority/1842" }, FOLLOW_UPS.observability, FOLLOW_UPS.circuit],
      };
    },
  },
  {
    id: "observability",
    score: (q) => has(q, ["sold out", "sold-out", "sell out", "sell-out", "sellout", "hidden", "observab", "stockout days", "which days", "censor", "unseen"]) * 2,
    answer: () => {
      const f = primary().forecast;
      const days = f.history.filter((d) => d.soldOut);
      const hidden = days.reduce((s, d) => s + (d.hiddenUnits ?? 0), 0);
      return {
        intent: "observability",
        about: PRIMARY,
        blocks: [
          { type: "text", text: `The SKU sold out on **${days.map((d) => dayLabel(d.date)).join(", ").replace(/, ([^,]*)$/, " and $1")}**. On those days, demand past the last pair on the shelf was never recorded.[[observability]]` },
          { type: "text", text: `An estimated ${hidden} pairs went unseen — about 11% of demand in the 28 days. Pass needs under 5% for 8 weeks, so the grade is **partial**.[[observability]] The forecast corrects for it, and probe days confirm the range is on target.[[probes]]` },
          { type: "figure", figure: "sales" },
        ],
        sources: sources(["observability", "probes", "forecast"]),
        followUps: [FOLLOW_UPS.l3, FOLLOW_UPS.why],
      };
    },
  },
  {
    id: "circuit",
    score: (q) => has(q, ["circuit", "bench", "clear", "trip", "breaker", "warning", "safe"]) * 2,
    answer: (_q, ctx) => {
      const c = repo.getCircuit();
      const signals = c.signals.map((x) => `${x.label.toLowerCase()} ${x.readouts[ctx.circuit].value.toLowerCase()}`).join(", ");
      const sim = ctx.circuit !== c.liveState ? " This state is simulated on the circuit page." : "";
      return {
        intent: "circuit",
        about: PRIMARY,
        blocks: [
          { type: "text", text: `The footwear circuit is **${c.states[ctx.circuit].title.toLowerCase()}**. ${c.states[ctx.circuit].plain}${sim}[[circuit]]` },
          { type: "text", text: `Signals: ${signals}.[[circuit]] ${c.lastTrip} ${c.falseTripBudget}`, tone: "secondary" },
        ],
        sources: sources(["circuit", "authority"]),
        followUps: [{ label: "Open the circuit", href: "/circuit" }, FOLLOW_UPS.l3, FOLLOW_UPS.slide],
      };
    },
  },
  {
    id: "status",
    score: (q) => has(q, ["approved", "who approved", "status", "did i", "waiting", "pending", "decided", "been approved", "signed"]) * 2,
    answer: (_q, ctx) => {
      const a = ctx.actionFor(PRIMARY);
      const text =
        a.status === "pending"
          ? "Decision #18513 is **waiting for your review**. Nothing has been ordered yet.[[decision]]"
          : a.status === "approved"
            ? `Decision #18513 was **approved** by ${a.by ?? repo.world.planner}${a.at ? ` at ${clock(a.at)}` : ""}: ==${a.quantity} units==.[[ledger]]`
            : a.status === "modified"
              ? `Decision #18513 was **modified** to ==${a.quantity} units==${a.reason ? ` (${reasonLabel(a.reason).toLowerCase()})` : ""}. It will be scored against 127 once the delivery sells through.[[ledger]]`
              : "Decision #18513 was **rejected**. The fallback rule orders 97.[[ledger]]";
      return {
        intent: "status",
        about: PRIMARY,
        blocks: [{ type: "text", text }],
        sources: sources(["decision", "ledger"]),
        followUps: [{ label: "Open the ledger", href: "/ledger?entry=18513" }, FOLLOW_UPS.why],
      };
    },
  },
  {
    id: "forecast",
    score: (q) => has(q, ["forecast", "demand", "p10", "p50", "p90", "range", "expect", "sell next"]) * 1.5,
    answer: () => {
      const f = primary().forecast;
      return {
        intent: "forecast",
        about: PRIMARY,
        blocks: [
          { type: "text", text: `Forecast ${f.id} expects **${f.p50} pairs** over the next ${f.horizonDays} days, with a P10–P90 range of ${f.p10} to ${f.p90}.[[forecast]]` },
          { type: "text", text: `Demand is rising about ${Math.round(f.demandTrend * 100)}% over the next 28 days. On 120 probe days, 79% of actual demand fell inside the range — on target.[[probes]]`, tone: "secondary" },
          { type: "figure", figure: "distribution" },
          { type: "figure", figure: "sales" },
        ],
        sources: sources(["forecast", "probes"]),
        followUps: [FOLLOW_UPS.why, FOLLOW_UPS.observability],
      };
    },
  },
  {
    id: "stress",
    score: (q) => has(q, ["stress", "fragile", "change under", "break", "robust", "sensitive", "what could"]) * 2,
    answer: () => {
      const b = primary();
      const keep = b.decision.recommendedOrder;
      const rows = repo.stress.singles.map((s) => ({ s, r: solve(b.policy, { ...NEUTRAL, [s.key]: s.value }, keep) }));
      const worst = [...rows].sort((x, y) => y.r.riskIfKeep - x.r.riskIfKeep)[0];
      return {
        intent: "stress",
        about: PRIMARY,
        blocks: [
          { type: "text", text: `One stress at a time, the best order moves to: ${rows.map(({ s, r }) => `${s.label.toLowerCase()} → **${r.order}**`).join("; ")}.[[scenario]]` },
          { type: "text", text: `Cost barely moves it. Demand and lead time move it most: under ${worst.s.label.toLowerCase()}, keeping ${keep} would carry a **${pctOf(worst.r.riskIfKeep)}** chance of selling out.[[scenario]]`, tone: "secondary" },
          { type: "figure", figure: "flip" },
        ],
        sources: sources(["scenario", "decision"]),
        followUps: [{ label: "Open Break My Plan", href: "/break-my-plan/18513" }, FOLLOW_UPS.lead],
      };
    },
  },
];

export const SUGGESTIONS = [FOLLOW_UPS.why, FOLLOW_UPS.lead, FOLLOW_UPS.fallback, FOLLOW_UPS.l3, FOLLOW_UPS.observability, FOLLOW_UPS.circuit, FOLLOW_UPS.status, FOLLOW_UPS.slide];

export const DEFAULT_QUESTION = FOLLOW_UPS.why.question;

export function ask(question: string, ctx: AskContext, askedAt: string): AskAnswer {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();
  let best: Intent | null = null;
  let top = 0;
  for (const i of intents) {
    const s = i.score(q);
    if (s > top) {
      top = s;
      best = i;
    }
  }
  if (!best || top < 1) {
    return {
      intent: "none",
      question,
      askedAt,
      blocks: [
        { type: "refusal", text: "No record, no answer." },
        { type: "text", text: "I answer only from ORACLE's records: this week's decisions, forecasts, evidence grades, earned authority, the decision circuit and the scenario engine. Nothing in them matches that question.", tone: "secondary" },
      ],
      sources: [],
      followUps: SUGGESTIONS.slice(0, 4),
    };
  }
  return { ...best.answer(q, ctx), question, askedAt };
}
