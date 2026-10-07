"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StressKey, StressState } from "@/types";
import type { DecisionBundle } from "@/lib/services/repository";
import { stress as stressData, world } from "@/lib/services/repository";
import { analyse, flipCurve } from "@/lib/stress";
import { solve, NEUTRAL } from "@/lib/model/policy";
import { useDecisionAction, useOracleStore } from "@/lib/store/oracle-store";
import { OracleView } from "@/components/oracle-object/OracleView";
import { FlipChart } from "@/components/charts/FlipChart";
import { Arrow, DecisionNumber, Eyebrow, PrimaryButton, SecondaryButton, Serif, Toggle, cx } from "@/components/ui/primitives";
import { T } from "@/lib/tokens";

export function BreakMyPlan({ bundle }: { bundle: DecisionBundle }) {
  const { decision, product, policy } = bundle;
  const keep = decision.recommendedOrder;
  const baseLead = product.leadTimeDays;
  const [state, setState] = useState<StressState>(stressData.initial);
  const [done, setDone] = useState<null | { kind: "supplier" | "use"; text: string; entry: string }>(null);
  const action = useDecisionAction(decision.id);
  const modify = useOracleStore((s) => s.modify);
  const logNote = useOracleStore((s) => s.logNote);

  const a = useMemo(() => analyse(policy, state, keep, baseLead), [policy, state, keep, baseLead]);
  const curve = useMemo(() => flipCurve(policy, state, keep, baseLead), [policy, state, keep, baseLead]);
  const singles = useMemo(
    () => stressData.singles.map((x) => ({ ...x, r: solve(policy, { ...NEUTRAL, [x.key]: x.value }, keep) })),
    [policy, keep],
  );

  const delta = a.res.order - keep;
  const pose = { shear: Math.min(1.4, Math.abs(delta) / 38), lift: 0.34 * Math.max(-0.1, Math.min(1.8, delta / 38)) };
  const set = (k: StressKey, patch: Partial<{ on: boolean; value: number }>) => {
    setDone(null);
    setState((s) => ({ ...s, [k]: { ...s[k], ...patch } }));
  };
  const applySingle = (k: StressKey, value: number) => {
    setDone(null);
    setState(Object.fromEntries((Object.keys(state) as StressKey[]).map((key) => [key, { on: key === k, value: key === k ? value : state[key].value }])) as StressState);
  };
  const supplierDriver = a.driver === "leadTime" || a.driver === "shortfall";
  const pending = action.status === "pending";
  const primary = stressData.controls.filter((c) => c.group === "primary");
  const more = stressData.controls.filter((c) => c.group === "more");

  return (
    <div className="pt-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_1fr_300px] lg:gap-8 xl:grid-cols-[260px_1fr_340px]">
        {/* stresses */}
        <div className="flex flex-col">
          <Eyebrow>Break my plan · Order #{decision.id}</Eyebrow>
          <h1 className="mt-5 font-medium tracking-[-0.05em] text-[clamp(44px,4.2vw,60px)] leading-[0.98] lg:w-[420px]">
            How fragile
            <Serif className="block text-[clamp(40px,3.75vw,54px)] leading-[1.02] tracking-normal">is this decision?</Serif>
          </h1>
          <p className="mt-5 max-w-[340px] text-[15px] leading-[1.5] text-ink2">What happens if the assumptions behind this recommendation change?</p>
          <div role="group" aria-label="Stresses" className="mt-8 flex flex-col">
            {primary.map((c) => (
              <Control key={c.id} def={c} value={state[c.id]} onChange={(p) => set(c.id, p)} />
            ))}
            <details className="group border-t border-hairline">
              <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-[13px] text-ink2 marker:hidden">
                <span className="eyebrow !text-[10px]">More stresses</span>
                <span className="font-mono text-[11px] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              {more.map((c) => (
                <Control key={c.id} def={c} value={state[c.id]} onChange={(p) => set(c.id, p)} />
              ))}
            </details>
          </div>
        </div>

        {/* the object under stress */}
        <div className="relative">
          <OracleView variant="stress" pose={pose} label={`The ORACLE object under stress: the layers shear ${pose.shear > 0.05 ? "out of line" : "only slightly"} and the gold decision line ${delta > 0 ? "rises" : delta < 0 ? "sinks" : "holds"}, with the calm plan drawn in ink`} fallback="/renders/objStress.webp" className="mx-auto h-[420px] w-full max-w-[600px] lg:mt-16 lg:h-[480px]" />
          <span aria-hidden="true" className="absolute top-[200px] left-[110px] hidden flex-col items-start gap-1 font-mono text-[10px] tracking-[0.14em] xl:flex">
            THE CALM PLAN · {keep}
            <span className="h-4 w-px bg-ink" />
          </span>
          <p className="mt-2 text-center text-[13px] text-ink2">
            {Math.abs(delta) > 0 ? (
              <>
                Stress shears the layers out of line. <span className="font-medium text-ink">The gold decision line {delta > 0 ? "rises" : "sinks"}.</span>
              </>
            ) : (
              "Calm. The layers sit on the plan."
            )}
          </p>
        </div>

        {/* the outcome */}
        <div className="flex flex-col" aria-live="polite">
          <Eyebrow>Under stress</Eyebrow>
          <span className="mt-5 flex items-center gap-2.5 text-[20px] text-muted">
            Order <span className={cx(a.res.changed && "line-through decoration-1")}>{keep}</span>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 1 V12 M3 8 L7 12 L11 8" fill="none" stroke={T.muted} strokeWidth="1.3" />
            </svg>
          </span>
          <DecisionNumber value={a.res.order} className="mt-2 self-start text-[clamp(150px,14.7vw,212px)]" underline={a.res.changed} label={`Best order under stress: ${a.res.order}`} />
          <Serif className="mt-11 text-[38px] leading-[1.05]">{a.headline}</Serif>
          <p className="mt-3.5 text-[15px] leading-[1.55] text-ink2">{a.detail}</p>
          {done ? (
            <div className="fade-in mt-6 border-t border-hairline pt-4 text-[14px]">
              <p className="font-medium">{done.text}</p>
              <Link href={`/ledger?entry=${done.entry}`} className="link-underline mt-2 inline-block text-[13px]">
                Recorded as #{done.entry}
              </Link>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-2.5">
              {supplierDriver ? (
                <PrimaryButton
                  arrow={false}
                  disabled={!a.res.changed}
                  onClick={() => {
                    const e = logNote({ kind: "note", sku: product.sku, decisionId: decision.id, eyebrow: `SUPPLIER CHECK · SKU ${product.sku}`, title: `${product.name} — confirm lead time before ordering`, meta: `Break My Plan: ${a.detail.split(".")[0]}. Requested by ${world.planner}.` });
                    setDone({ kind: "supplier", text: "Supplier check requested. The order waits for the answer.", entry: e.id });
                  }}
                >
                  Call supplier first
                </PrimaryButton>
              ) : (
                <Link href={`/ask?q=${encodeURIComponent(`Why does the order change under stress?`)}`} className="inline-flex h-12 items-center gap-3 rounded-[2px] bg-ink px-[22px] text-[14px] font-medium text-ground hover:bg-ink2">
                  Ask ORACLE why
                </Link>
              )}
              <SecondaryButton
                disabled={!a.res.changed || !pending}
                title={!pending ? `Decision already ${action.status}` : undefined}
                onClick={() => {
                  const e = modify(decision.id, a.res.order, "STRESS_TEST", `Break My Plan: ${a.active.map((k) => stressData.controls.find((c) => c.id === k)!.format(state[k].value)).join(", ")}`);
                  setDone({ kind: "use", text: `Order changed to ${a.res.order}. Scored against ${keep} after delivery.`, entry: e.id });
                }}
              >
                Use {a.res.order}
              </SecondaryButton>
            </div>
          )}
          {!pending && !done && <p className="mt-3 text-[12px] text-muted">This decision is already {action.status}. Stress tests stay informational.</p>}
        </div>
      </div>

      {/* flip point + one stress at a time */}
      <section className="mt-12 grid grid-cols-1 gap-12 border-t border-ink pt-4 lg:grid-cols-2 xl:grid-cols-[560px_1fr] xl:gap-24">
        <div className="flex flex-col gap-3">
          <Eyebrow className="!text-[10px]">Flip point · best order as lead time grows</Eyebrow>
          <p className="text-[13px] leading-[1.45] text-muted">The condition where the recommended order changes.</p>
          <FlipChart curve={curve} />
        </div>
        <div className="flex flex-col">
          <div className="grid grid-cols-[1fr_90px_110px] border-b border-ink pb-2">
            <Eyebrow className="!text-[10px]">One stress at a time</Eyebrow>
            <span className="eyebrow text-right !text-[10px]">Best</span>
            <span className="eyebrow text-right !text-[10px]">Risk at {keep}</span>
          </div>
          <ul>
            {singles.map((x) => {
              const active = a.active.length === 1 && a.active[0] === x.key && state[x.key].value === x.value;
              return (
                <li key={x.label}>
                  <button type="button" onClick={() => applySingle(x.key, x.value)} aria-pressed={active} className={cx("grid w-full grid-cols-[1fr_90px_110px] items-baseline border-b border-hairline py-2 text-left text-[14px] transition-colors hover:bg-paper", active && "bg-paper")}>
                    <span className="flex items-center gap-2">
                      {x.label}
                      {active && <Arrow />}
                    </span>
                    <span className="text-right font-mono text-[13px]">{x.r.order}</span>
                    <span className={cx("text-right font-mono text-[13px]", x.r.riskIfKeep > 0.3 && "text-oxblood")}>{Math.round(x.r.riskIfKeep * 100)}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Serif className="mt-3 text-[20px] text-ink2">Robust to cost. Fragile to demand and lead time.</Serif>
          <Link href={`/authority/${product.sku}`} className="link-underline mt-4 self-start text-[13px]">VIEW AUTHORITY →</Link>
        </div>
      </section>
    </div>
  );
}

function Control({ def, value, onChange }: { def: (typeof stressData.controls)[number]; value: { on: boolean; value: number }; onChange: (p: Partial<{ on: boolean; value: number }>) => void }) {
  const pct = ((value.value - def.min) / (def.max - def.min)) * 100;
  const sub = def.id === "leadTime" ? `5 → ${5 + value.value}` : "";
  return (
    <div className="flex flex-col gap-1 border-t border-hairline py-2.5">
      <div className="flex items-center justify-between">
        <span className={cx("eyebrow !text-[10px]", value.on && "!text-ink")}>{def.label}</span>
        <Toggle on={value.on} onChange={(on) => onChange({ on })} label={`${def.label} stress`} />
      </div>
      <span className={cx("text-[28px] leading-[1.05] font-medium tracking-[-0.04em] transition-colors", value.on ? "text-ink" : "text-muted")}>
        {def.format(value.value)} {sub && <span className="text-[12px] font-normal tracking-normal text-muted">{sub}</span>}
      </span>
      <input
        type="range"
        className="oracle-range"
        style={{ ["--thumb" as string]: value.on ? T.ink : T.rule, background: `linear-gradient(to right, transparent, transparent)` }}
        min={def.min}
        max={def.max}
        step={def.step}
        value={value.value}
        aria-label={`${def.label}: ${def.format(value.value)}`}
        onChange={(e) => onChange({ value: Number(e.target.value), on: true })}
        data-pct={pct}
      />
    </div>
  );
}
