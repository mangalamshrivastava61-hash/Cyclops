import type { EvidenceGrade } from "@/types";
import { T } from "@/lib/tokens";
import { shortDate } from "@/lib/format";

const W = 300;
const scale = (lo: number, hi: number) => (v: number) => ((v - lo) / (hi - lo)) * W;
const Label = ({ x, children, anchor = "start" }: { x: number; children: React.ReactNode; anchor?: "start" | "middle" | "end" }) => (
  <text x={x} y="34" textAnchor={anchor}>
    {children}
  </text>
);

/** A one-line visual measurement for each evidence grade. */
export function EvidenceMicro({ measure }: { measure: EvidenceGrade["measure"] }) {
  const g = { fontFamily: "var(--font-geist-mono)", fontSize: 9.5, fill: T.muted };
  switch (measure.kind) {
    case "coverage": {
      const x = scale(60, 100);
      return (
        <svg viewBox={`0 0 ${W} 40`} className="block w-full max-w-[300px]" role="img" aria-label={`Coverage ${measure.value}% against a target of ${measure.target} ± ${measure.tolerance}`}>
          <rect x={x(measure.target - measure.tolerance)} y="6" width={x(measure.target + measure.tolerance) - x(measure.target - measure.tolerance)} height="12" fill={T.range} />
          <line x1="0" y1="12" x2={W} y2="12" stroke={T.ink} />
          <circle cx={x(measure.value)} cy="12" r="5" fill={T.ink} />
          <g {...g}>
            <Label x={0}>60%</Label>
            <Label x={x(measure.target)} anchor="middle">TARGET {measure.target} ± {measure.tolerance}</Label>
            <Label x={W} anchor="end">100%</Label>
          </g>
        </svg>
      );
    }
    case "observability": {
      const days = measure.days;
      const step = W / days.length;
      const hidden = days.filter((d) => d.soldOut).length;
      return (
        <svg viewBox={`0 0 ${W} 40`} className="block w-full max-w-[300px]" role="img" aria-label={`${days.length} days; on ${hidden} days the item sold out and demand was not observed`}>
          {days.map((d, i) => (d.soldOut ? <rect key={d.date} x={i * step} y="2" width={step - 3.7} height="18" fill="none" stroke={T.ink} /> : <rect key={d.date} x={i * step} y="2" width={step - 3.7} height="18" fill={T.ink2} />))}
          <g {...g}>
            <Label x={0}>{shortDate(days[0].date).toUpperCase()}</Label>
            <Label x={W} anchor="end">
              {shortDate(days[days.length - 1].date).toUpperCase()} · {hidden} DAYS HIDDEN
            </Label>
          </g>
        </svg>
      );
    }
    case "service": {
      const x = scale(85, 100);
      return (
        <svg viewBox={`0 0 ${W} 40`} className="block w-full max-w-[300px]" role="img" aria-label={`In-stock rate ${measure.value}% against a ${measure.target}% target`}>
          <line x1="0" y1="12" x2={W} y2="12" stroke={T.ink} />
          <line x1={x(measure.target)} y1="3" x2={x(measure.target)} y2="21" stroke={T.muted} strokeDasharray="2 2" />
          <rect x="0" y="9" width={x(measure.value)} height="6" fill={measure.value >= measure.target ? T.ink : T.oxblood} />
          <g {...g}>
            <Label x={0}>85%</Label>
            <Label x={x(measure.target)} anchor="middle">TARGET {measure.target}</Label>
            <Label x={W} anchor="end">100%</Label>
          </g>
        </svg>
      );
    }
    case "value": {
      const x = scale(-2, 4);
      return (
        <svg viewBox={`0 0 ${W} 40`} className="block w-full max-w-[300px]" role="img" aria-label={`Contribution ${measure.point}%, 95% interval ${measure.low} to ${measure.high}`}>
          <line x1="0" y1="12" x2={W} y2="12" stroke={T.rule} />
          <line x1={x(0)} y1="2" x2={x(0)} y2="22" stroke={T.ink} />
          <line x1={x(measure.low)} y1="12" x2={x(measure.high)} y2="12" stroke={T.ink} strokeWidth="3" />
          <circle cx={x(measure.point)} cy="12" r="5" fill={T.ink} />
          <g {...g}>
            <Label x={0}>−2%</Label>
            <Label x={x(0)} anchor="middle">0</Label>
            <Label x={W} anchor="end">+4%</Label>
          </g>
        </svg>
      );
    }
    case "identification": {
      const pos = [5, 150, W - 5];
      return (
        <svg viewBox={`0 0 ${W} 40`} className="block w-full max-w-[300px]" role="img" aria-label="Evidence ladder: observational data only; no quasi-experimental or randomized test yet">
          <line x1="5" y1="12" x2={W - 5} y2="12" stroke={T.rule} strokeDasharray="3 3" />
          {pos.map((p, i) => (i <= measure.rung ? <circle key={p} cx={p} cy="12" r="5" fill={T.ink} /> : <circle key={p} cx={p} cy="12" r="4.5" fill={T.ground} stroke={T.muted} strokeWidth="1.2" />))}
          <g {...g}>
            <Label x={0}>OBSERVED</Label>
            <Label x={150} anchor="middle">QUASI-EXP.</Label>
            <Label x={W} anchor="end">RANDOMIZED</Label>
          </g>
        </svg>
      );
    }
  }
}
