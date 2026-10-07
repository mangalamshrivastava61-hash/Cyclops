import type { Decision, Forecast } from "@/types";
import { T } from "@/lib/tokens";
import { shortDate } from "@/lib/format";

const PW = 1180;
const T0 = -14;
const T1 = 28;
const X = (t: number) => ((t - T0) / (T1 - T0)) * PW;
const YD = (v: number) => 128 - (v - 8) * 5.6; // demand panel: 8..28 units a day
const YO = (u: number) => 292 - u * 0.56; // on-hand panel: 0..190 units

function stepPath(pts: [number, number][], Y: (v: number) => number) {
  let d = `M${X(pts[0][0]).toFixed(1)},${Y(pts[0][1]).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L${X(pts[i][0]).toFixed(1)},${Y(pts[i - 1][1]).toFixed(1)} L${X(pts[i][0]).toFixed(1)},${Y(pts[i][1]).toFixed(1)}`;
  }
  return d;
}

export interface InventoryPlan {
  /** Units arriving with this decision (the order, a modification, or the fallback) */
  quantity: number;
  kind: "decision" | "fallback";
  label: string;
}

/**
 * Next 28 days for one SKU: demand as a P10–P90 range over recent sales, and projected stock
 * with and without the decision. The decision's delivery is the only gold mark.
 */
export function DemandInventoryChart({ forecast, decision, plan, floor = 35 }: { forecast: Forecast; decision: Decision; plan: InventoryPlan; floor?: number }) {
  // recent sales (last 14 days) plus today's estimate
  const recent = forecast.history.slice(-14).map((d, i) => [i - 14, d.units] as [number, number]);
  const hist: [number, number][] = [...recent, [0, forecast.daily[0].p50]];
  const fc = forecast.daily.map((d, i) => ({ t: i + 1, ...d }));

  // on hand: walk back from today's 82 through recent sales, with the delivery a week ago
  const past: [number, number][] = [[0, decision.onHand]];
  let v = decision.onHand;
  for (let t = 0; t > T0; t--) {
    const sold = recent.find(([tt]) => tt === t - 1)?.[1] ?? 16;
    v = v + sold - (t === -7 ? 96 : 0);
    past.unshift([t - 1, Math.max(v, 0)]);
  }
  const deliveries: Record<number, number> = { 2: decision.onOrder, 5: plan.quantity, 12: 118, 19: 124, 26: 130 };
  const proj: [number, number][] = [[0, decision.onHand]];
  const without: [number, number][] = [[0, decision.onHand]];
  v = decision.onHand;
  let w = decision.onHand;
  for (const d of fc) {
    v = v - d.p50 + (deliveries[d.t] ?? 0);
    w = w - d.p50 + (d.t === 2 ? decision.onOrder : 0);
    proj.push([d.t, v]);
    without.push([d.t, Math.max(w, 0)]);
  }
  const zero = without.find(([, u]) => u <= 0)?.[0] ?? null;
  const noPath = zero ? stepPath(without.filter(([t]) => t >= 4 && t <= zero), YO) : "";

  const band =
    `M${X(0).toFixed(1)},${YD(hist[hist.length - 1][1]).toFixed(1)} L` +
    fc.map((d) => `${X(d.t).toFixed(1)},${YD(d.p90).toFixed(1)}`).join(" L") +
    " L" +
    [...fc].reverse().map((d) => `${X(d.t).toFixed(1)},${YD(d.p10).toFixed(1)}`).join(" L") +
    " Z";
  const p50 = `M${X(0).toFixed(1)},${YD(hist[hist.length - 1][1]).toFixed(1)} L` + fc.map((d) => `${X(d.t).toFixed(1)},${YD(d.p50).toFixed(1)}`).join(" L");
  const histPath = "M" + hist.map(([t, u]) => `${X(t).toFixed(1)},${YD(u).toFixed(1)}`).join(" L");
  const last = fc[fc.length - 1];
  const dateAt = (t: number) => {
    const d = new Date(`${forecast.daily[0].date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + t - 1);
    return shortDate(d.toISOString().slice(0, 10));
  };
  const ticks: [number, string][] = [[-14, dateAt(-14)], [0, `Today · ${dateAt(0)}`], [5, dateAt(5)], [12, dateAt(12)], [19, dateAt(19)], [28, dateAt(28)]].map(([t, l]) => [t as number, String(l).toUpperCase()]);
  const atDecision = proj[5];
  const beforeDecision = proj[4];
  const isDecision = plan.kind === "decision";

  return (
    <svg viewBox="0 0 1248 322" className="block w-full overflow-visible" role="img" aria-label={`Demand for the next 28 days rises from about ${Math.round(fc[0].p50)} to ${Math.round(last.p50)} units a day. ${zero ? `Without this order stock runs out on ${dateAt(zero)}.` : ""} ${plan.label} arrives ${dateAt(5)}.`}>
      <g fontFamily="var(--font-geist-mono)" fontSize="10" letterSpacing="1.4" fill={T.muted}>
        <text x="0" y="8">DEMAND · UNITS PER DAY</text>
        <text x="0" y="164">ON HAND · UNITS</text>
      </g>
      <path d={band} fill={T.range} />
      <path d={p50} fill="none" stroke={T.ink} strokeWidth="1.2" strokeDasharray="4 3" />
      <path d={histPath} fill="none" stroke={T.ink} strokeWidth="1.8" />
      <g fontFamily="var(--font-geist-mono)" fontSize="10" fill={T.muted}>
        <text x={X(28) + 10} y={YD(last.p90) + 4}>P90 {Math.round(last.p90)}</text>
        <text x={X(28) + 10} y={YD(last.p50) + 4}>P50 {Math.round(last.p50)}</text>
        <text x={X(28) + 10} y={YD(last.p10) + 4}>P10 {Math.round(last.p10)}</text>
      </g>
      <line x1="0" y1={YO(0)} x2={PW} y2={YO(0)} stroke={T.ink} strokeWidth="1" />
      <line x1="0" y1={YO(floor)} x2={PW} y2={YO(floor)} stroke={T.muted} strokeWidth="1" strokeDasharray="2 3" />
      <text x={X(28) + 10} y={YO(floor) + 4} fontFamily="var(--font-geist-mono)" fontSize="10" fill={T.muted}>
        FLOOR {floor}
      </text>
      {noPath && <path d={noPath} fill="none" stroke={T.oxblood} strokeWidth="1.4" strokeDasharray="3 3" />}
      <path d={stepPath([...past, ...proj.slice(1)], YO)} fill="none" stroke={T.ink} strokeWidth="2" />
      {[12, 19, 26].map((t) => (
        <line key={t} x1={X(t)} y1={YO(0) + 4} x2={X(t)} y2={YO(0) - 6} stroke={T.muted} strokeWidth="1" />
      ))}
      <line x1={X(5)} y1={YO(beforeDecision[1])} x2={X(5)} y2={YO(atDecision[1])} stroke={isDecision ? T.gold : T.ink} strokeWidth="5" />
      <circle cx={X(5)} cy={YO(atDecision[1])} r="5" fill={isDecision ? T.gold : T.ground} stroke={T.ink} strokeWidth="1.4" />
      <text x={X(5) + 12} y={YO(atDecision[1]) - 2} fontFamily="var(--font-geist)" fontSize="13" fontWeight="500" fill={T.ink}>
        {plan.label}
      </text>
      {zero && (
        <text x={X(zero) + 8} y={YO(0) - 8} fontFamily="var(--font-geist)" fontSize="12" fill={T.oxblood}>
          Without it: sold out {dateAt(zero)}
        </text>
      )}
      <line x1={X(0)} y1="0" x2={X(0)} y2={YO(0) + 6} stroke={T.ink} strokeWidth="1" />
      <g fontFamily="var(--font-geist-mono)" fontSize="10" letterSpacing="1.2" fill={T.muted}>
        {ticks.map(([t, l]) => (
          <text key={t} x={X(t)} y="316" textAnchor={t === -14 ? "start" : t === 28 ? "end" : "middle"}>
            {l}
          </text>
        ))}
      </g>
    </svg>
  );
}
