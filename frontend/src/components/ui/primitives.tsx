import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { AuthorityChipKind, Grade } from "@/types";
import { T } from "@/lib/tokens";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Eyebrow({ children, className, as: As = "span", tone = "muted" }: { children: ReactNode; className?: string; as?: "span" | "p" | "h2" | "h3" | "div"; tone?: "muted" | "ink" | "oxblood" }) {
  return (
    <As className={cx("eyebrow", tone === "ink" && "!text-ink", tone === "oxblood" && "!text-oxblood", className)}>{children}</As>
  );
}

export function Serif({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("serif", className)}>{children}</span>;
}

export function Arrow({ color = "currentColor", size = 12, className }: { color?: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className={className}>
      <path d="M2 6 H10 M7 3 L10 6 L7 9" fill="none" stroke={color} strokeWidth="1.3" />
    </svg>
  );
}

export function LogoMark({ size = 22, stroke = 1.4 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <rect x="3" y="2.5" width="20" height="6" rx="1.2" fill="none" stroke={T.ink} strokeWidth={stroke} />
      <rect x="3" y="10" width="20" height="6" rx="1.2" fill="none" stroke={T.ink} strokeWidth={stroke} />
      <rect x="3" y="17.4" width="20" height="1.5" fill={T.gold} />
      <rect x="3" y="19.6" width="20" height="4.4" rx="1" fill={T.ink} />
    </svg>
  );
}

const chipStyles: Record<AuthorityChipKind | "sealed" | "rejected", string> = {
  review: "bg-gold text-ink px-2 py-[4px]",
  act: "border border-ink text-ink px-2 py-[3px]",
  advisory: "border border-rule text-muted px-2 py-[3px]",
  sealed: "border border-rule text-muted px-2 py-[3px]",
  rejected: "border border-rule text-muted px-2 py-[3px]",
  bench: "border border-oxblood text-oxblood px-2 py-[3px]",
};

/** Authority chip. Only "review" (an authority state awaiting a person) is gold. */
export function Chip({ kind, children, className }: { kind: keyof typeof chipStyles; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-[2px] font-mono text-[10px] leading-none tracking-[0.14em] uppercase", chipStyles[kind], className)}>
      {children}
    </span>
  );
}

/** Evidence grades are carried by shape, never by colour alone. */
export function GradeGlyph({ grade, size = 10 }: { grade: Grade; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 12 12", "aria-hidden": true } as const;
  if (grade === "pass") return <svg {...common}><circle cx="6" cy="6" r="5" fill={T.ink} /></svg>;
  if (grade === "partial")
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="5" fill="none" stroke={T.ink} strokeWidth="1.3" />
        <path d="M6 1 A5 5 0 0 1 6 11 Z" fill={T.ink} />
      </svg>
    );
  if (grade === "insufficient") return <svg {...common}><circle cx="6" cy="6" r="4.6" fill="none" stroke={T.muted} strokeWidth="1.2" /></svg>;
  return (
    <svg {...common}>
      <circle cx="6" cy="6" r="5" fill="none" stroke={T.oxblood} strokeWidth="1.3" />
      <path d="M2.6 9.4 L9.4 2.6" stroke={T.oxblood} strokeWidth="1.3" />
    </svg>
  );
}

export const gradeLabel: Record<Grade, string> = { pass: "Pass", partial: "Partial", insufficient: "Insufficient", failed: "Failed" };

export function GradeTag({ grade, size = 11 }: { grade: Grade; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-mono font-semibold uppercase tracking-[0.16em]", grade === "insufficient" && "text-muted", grade === "failed" && "text-oxblood")} style={{ fontSize: size }}>
      <GradeGlyph grade={grade} size={size + 1} />
      {gradeLabel[grade]}
    </span>
  );
}

type BtnBase = { children: ReactNode; className?: string; arrow?: boolean };
const primaryCls = "inline-flex h-12 items-center gap-3 rounded-[2px] bg-ink px-[22px] text-[14px] font-medium text-ground transition-[background-color,transform] duration-200 hover:bg-ink2 active:translate-y-px disabled:opacity-40";
const secondaryCls = "inline-flex h-12 items-center gap-3 rounded-[2px] border border-ink px-[22px] text-[14px] text-ink transition-colors duration-200 hover:bg-ink hover:text-ground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink";

/** Primary action. The gold arrow marks it as the committing action. */
export function PrimaryButton({ children, className, arrow = true, ...rest }: BtnBase & ComponentProps<"button">) {
  return (
    <button type="button" className={cx(primaryCls, className)} {...rest}>
      {children}
      {arrow && <Arrow color={T.gold} />}
    </button>
  );
}
export function PrimaryLink({ children, className, arrow = true, ...rest }: BtnBase & ComponentProps<typeof Link>) {
  return (
    <Link className={cx(primaryCls, className)} {...rest}>
      {children}
      {arrow && <Arrow color={T.gold} />}
    </Link>
  );
}
export function SecondaryButton({ children, className, ...rest }: BtnBase & ComponentProps<"button">) {
  return (
    <button type="button" className={cx(secondaryCls, className)} {...rest}>
      {children}
    </button>
  );
}
export function SecondaryLink({ children, className, ...rest }: BtnBase & ComponentProps<typeof Link>) {
  return (
    <Link className={cx(secondaryCls, className)} {...rest}>
      {children}
    </Link>
  );
}
export function TextLink({ children, className, arrow, ...rest }: BtnBase & ComponentProps<typeof Link>) {
  return (
    <Link className={cx("link-underline inline-flex items-center gap-2", className)} {...rest}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}

/** A hero number with the gold underline that marks it as the decision. */
export function DecisionNumber({ value, className, underline = true, label }: { value: ReactNode; className?: string; underline?: boolean; label?: string }) {
  return (
    <span className={cx("relative inline-block hero-number", className)} aria-label={label}>
      {value}
      {underline && <span aria-hidden="true" className="absolute right-[0.09em] left-[0.035em] -bottom-[0.075em] h-[0.03em] min-h-[5px] bg-gold" />}
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx("relative inline-flex h-4 w-[30px] shrink-0 items-center rounded-full transition-colors duration-200", on ? "bg-ink" : "border border-rule")}
    >
      <span className={cx("absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all duration-200 ease-[var(--ease-product)]", on ? "left-[16px] bg-ground" : "left-[2px] h-[10px] w-[10px] bg-rule")} />
    </button>
  );
}
