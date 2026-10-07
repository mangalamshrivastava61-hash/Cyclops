import type { SalesDay } from "@/types";
import { T } from "@/lib/tokens";
import { dayLabel } from "@/lib/format";

/** Daily sales; on sell-out days the demand that was never seen is drawn as a dashed outline. */
export function DailySales({ days, width = 230, height = 84 }: { days: SalesDay[]; width?: number; height?: number }) {
  const step = width / days.length;
  const bw = Math.max(3, step - 2.2);
  const top = Math.max(...days.map((d) => d.units + (d.hiddenUnits ?? 0)));
  const k = (height - 26) / top;
  const baseY = height - 24;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible" role="img" aria-label={`Daily sales for ${days.length} days. On ${days.filter((d) => d.soldOut).length} days the item sold out, so demand beyond stock was never seen.`}>
      {days.map((d, i) => {
        const x = i * step;
        const h = d.units * k;
        return (
          <g key={d.date}>
            {d.soldOut && d.hiddenUnits ? <rect x={x} y={baseY - h - d.hiddenUnits * k} width={bw} height={d.hiddenUnits * k} fill="none" stroke={T.ink} strokeWidth="1" strokeDasharray="2 1.5" /> : null}
            <rect x={x} y={baseY - h} width={bw} height={h} fill={d.soldOut ? T.ink : T.ink2} />
          </g>
        );
      })}
      <line x1="0" y1={baseY + 0.5} x2={width} y2={baseY + 0.5} stroke={T.ink} strokeWidth="1" />
      <g fontFamily="var(--font-geist-mono)" fontSize="9.5" fill={T.muted}>
        <text x="0" y={height - 8}>{dayLabel(days[0].date).slice(4).toUpperCase()}</text>
        <text x={width} y={height - 8} textAnchor="end">{dayLabel(days[days.length - 1].date).slice(4).toUpperCase()}</text>
      </g>
    </svg>
  );
}
