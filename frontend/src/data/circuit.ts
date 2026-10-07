import type { CircuitRecord } from "@/types";

/** The footwear decision circuit. Readouts exist for each state so the instrument can be simulated. */
export const circuit: CircuitRecord = {
  liveState: "clear",
  since: "2026-09-12",
  scope: "Footwear · Store 03",
  signals: [
    {
      id: "service",
      label: "Service",
      threshold: 0.5,
      thresholdLabel: "floor 90%",
      readouts: {
        clear: { value: "98.4%", sub: "In stock ·", frac: 0.92, tripped: false },
        review: { value: "91.2%", sub: "In stock ·", frac: 0.56, tripped: false },
        bench: { value: "88.9%", sub: "In stock ·", frac: 0.44, tripped: true },
      },
    },
    {
      id: "forecast",
      label: "Forecast",
      threshold: 0.4,
      thresholdLabel: "floor 70%",
      readouts: {
        clear: { value: "Stable", sub: "Coverage 79% ·", frac: 0.58, tripped: false },
        review: { value: "Drifting", sub: "Coverage 72% ·", frac: 0.44, tripped: false },
        bench: { value: "Stable", sub: "Coverage 77% ·", frac: 0.54, tripped: false },
      },
    },
    {
      id: "value",
      label: "Value",
      threshold: 1,
      thresholdLabel: "trips at 1.0",
      readouts: {
        clear: { value: "Positive", sub: "Drift 0.18 ·", frac: 0.18, tripped: false },
        review: { value: "Positive", sub: "Drift 0.64 ·", frac: 0.64, tripped: false },
        bench: { value: "Positive", sub: "Drift 0.31 ·", frac: 0.31, tripped: false },
      },
    },
    {
      id: "tail",
      label: "Tail loss",
      threshold: 1,
      thresholdLabel: "trips at 1.0",
      readouts: {
        clear: { value: "Normal", sub: "Shock 0.07 ·", frac: 0.07, tripped: false },
        review: { value: "Normal", sub: "Shock 0.22 ·", frac: 0.22, tripped: false },
        bench: { value: "Elevated", sub: "Shock 0.81 ·", frac: 0.81, tripped: false },
      },
    },
  ],
  states: {
    clear: { title: "Clear", plain: "Evidence decides. ORACLE may act up to its earned level.", authorityCap: null },
    review: { title: "Review", plain: "A signal is building. Every order waits for a planner.", authorityCap: 2 },
    bench: { title: "Bench", plain: "A threshold was crossed. The fallback rule takes over at once.", authorityCap: 1 },
  },
  lastTrip: "Week 16 · in-stock gate · a real trip.",
  falseTripBudget: "False-trip budget 1 a year · 0 used.",
};
