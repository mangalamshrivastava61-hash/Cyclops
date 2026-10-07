/**
 * The mock replenishment policy behind every order in ORACLE.
 *
 * A base-stock (newsvendor) rule over the protection period (lead time + review cycle):
 *   target = mean + z(CR) · sd,   CR = cu / (cu + co)
 *   order  = target − on hand − on order
 * cu = margin + goodwill of a lost sale, co = holding + markdown cost of a leftover pair.
 * With the SKU 1842 record this reproduces 127 units, target 249 and a 16% stockout risk,
 * and it is what Break My Plan, the modify panel and Ask ORACLE all recompute from.
 */
import { cdf, loss, ppf } from "./normal";
import type { Decision, Forecast, Product, ScenarioResult, StressKey } from "@/types";

export interface PolicyInput {
  mean: number; // P50 over the horizon
  horizon: number; // days = lead time + review cycle
  sd: number;
  goodwill: number;
  overageRate: number;
  dailyBeyond: number;
  price: number;
  unitCost: number;
  onHand: number;
  onOrder: number;
}

export type Stress = Record<StressKey, number>;

/** Neutral values: no stress applied. `penalty` is a multiplier, the rest are offsets. */
export const NEUTRAL: Stress = { demand: 0, leadTime: 0, cost: 0, penalty: 1, bias: 0, shock: 0, shortfall: 0 };

export function policyInput(decision: Decision, forecast: Forecast, product: Product): PolicyInput {
  return {
    mean: forecast.p50,
    horizon: forecast.horizonDays,
    sd: forecast.policy.sd,
    goodwill: forecast.policy.goodwill,
    overageRate: forecast.policy.overageRate,
    dailyBeyond: forecast.policy.dailyBeyondHorizon,
    price: product.price,
    unitCost: product.unitCost,
    onHand: decision.onHand,
    onOrder: decision.onOrder,
  };
}

export function demandOver(input: PolicyInput, s: Stress = NEUTRAL) {
  const P = input.horizon + s.leadTime;
  let mean = P <= input.horizon ? (input.mean * P) / input.horizon : input.mean + input.dailyBeyond * (P - input.horizon);
  let sd = input.sd * Math.sqrt(P / input.horizon);
  mean *= (1 + s.demand) * (1 + s.bias);
  sd *= 1 + s.demand;
  if (s.shock > 0) {
    mean += s.shock;
    sd = Math.sqrt(sd * sd + (0.5 * s.shock) ** 2);
  }
  return { mean, sd, days: P };
}

export function criticalRatio(input: PolicyInput, s: Stress = NEUTRAL) {
  const cost = input.unitCost * (1 + s.cost);
  const cu = input.price - cost + input.goodwill * s.penalty;
  const co = input.overageRate * cost;
  return { cr: cu / (cu + co), cu, co };
}

/** Units that actually arrive from an order when the supplier ships short. */
const arriving = (units: number, s: Stress) => units * (1 - s.shortfall);

export function position(input: PolicyInput, order: number, s: Stress = NEUTRAL) {
  return input.onHand + arriving(input.onOrder + order, s);
}

export function stockoutRisk(input: PolicyInput, order: number, s: Stress = NEUTRAL) {
  const { mean, sd } = demandOver(input, s);
  return 1 - cdf((position(input, order, s) - mean) / sd);
}

export function solve(input: PolicyInput, s: Stress = NEUTRAL, keep?: number): ScenarioResult {
  const { mean, sd } = demandOver(input, s);
  const { cr } = criticalRatio(input, s);
  const target = Math.round(mean + ppf(cr) * sd);
  const need = (target - input.onHand - arriving(input.onOrder, s)) / (1 - s.shortfall);
  const order = Math.max(0, Math.round(need));
  const base = keep ?? order;
  return {
    order,
    target,
    mean,
    sd,
    criticalRatio: cr,
    riskIfKeep: stockoutRisk(input, base, s),
    riskAtOrder: stockoutRisk(input, order, s),
    changed: Math.abs(order - base) > 0.1 * Math.max(base, 1),
    delta: order - base,
  };
}

/** Expected cost of shortage + leftovers for a given order (normal loss function). */
export function expectedCost(input: PolicyInput, order: number, s: Stress = NEUTRAL) {
  const { mean, sd } = demandOver(input, s);
  const { cu, co } = criticalRatio(input, s);
  const y = position(input, order, s);
  const short = sd * loss((y - mean) / sd);
  const over = y - mean + short;
  return cu * short + co * over;
}

/** Expected contribution for `order`, anchored on the record's figure for the recommended order. */
export function contributionFor(input: PolicyInput, order: number, anchor: { order: number; contribution: number }) {
  return anchor.contribution + expectedCost(input, anchor.order) - expectedCost(input, order);
}

/**
 * The flip point for one stress dimension: the smallest value (holding every other stress fixed)
 * at which the best order leaves the ±10% band around `keep`. Returns null when it never flips in range.
 */
export function flipPoint(input: PolicyInput, s: Stress, key: StressKey, keep: number, range: [number, number]): number | null {
  const changed = (v: number) => {
    const t = { ...s, [key]: v };
    const { mean, sd } = demandOver(input, t);
    const { cr } = criticalRatio(input, t);
    const target = mean + ppf(cr) * sd; // continuous, so the flip point is not a rounding artefact
    const order = (target - input.onHand - arriving(input.onOrder, t)) / (1 - t.shortfall);
    return Math.abs(order - keep) > 0.1 * keep;
  };
  let [lo, hi] = range;
  if (changed(lo)) return lo;
  if (!changed(hi)) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (changed(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
