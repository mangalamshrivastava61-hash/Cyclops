import { T } from "@/lib/tokens";

/** Stock position after the order: on hand, on order, and this order (gold, the decision). */
export function PositionBar({ onHand, onOrder, order, p50, width = 230 }: { onHand: number; onOrder: number; order: number; p50: number; width?: number }) {
  const max = Math.max(270, onHand + onOrder + order + 10);
  const k = width / max;
  const total = onHand + onOrder + order;
  return (
    <svg width={width} height="84" viewBox={`0 0 ${width} 84`} className="block overflow-visible" role="img" aria-label={`Position: ${onHand} on hand, ${onOrder} on order and ${order} in this order, totalling ${total}.`}>
      <rect x="0" y="20" width={onHand * k} height="26" fill={T.ink} />
      <rect x={onHand * k} y="20" width={onOrder * k} height="26" fill={T.rule} />
      <rect x={(onHand + onOrder) * k} y="20" width={order * k} height="26" fill={T.gold} />
      <line x1={p50 * k} y1="10" x2={p50 * k} y2="52" stroke={T.ink} strokeWidth="1" strokeDasharray="2 2" />
      <text x={p50 * k} y="6" fontFamily="var(--font-geist-mono)" fontSize="9" fill={T.muted} textAnchor="middle">
        P50 {p50}
      </text>
      <g fontFamily="var(--font-geist-mono)" fontSize="10" fill={T.ink}>
        <text x="0" y="64">{onHand}</text>
        <text x={onHand * k} y="64">{onOrder}</text>
        <text x={(onHand + onOrder) * k} y="64" fontWeight="600">{order}</text>
        <text x={total * k} y="64" textAnchor="end">={total}</text>
      </g>
      <g fontFamily="var(--font-geist)" fontSize="10" fill={T.muted}>
        <text x="0" y="78">on hand</text>
        <text x={onHand * k} y="78">due</text>
        <text x={(onHand + onOrder) * k} y="78">this order</text>
      </g>
    </svg>
  );
}
