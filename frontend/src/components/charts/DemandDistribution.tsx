import { T } from "@/lib/tokens";

/** Demand over the protection period: P10–P90 in the range tone, the target position in gold. */
export function DemandDistribution({ p10, p50, p90, target, width = 270, height = 86, labels = true }: { p10: number; p50: number; p90: number; target: number; width?: number; height?: number; labels?: boolean }) {
  const sd = (p90 - p10) / 2.563;
  const x0 = p50 - 2.1 * sd;
  const x1 = p50 + 2.3 * sd;
  const sx = (v: number) => ((v - x0) / (x1 - x0)) * width;
  const base = height - 22;
  const amp = base - 8;
  const y = (v: number) => base - amp * Math.exp(-0.5 * ((v - p50) / sd) ** 2);
  const pts = Array.from({ length: 121 }, (_, i) => x0 + ((x1 - x0) * i) / 120);
  const line = "M" + pts.map((v) => `${sx(v).toFixed(1)},${y(v).toFixed(1)}`).join(" L");
  const inBand = pts.filter((v) => v >= p10 && v <= p90);
  const band = `M${sx(p10).toFixed(1)},${base} L${sx(p10).toFixed(1)},${y(p10).toFixed(1)} L` + inBand.map((v) => `${sx(v).toFixed(1)},${y(v).toFixed(1)}`).join(" L") + ` L${sx(p90).toFixed(1)},${y(p90).toFixed(1)} L${sx(p90).toFixed(1)},${base} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible" role="img" aria-label={`Demand over the protection period: P10 ${p10}, P50 ${p50}, P90 ${p90} units. Target position ${target}.`}>
      <path d={band} fill={T.range} />
      <path d={line} fill="none" stroke={T.ink} strokeWidth="1.5" />
      <line x1="0" y1={base} x2={width} y2={base} stroke={T.ink} strokeWidth="1" />
      <line x1={sx(p50)} y1={y(p50)} x2={sx(p50)} y2={base} stroke={T.ink} strokeWidth="1" strokeDasharray="2 2" />
      <line x1={sx(target)} y1="2" x2={sx(target)} y2={base + 4} stroke={T.gold} strokeWidth="3" />
      {labels && (
        <g fontFamily="var(--font-geist-mono)" fontSize="9.5" fill={T.muted} textAnchor="middle">
          <text x={sx(p10)} y={height - 6}>{p10}</text>
          {Math.abs(sx(target) - sx(p50)) > 22 && <text x={sx(p50)} y={height - 6}>{p50}</text>}
          <text x={sx(p90) + 9} y={height - 6}>{p90}</text>
          <text x={sx(target) - 4} y={height - 6} textAnchor="end" fontWeight="600" fill={T.ink}>
            {target}
          </text>
        </g>
      )}
    </svg>
  );
}
