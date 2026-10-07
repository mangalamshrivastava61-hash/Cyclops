import { T } from "@/lib/tokens";

/** A precision readout track: the reading in ink, the trip threshold in oxblood. */
export function Gauge({ frac, threshold, tripped, width = 170 }: { frac: number; threshold: number; tripped?: boolean; width?: number }) {
  const t = Math.min(width - 0.6, width * threshold);
  return (
    <svg width={width} height="14" viewBox={`0 0 ${width} 14`} aria-hidden="true" className="block">
      <line x1="0" y1="7" x2={width} y2="7" stroke={T.rule} />
      <line x1="0" y1="7" x2={width * frac} y2="7" stroke={tripped ? T.oxblood : T.ink} strokeWidth="3" style={{ transition: "x2 500ms cubic-bezier(0.22,1,0.36,1)" }} />
      <line x1={t} y1="1" x2={t} y2="13" stroke={T.oxblood} strokeWidth="1.2" />
    </svg>
  );
}
