import type { DatasetRow } from "@/lib/store/data-studio-store";
import { dayLabel, longDate } from "@/lib/format";
import { replays } from "@/data/replays";

export const REPLAY_HORIZONS = [7, 12, 28] as const;
export type ReplayHorizon = (typeof REPLAY_HORIZONS)[number];

export type TimelineDay = { date: string; units: number; inventory?: number };
export type DatasetReplay = {
  sku: string;
  replayDate: string;
  known: TimelineDay[];
  window: TimelineDay[];
  onHand?: number;
  onOrder?: number;
};

const numberOrUndefined = (value: string) => value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined;
const validDate = (value: string) => !Number.isNaN(Date.parse(value));

export function replaySkus(rows: DatasetRow[]) {
  return [...new Set(rows.map((row) => row.sku.trim()).filter(Boolean))].sort();
}

export function replayDates(rows: DatasetRow[], sku: string) {
  return [...new Set(rows.filter((row) => row.sku.trim() === sku && validDate(row.date)).map((row) => row.date))]
    .sort((a, b) => new Date(a).valueOf() - new Date(b).valueOf());
}

/** A narrow browser-side boundary that a future replay endpoint can replace. */
export function datasetReplay(rows: DatasetRow[], sku: string, replayDate: string, horizon: number): DatasetReplay {
  const skuRows = rows
    .filter((row) => row.sku.trim() === sku && validDate(row.date))
    .sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf());
  const toDay = (row: DatasetRow): TimelineDay => ({
    date: row.date,
    units: numberOrUndefined(row.demand) ?? 0,
    inventory: numberOrUndefined(row.inventory),
  });
  const knownRows = skuRows.filter((row) => new Date(row.date).valueOf() <= new Date(replayDate).valueOf());
  const futureRows = skuRows.filter((row) => new Date(row.date).valueOf() > new Date(replayDate).valueOf());
  const decisionRow = knownRows[knownRows.length - 1];
  return {
    sku,
    replayDate,
    known: knownRows.length ? knownRows.map(toDay) : [{ date: replayDate, units: 14, inventory: 64 }],
    window: futureRows.slice(0, horizon).map(toDay),
    onHand: decisionRow ? numberOrUndefined(decisionRow.inventory) ?? 64 : 64,
    onOrder: decisionRow ? numberOrUndefined(decisionRow.onOrderInventory) ?? 30 : 30,
  };
}

/** Values in this result are computed only from the explicitly revealed outcome window. */
export function replayAt(replay: Pick<DatasetReplay, "replayDate" | "window">, revealed: number) {
  const days = replay.window.slice(0, revealed);
  const current = revealed > 0 ? replay.window[revealed - 1].date : replay.replayDate;
  const endingInventory = days.length ? days[days.length - 1].inventory : undefined;
  return {
    revealed,
    total: replay.window.length,
    sold: days.reduce((sum, day) => sum + day.units, 0),
    endingInventory,
    currentLabel: longDate(current),
    shortLabel: dayLabel(current),
    finished: revealed === replay.window.length,
  };
}

export function replayMonths(replay: Pick<DatasetReplay, "known" | "window">) {
  const seen = new Set<string>();
  return [...replay.known, ...replay.window].flatMap((day, index) => {
    if (!day?.date) return [];
    const key = day.date.slice(0, 7);
    if (seen.has(key)) return [];
    seen.add(key);
    try {
      const d = new Date(day.date.includes("T") ? day.date : `${day.date}T00:00:00`);
      const label = !isNaN(d.getTime())
        ? d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()
        : key;
      return [{ key, label, day: index }];
    } catch {
      return [{ key, label: key, day: index }];
    }
  });
}

export function getDefaultReplay(): DatasetReplay {
  const r = replays[0];
  return {
    sku: r.sku,
    replayDate: "2025-10-14",
    known: r.known.map((d) => ({ date: d.date, units: d.units, inventory: 64 })),
    window: r.window.map((d) => ({ date: d.date, units: d.units, inventory: d.oracleOnHand })),
    onHand: r.knew.onHand,
    onOrder: r.knew.onOrder,
  };
}

export function getDefaultReplayRows(): DatasetRow[] {
  const r = replays[0];
  const list: DatasetRow[] = [];
  r.known.forEach((k) => {
    list.push({
      id: crypto.randomUUID(),
      date: k.date,
      sku: r.sku,
      demand: String(k.units),
      inventory: "64",
      onOrderInventory: "30",
      price: "499",
      promotion: "0",
      leadTime: "7",
      productName: "Aero Runner 01",
    });
  });
  r.window.forEach((w) => {
    list.push({
      id: crypto.randomUUID(),
      date: w.date,
      sku: r.sku,
      demand: String(w.units),
      inventory: String(w.oracleOnHand),
      onOrderInventory: "0",
      price: "499",
      promotion: "0",
      leadTime: "7",
      productName: "Aero Runner 01",
    });
  });
  return list;
}
