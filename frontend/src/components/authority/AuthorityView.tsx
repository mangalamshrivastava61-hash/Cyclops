"use client";

import { useState } from "react";
import type { AuthorityLevel, AuthorityRecord, Product } from "@/types";
import { OracleView } from "@/components/oracle-object/OracleView";
import { AuthorityHistory } from "@/components/charts/AuthorityHistory";
import { Chip, Eyebrow, Serif, TextLink, cx } from "@/components/ui/primitives";
import { useAuthorityLevel, useOracleStore } from "@/lib/store/oracle-store";

const STATEMENT: Record<AuthorityLevel, [string, string]> = {
  0: ["You decide", "alone."],
  1: ["ORACLE suggests.", "You decide."],
  2: ["ORACLE proposes.", "You approve."],
  3: ["ORACLE acts.", "You're told."],
  4: ["ORACLE acts.", "You review weekly."],
};

export function AuthorityView({ record, product }: { record: AuthorityRecord; product: Product }) {
  const auth = useAuthorityLevel(record.sku);
  const setCircuit = useOracleStore((s) => s.setCircuit);
  const setProbesPreview = useOracleStore((s) => s.setProbesPreview);
  const [focus, setFocus] = useState<AuthorityLevel | null>(null);
  const level = auth.level;
  const [a, b] = STATEMENT[level];
  const inspected = record.levels.find((l) => l.level === (focus ?? level))!;
  const warning = auth.circuit === "bench";
  const history = [...record.history.slice(0, -1), { ...record.history[record.history.length - 1], level }];

  return (
    <div className="pt-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-8 xl:grid-cols-[440px_1fr_304px] xl:gap-6">
        <div className="relative z-10 flex flex-col lg:col-span-2 xl:col-span-1">
          <Eyebrow>
            Earned autonomy · {product.name} · {auth.preview || warning ? "Simulated" : "Today"}
          </Eyebrow>
          <h1 aria-live="polite" className="mt-5 font-medium tracking-[-0.05em] text-[clamp(48px,5vw,72px)] leading-[0.98]">
            {a}
            <Serif className="block text-[clamp(52px,5.6vw,80px)] leading-none tracking-normal">{b}</Serif>
          </h1>
          <p className="mt-7 max-w-[400px] text-[17px] leading-[1.55] text-ink2">ORACLE is given more freedom only after weeks of good evidence, and it loses that freedom as soon as a warning appears.</p>
          <p className="mt-3 max-w-[400px] text-[13px] leading-[1.5] text-muted">ORACLE proposes. Evidence determines how much authority it receives. The human remains in control.</p>
          <TextLink href="/circuit" className="mt-5 self-start text-[13px]">View the decision circuit</TextLink>
          {(auth.preview || warning) && (
            <button
              type="button"
              onClick={() => {
                setProbesPreview(false);
                setCircuit("clear");
              }}
              className="link-underline fade-in mt-5 self-start text-[13px]"
            >
              Back to today · L{record.earnedLevel}
            </button>
          )}
        </div>

        <OracleView
          variant="authority"
          authorityLevel={level}
          authorityFocus={focus}
          label={`The ORACLE object as a stack of five levels. Levels up to L${level} are built, L${level} in gold; higher levels are only drawn in outline.`}
          fallback="/renders/objAuthority.webp"
          className="h-[420px] w-full lg:-mt-2 lg:h-[500px]"
        />

        <div className="flex flex-col lg:pt-[58px]">
          <Eyebrow className="!text-[10px]">How much ORACLE may do alone</Eyebrow>
          <ol className="mt-3 flex flex-col-reverse border-b border-hairline">
            {record.levels.map((l) => {
              const now = l.level === level;
              const above = l.level > level;
              return (
                <li key={l.level}>
                  <button
                    type="button"
                    onMouseEnter={() => setFocus(l.level)}
                    onMouseLeave={() => setFocus(null)}
                    onFocus={() => setFocus(l.level)}
                    onBlur={() => setFocus(null)}
                    onClick={() => setFocus(focus === l.level ? null : l.level)}
                    aria-current={now ? "step" : undefined}
                    className={cx("grid h-[54px] w-full grid-cols-[34px_1fr_auto] items-center border-t border-hairline text-left transition-colors", focus === l.level && "bg-paper")}
                  >
                    <span className={cx("font-mono text-[11px]", above ? "text-muted" : "text-ink")}>L{l.level}</span>
                    <span className={cx("text-[15px]", above ? "text-muted" : "text-ink", now && "font-medium")}>{l.plain}</span>
                    {now ? (
                      <Chip kind="review">Now</Chip>
                    ) : above ? (
                      <span className="font-mono text-[9.5px] tracking-[0.14em] text-muted">{l.level === 3 && record.earnedLevel === 2 && !auth.preview ? "LOST WK 26" : "NOT YET"}</span>
                    ) : (
                      <span />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          <p aria-live="polite" className="mt-4 min-h-[66px] text-[13.5px] leading-normal text-ink2">
            <span className="font-medium text-ink">
              L{inspected.level} · {inspected.short}.
            </span>{" "}
            {inspected.detail}
          </p>
        </div>
      </div>

      <section className="mt-8 grid grid-cols-1 gap-10 border-t border-ink pt-6 md:grid-cols-2 lg:grid-cols-[250px_250px_1fr]">
        <div className="flex flex-col gap-2">
          <Eyebrow className="!text-[10px]">How it earns more</Eyebrow>
          <span className="text-[22px] leading-[1.15] font-medium tracking-[-0.02em]">{record.earn.headline}</span>
          <span className="text-[13px] leading-normal text-ink2">{record.earn.detail}</span>
          <button type="button" aria-pressed={auth.preview} onClick={() => setProbesPreview(!auth.preview)} className="link-underline mt-2 self-start text-[13px]">
            {auth.preview ? "Undo the preview" : "Preview: probes cut hidden demand to 4%"}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <Eyebrow className="!text-[10px]">How it loses it</Eyebrow>
          <span className="text-[22px] leading-[1.15] font-medium tracking-[-0.02em]">{record.lose.headline}</span>
          <span className="text-[13px] leading-normal text-ink2">{record.lose.detail}</span>
          <button type="button" aria-pressed={warning} onClick={() => setCircuit(warning ? "clear" : "bench")} className={cx("link-underline mt-2 self-start text-[13px]", !warning && "!border-oxblood text-oxblood")}>
            {warning ? "Clear the warning" : "Simulate a warning"}
          </button>
        </div>
        <div className="flex flex-col gap-3.5 md:col-span-2 lg:col-span-1 lg:pl-10">
          <Eyebrow className="!text-[10px]">The last 26 weeks</Eyebrow>
          <div className="pl-6">
            <AuthorityHistory history={history} now={level} />
          </div>
          <span className="mt-2 text-[12px] text-muted">
            Synthetic world. In a real store ORACLE starts at L{record.realWorldStart} and stays advisory until proven. <TextLink href="/evidence/18513" className="text-[12px]">See the evidence</TextLink> <TextLink href="/history" className="ml-3 text-[12px]">View history</TextLink>
          </span>
        </div>
      </section>
    </div>
  );
}
