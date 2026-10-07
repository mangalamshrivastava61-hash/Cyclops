import type { AuthorityRecord } from "@/types";
import { T } from "@/lib/tokens";

/** 26 weeks of authority. Promotion needs a full window of evidence; demotion is immediate. */
export function AuthorityHistory({ history, now, width = 640, height = 120 }: { history: AuthorityRecord["history"]; now: number; width?: number; height?: number }) {
  const n = history.length;
  const wx = (w: number) => ((w - 1) / (n - 1)) * width;
  const ly = (l: number) => height - 20 - l * 22;
  const shift = width / 50;
  let d = `M0,${ly(history[0].level)}`;
  for (let i = 1; i < n; i++) {
    if (history[i].level !== history[i - 1].level) {
      d += ` L${(wx(history[i].week) - shift).toFixed(1)},${ly(history[i - 1].level)} L${(wx(history[i].week) - shift).toFixed(1)},${ly(history[i].level)}`;
    }
  }
  d += ` L${width},${ly(history[n - 1].level)}`;
  const bench = history.find((h) => h.note?.startsWith("Benched"));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block w-full overflow-visible" role="img" aria-label="Authority over 26 weeks: advisory, then human review from week 5, limited autonomy from week 11, benched to advisory at week 16, human review from week 21, limited autonomy in weeks 24 and 25, and human review now.">
      <g fontFamily="var(--font-geist-mono)" fontSize="9.5" fill={T.muted}>
        {[0, 1, 2, 3, 4].map((l) => (
          <g key={l}>
            <line x1="0" y1={ly(l)} x2={width} y2={ly(l)} stroke="#E6DFD2" strokeWidth="1" />
            <text x="-10" y={ly(l) + 3} textAnchor="end">
              L{l}
            </text>
          </g>
        ))}
      </g>
      <path d={d} fill="none" stroke={T.ink} strokeWidth="2" />
      {bench && (
        <>
          <circle cx={wx(bench.week) - shift} cy={ly(1)} r="4.5" fill={T.oxblood} />
          <text x={wx(bench.week) - shift + 8} y={ly(1) + 16} fontFamily="var(--font-geist)" fontSize="11" fill={T.oxblood}>
            Benched · wk {bench.week}
          </text>
        </>
      )}
      <circle cx={width} cy={ly(now)} r="6" fill={T.gold} stroke={T.ink} strokeWidth="1.4" style={{ transition: "cy 500ms" }} />
      <g fontFamily="var(--font-geist-mono)" fontSize="9.5" fill={T.muted}>
        <text x="0" y={height + 2}>APR</text>
        <text x={width / 2} y={height + 2} textAnchor="middle">
          JUN
        </text>
        <text x={width} y={height + 2} textAnchor="end">
          NOW · WK {n}
        </text>
      </g>
    </svg>
  );
}
