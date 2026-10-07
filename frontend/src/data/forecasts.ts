import type { Forecast, ForecastDay, SalesDay } from "@/types";

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Daily P10/P50/P90 for 28 days, P50 drifting from `start` to `end`. */
function dailyBand(from: string, start: number, end: number): ForecastDay[] {
  return Array.from({ length: 28 }, (_, i) => {
    const p50 = start + (i * (end - start)) / 27;
    const spread = 0.24 + 0.004 * (i + 1);
    return {
      date: addDays(from, i),
      p10: +(p50 * (1 - spread)).toFixed(2),
      p50: +p50.toFixed(2),
      p90: +(p50 * (1 + spread * 1.08)).toFixed(2),
    };
  });
}

/** Observed sales, 29 Aug – 25 Sep. Three sell-out days hide demand (~11% of it). */
const aeroSales: [number, number?][] = [
  [15], [14], [16], [18], [19], [17], [16], [15], [15], [9, 18],
  [13], [12], [18], [16], [18], [13], [17], [6, 18], [18], [16],
  [18], [19], [19], [13], [9, 18], [20], [22], [18],
];

function history(from: string, rows: [number, number?][]): SalesDay[] {
  return rows.map(([units, hidden], i) => ({
    date: addDays(from, i),
    units,
    soldOut: hidden !== undefined,
    hiddenUnits: hidden,
  }));
}

export const forecasts: Forecast[] = [
  {
    id: "F-1842-0926",
    sku: "1842",
    issuedAt: "2026-09-26T06:00:00",
    horizonDays: 12,
    p10: 168,
    p50: 212,
    p90: 262,
    daily: dailyBand("2026-09-27", 17.2, 19.3),
    history: history("2026-08-29", aeroSales),
    demandTrend: 0.12,
    coverDaysNow: 9.1,
    coverDaysEnd: 6.4,
    policy: { sd: 37.2, goodwill: 15.7, overageRate: 0.1626, dailyBeyondHorizon: 17.5 },
  },
  {
    id: "F-2210-0926",
    sku: "2210",
    issuedAt: "2026-09-26T06:00:00",
    horizonDays: 12,
    p10: 115,
    p50: 150,
    p90: 186,
    daily: dailyBand("2026-09-27", 12.2, 13.1),
    history: history("2026-08-29", Array.from({ length: 28 }, (_, i) => [11 + ((i * 7) % 5)] as [number])),
    demandTrend: 0.05,
    coverDaysNow: 8.4,
    coverDaysEnd: 7.9,
    policy: { sd: 28, goodwill: 12, overageRate: 0.1626, dailyBeyondHorizon: 12.8 },
  },
  {
    id: "F-1555-0926",
    sku: "1555",
    issuedAt: "2026-09-26T06:00:00",
    horizonDays: 12,
    p10: 71,
    p50: 96,
    p90: 122,
    daily: dailyBand("2026-09-27", 8.1, 7.8),
    history: history("2026-08-29", Array.from({ length: 28 }, (_, i) => [7 + ((i * 3) % 4)] as [number])),
    demandTrend: -0.03,
    coverDaysNow: 16.4,
    coverDaysEnd: 12.2,
    policy: { sd: 20, goodwill: 10, overageRate: 0.1626, dailyBeyondHorizon: 7.9 },
  },
  {
    id: "F-0937-0926",
    sku: "0937",
    issuedAt: "2026-09-26T06:00:00",
    horizonDays: 14,
    p10: 22,
    p50: 34,
    p90: 47,
    daily: dailyBand("2026-09-27", 2.5, 2.2),
    history: history("2026-08-29", Array.from({ length: 28 }, (_, i) => [2 + ((i * 5) % 3)] as [number])),
    demandTrend: -0.18,
    coverDaysNow: 31,
    coverDaysEnd: 38,
    policy: { sd: 9.5, goodwill: 8, overageRate: 0.1626, dailyBeyondHorizon: 2.3 },
  },
  {
    id: "F-3021-0926",
    sku: "3021",
    issuedAt: "2026-09-26T06:00:00",
    horizonDays: 11,
    p10: 31,
    p50: 41,
    p90: 52,
    daily: dailyBand("2026-09-27", 3.7, 3.4),
    history: history("2026-08-29", Array.from({ length: 28 }, (_, i) => (i === 27 ? [4, 21] : [4 + ((i * 3) % 3)]) as [number, number?])),
    demandTrend: 0.41,
    coverDaysNow: 2.1,
    coverDaysEnd: 0,
    policy: { sd: 8, goodwill: 5, overageRate: 0.1626, dailyBeyondHorizon: 3.6 },
  },
];
