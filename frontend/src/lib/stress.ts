import type { StressKey, StressState } from "@/types";
import { NEUTRAL, flipPoint, solve, type PolicyInput, type Stress } from "@/lib/model/policy";
import { stressDef } from "@/data/scenarios";

export const toStress = (s: StressState): Stress =>
  Object.fromEntries((Object.keys(s) as StressKey[]).map((k) => [k, s[k].on ? s[k].value : NEUTRAL[k]])) as Stress;

const RANGES: Record<StressKey, [number, number]> = {
  demand: [0, 0.6],
  leadTime: [0, 6],
  cost: [-0.1, 0.4],
  penalty: [1, 4],
  bias: [-0.2, 0.2],
  shock: [0, 80],
  shortfall: [0, 0.5],
};

function flipText(key: StressKey, v: number, baseLead: number) {
  switch (key) {
    case "leadTime":
      return `${(baseLead + v).toFixed(1)} days`;
    case "demand":
    case "cost":
      return `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))}%`;
    case "penalty":
      return `×${v.toFixed(1)}`;
    case "bias":
      return `${Math.round(Math.abs(v) * 100)}% ${v > 0 ? "low" : "high"}`;
    case "shock":
      return `+${Math.round(v)} pairs`;
    case "shortfall":
      return `${Math.round(v * 100)}% short`;
  }
}

function clause(key: StressKey, value: number, baseLead: number) {
  switch (key) {
    case "leadTime":
      return `If the supplier takes ${baseLead + value}`;
    case "demand":
      return `If demand runs ${Math.round(value * 100)}% ${value >= 0 ? "higher" : "lower"}`;
    case "cost":
      return `At a ${Math.round(value * 100)}% ${value >= 0 ? "higher" : "lower"} cost`;
    case "penalty":
      return `If a lost sale costs ${value === 2 ? "twice" : `${value}×`} as much`;
    case "bias":
      return `If the forecast runs ${Math.round(Math.abs(value) * 100)}% ${value > 0 ? "low" : "high"}`;
    case "shock":
      return `With a one-off spike of ${value} pairs`;
    case "shortfall":
      return `If the supplier ships ${Math.round(value * 100)}% short`;
  }
}

/** Everything the Break My Plan page shows for a stress state, from one policy. */
export function analyse(policy: PolicyInput, state: StressState, keep: number, baseLead: number) {
  const s = toStress(state);
  const base = solve(policy, NEUTRAL, keep);
  const res = solve(policy, s, keep);
  const active = (Object.keys(state) as StressKey[]).filter((k) => state[k].on && state[k].value !== NEUTRAL[k]);

  // the dimension that moves the order most on its own
  let driver: StressKey | null = null;
  let best = 0;
  for (const k of active) {
    const d = Math.abs(solve(policy, { ...NEUTRAL, [k]: s[k] }, keep).delta);
    if (d > best) {
      best = d;
      driver = k;
    }
  }
  const flip = driver ? flipPoint(policy, NEUTRAL, driver, keep, RANGES[driver]) : null;

  let headline: string;
  let detail: string;
  const riskFrom = Math.round(base.riskIfKeep * 100);
  const riskTo = Math.round(res.riskIfKeep * 100);
  if (!active.length) {
    headline = "No stress applied.";
    detail = `Switch on a stress to see where ${keep} breaks. Today the chance of selling out is ${riskFrom}%.`;
  } else if (res.changed && driver) {
    headline = "The decision changed.";
    const def = stressDef(driver);
    const flipLine = flip !== null ? `${def.label} crossed its flip point at ${flipText(driver, flip, baseLead)}.` : `${def.label} moved the best order to ${res.order}.`;
    const riskLine =
      riskTo !== riskFrom
        ? `${active.length === 1 ? clause(driver, state[driver].value, baseLead) : "Under these stresses"}, keeping ${keep} ${riskTo > riskFrom ? "raises" : "lowers"} the chance of selling out from ${riskFrom}% to ${riskTo}%.`
        : `Keeping ${keep} leaves the chance of selling out at ${riskTo}%, but ${active.length === 1 ? clause(driver, state[driver].value, baseLead).toLowerCase() : "under these stresses"} the best order is ${res.order}.`;
    detail = `${flipLine} ${riskLine}`;
  } else {
    headline = "The decision holds.";
    detail = `The best order stays within 10% of ${keep}. Keeping ${keep} ${riskTo === riskFrom ? `leaves the chance of selling out at ${riskTo}%` : `moves the chance of selling out from ${riskFrom}% to ${riskTo}%`}.`;
  }
  return { base, res, stress: s, active, driver, flip, headline, detail };
}

/** Best order across lead times, with every other stress applied. */
export function flipCurve(policy: PolicyInput, state: StressState, keep: number, baseLead: number) {
  const s = toStress(state);
  const points = Array.from({ length: 25 }, (_, i) => {
    const lead = 3 + i * 0.25;
    return { lead, order: solve(policy, { ...s, leadTime: lead - baseLead }, keep).order };
  });
  // search upward from today's lead time: the point where waiting longer flips the decision
  const flip = flipPoint(policy, { ...s, leadTime: 0 }, "leadTime", keep, [0, 4]);
  return {
    points,
    keep,
    flipLead: flip === null || flip <= 0 ? null : baseLead + flip,
    current: { lead: baseLead + s.leadTime, order: solve(policy, s, keep).order },
    baseLead,
  };
}
