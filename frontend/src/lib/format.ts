/** Formatting helpers. The synthetic world has no time zone: ISO strings are read as wall-clock. */

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parts(iso: string) {
  const [date, time = "00:00:00"] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dow, time };
}

/** "Thu 1 Oct" */
export const dayLabel = (iso: string) => {
  const p = parts(iso);
  return `${DOW[p.dow]} ${p.d} ${MON[p.m - 1]}`;
};
/** "Oct 1" */
export const shortDate = (iso: string) => {
  const p = parts(iso);
  return `${MON[p.m - 1]} ${p.d}`;
};
/** "Tue 14 Oct 2025" */
export const longDate = (iso: string) => `${dayLabel(iso)} ${parts(iso).y}`;
/** "09:42" */
export const clock = (iso: string) => parts(iso).time.slice(0, 5);
/** "SAT 26 SEP 2026 · 09:42:07" */
export const stamp = (iso: string) => `${longDate(iso).toUpperCase()} · ${parts(iso).time}`;

export const money = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);
export const signedMoney = (v: number) => `${v >= 0 ? "+" : "−"}$${Math.abs(Math.round(v / 10) * 10).toLocaleString("en-US")}`;
export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
export const int = (v: number) => Math.round(v).toLocaleString("en-US");

/** Local wall-clock ISO for "now", used when the planner acts. Kept on the synthetic day. */
export function nowOnWorldDay(worldDay: string) {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${worldDay}T${hh}:${mm}:${ss}`;
}

const REASON_LABELS: Record<string, string> = {
  LOCAL_EVENT: "Local event",
  SUPPLIER: "Supplier constraint",
  PROMOTION: "Promotion",
  SPACE: "Shelf space",
  STRESS_TEST: "Stress test",
  OTHER: "Other",
};
/** "LOCAL_EVENT" → "Local event" */
export const reasonLabel = (code: string) => REASON_LABELS[code] ?? code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " ");
