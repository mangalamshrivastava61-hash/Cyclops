import type { StressControlDef, StressKey, StressState } from "@/types";

const pct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(Math.round(v * 100))}%`;
const days = (v: number) => `${v > 0 ? "+" : ""}${Number.isInteger(v) ? v : v.toFixed(1)} day${Math.abs(v) === 1 ? "" : "s"}`;

/** Break My Plan controls. Values are stored in model units (fractions, days, multipliers, units). */
export const stressControls: StressControlDef[] = [
  { id: "demand", label: "Demand", unit: "%", min: -0.3, max: 0.6, step: 0.05, preset: 0.25, neutral: 0, format: pct, group: "primary" },
  { id: "leadTime", label: "Lead time", unit: "days", min: 0, max: 6, step: 0.5, preset: 2, neutral: 0, format: days, group: "primary" },
  { id: "cost", label: "Cost", unit: "%", min: -0.1, max: 0.4, step: 0.05, preset: 0.15, neutral: 0, format: pct, group: "primary" },
  { id: "penalty", label: "Stockout penalty", unit: "×", min: 1, max: 4, step: 0.5, preset: 2, neutral: 1, format: (v) => `×${Number.isInteger(v) ? v : v.toFixed(1)}`, group: "primary" },
  { id: "bias", label: "Forecast bias", unit: "%", min: -0.2, max: 0.2, step: 0.05, preset: 0.1, neutral: 0, format: (v) => (v === 0 ? "None" : `${pct(v)} ${v > 0 ? "low" : "high"}`), group: "more" },
  { id: "shock", label: "Demand shock", unit: "units", min: 0, max: 80, step: 5, preset: 40, neutral: 0, format: (v) => `+${v} pairs`, group: "more" },
  { id: "shortfall", label: "Supplier shortfall", unit: "%", min: 0, max: 0.5, step: 0.05, preset: 0.2, neutral: 0, format: (v) => `${Math.round(v * 100)}% short`, group: "more" },
];

export const stressDef = (k: StressKey) => stressControls.find((c) => c.id === k)!;

/** The page opens on the stress the design shows: the supplier takes two extra days. */
export const initialStress: StressState = {
  demand: { on: false, value: 0.25 },
  leadTime: { on: true, value: 2 },
  cost: { on: false, value: 0.15 },
  penalty: { on: false, value: 2 },
  bias: { on: false, value: 0.1 },
  shock: { on: false, value: 40 },
  shortfall: { on: false, value: 0.2 },
};

/** One stress at a time, for the comparison table. */
export const singleStressPresets: { key: StressKey; value: number; label: string }[] = [
  { key: "demand", value: 0.25, label: "Demand +25%" },
  { key: "leadTime", value: 3, label: "Lead time +3 days" },
  { key: "cost", value: 0.15, label: "Cost +15%" },
  { key: "penalty", value: 2, label: "Stockout penalty ×2" },
  { key: "shortfall", value: 0.2, label: "Supplier ships 20% short" },
];
