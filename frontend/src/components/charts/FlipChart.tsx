import { T } from "@/lib/tokens";

export interface FlipCurve {
  points: { lead: number; order: number }[];
  keep: number;
  flipLead: number | null;
  current: { lead: number; order: number };
  baseLead: number;
}

/** Best order as lead time grows. The band is "the same decision" (±10%); leaving it is the flip point. */
export function FlipChart({ curve, width = 520, height = 120 }: { curve: FlipCurve; width?: number; height?: number }) {
  const minL = curve.points[0].lead;
  const maxL = curve.points[curve.points.length - 1].lead;
  const orders = curve.points.map((p) => p.order);
  const lo = Math.min(80, ...orders) - 5;
  const hi = Math.max(210, ...orders) + 5;
  const lx = (d: number) => ((d - minL) / (maxL - minL)) * width;
  const oy = (o: number) => height - 16 - ((o - lo) / (hi - lo)) * (height - 26);
  const line = "M" + curve.points.map((p) => `${lx(p.lead).toFixed(1)},${oy(p.order).toFixed(1)}`).join(" L");
  const bandHi = curve.keep * 1.1;
  const bandLo = curve.keep * 0.9;
  const changed = Math.abs(curve.current.order - curve.keep) > curve.keep * 0.1;
  return (
    <svg viewBox={`0 0 ${width} ${height + 20}`} className="block w-full max-w-[520px] overflow-visible" role="img" aria-label={`Best order rises with lead time.${curve.flipLead ? ` It leaves the band around ${curve.keep} at ${curve.flipLead.toFixed(1)} days.` : " It stays inside the band."} At ${curve.current.lead} days it is ${curve.current.order}.`}>
      <path d={`M0,${oy(bandHi)} L${width},${oy(bandHi)} L${width},${oy(bandLo)} L0,${oy(bandLo)} Z`} fill={T.range} />
      <text x="4" y={oy(bandHi) - 6} fontFamily="var(--font-geist-mono)" fontSize="9.5" fill={T.muted}>
        {curve.keep} ± 10% · SAME DECISION
      </text>
      <path d={line} fill="none" stroke={T.ink} strokeWidth="1.8" />
      {curve.flipLead !== null && curve.flipLead >= minL && curve.flipLead <= maxL && (
        <>
          <line x1={lx(curve.flipLead)} y1="6" x2={lx(curve.flipLead)} y2={height - 16} stroke={T.ink} strokeWidth="1" strokeDasharray="2 3" />
          <text x={lx(curve.flipLead) + 6} y="14" fontFamily="var(--font-geist-mono)" fontSize="10" fill={T.ink}>
            FLIP {curve.flipLead.toFixed(1)} DAYS
          </text>
        </>
      )}
      <circle cx={lx(curve.baseLead)} cy={oy(curve.keep)} r="4" fill={T.ground} stroke={T.ink} strokeWidth="1.4" />
      <circle cx={lx(curve.current.lead)} cy={oy(curve.current.order)} r="5.5" fill={changed ? T.gold : T.ground} stroke={T.ink} strokeWidth="1.4" style={{ transition: "cx 400ms, cy 400ms" }} />
      <text x={lx(curve.current.lead) + 10} y={oy(curve.current.order) + 4} fontFamily="var(--font-geist)" fontSize="12" fontWeight="500" fill={T.ink}>
        {curve.current.order}
      </text>
      <line x1="0" y1={height - 16} x2={width} y2={height - 16} stroke={T.ink} strokeWidth="1" />
      <g fontFamily="var(--font-geist-mono)" fontSize="9.5" fill={T.muted} textAnchor="middle">
        <text x={lx(minL)} y={height + 2} textAnchor="start">
          {minL} DAYS
        </text>
        <text x={lx(curve.baseLead)} y={height + 2}>{curve.baseLead} · TODAY</text>
        <text x={lx(maxL)} y={height + 2} textAnchor="end">
          {maxL} DAYS
        </text>
      </g>
    </svg>
  );
}
