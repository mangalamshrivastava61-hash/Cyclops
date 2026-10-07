import type { Replay, ReplayDay } from "@/types";

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 54 days known before the seal (21 Aug – 13 Oct 2025) plus the decision day itself. */
const known = Array.from({ length: 55 }, (_, i) => {
  const units = Math.round(14 + 4.5 * Math.sin(i * 0.52) + 2.6 * Math.cos(i * 1.37) + 0.08 * i);
  return { date: addDays("2025-08-21", i), units, soldOut: i === 38 || i === 47 };
});

/** What happened after the seal: 12 days, revealed one at a time. */
const actual = [17, 19, 18, 16, 19, 18, 19, 15, 16, 14, 15, 15];
const deliveries = (order: number): Record<number, number> => ({ 1: 30, 4: order }); // on order lands day 2, the decision day 5

function simulate(order: number): number[] {
  let onHand = 64;
  const d = deliveries(order);
  return actual.map((units, i) => {
    onHand = onHand + (d[i] ?? 0) - units;
    return onHand;
  });
}

const oracle = simulate(118);
const fallback = simulate(90);

const window: ReplayDay[] = actual.map((units, i) => ({
  date: addDays("2025-10-15", i),
  units,
  oracleOnHand: oracle[i],
  fallbackOnHand: fallback[i],
}));

export const replays: Replay[] = [
  {
    id: "R-2291",
    sku: "1842",
    sealedAt: "2025-10-14T23:59:00",
    dataHash: "9F3C…A41E",
    seed: "0417",
    leakageRows: 0,
    known,
    knew: { onHand: 64, onOrder: 30, sellOuts28: 2 },
    predicted: { p10: 151, p50: 192, p90: 238, horizonDays: 12 },
    decided: { order: 118, fallback: 90, approvedAt: "10:12" },
    window,
  },
];
