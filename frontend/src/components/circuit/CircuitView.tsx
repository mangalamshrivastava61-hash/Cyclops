"use client";

import type { CircuitRecord, CircuitState } from "@/types";
import { OracleView } from "@/components/oracle-object/OracleView";
import { Gauge } from "@/components/charts/Gauge";
import { Chip, Eyebrow, Serif, TextLink, cx } from "@/components/ui/primitives";
import { effectiveAuthority, useOracleStore } from "@/lib/store/oracle-store";
import { levels } from "@/lib/services/repository";
import { T } from "@/lib/tokens";
import { shortDate } from "@/lib/format";

const ORDER: CircuitState[] = ["clear", "review", "bench"];
const LEAD: Record<CircuitState, string> = {
  clear: "Every signal is inside its bounds.",
  review: "A signal is building. A planner checks every order.",
  bench: "Threshold crossed. Fallback rule takes over.",
};

export function CircuitView({ circuit }: { circuit: CircuitRecord }) {
  const state = useOracleStore((s) => s.circuit);
  const setCircuit = useOracleStore((s) => s.setCircuit);
  const probesPreview = useOracleStore((s) => s.probesPreview);
  const auth = effectiveAuthority({ circuit: state, probesPreview }, "1842");
  const simulated = state !== circuit.liveState;
  const levelDef = levels.find((l) => l.level === auth.level)!;

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setCircuit(ORDER[Math.min(ORDER.length - 1, i + 1)]);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setCircuit(ORDER[Math.max(0, i - 1)]);
    }
  };

  return (
    <div className="pt-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr] xl:grid-cols-[400px_1fr]">
        <div className="relative z-10 flex flex-col">
          <Eyebrow>
            Decision circuit · {circuit.scope.split(" · ")[0]} · Since {shortDate(circuit.since)}
          </Eyebrow>
          <h1 aria-live="polite" className={cx("mt-3 -ml-2 font-medium tracking-[-0.065em] text-[clamp(120px,13.6vw,196px)] leading-[0.9] transition-colors duration-500", state === "bench" && "text-oxblood")}>
            {circuit.states[state].title}
          </h1>
          <Serif className="mt-3.5 max-w-[440px] text-[30px] leading-[1.15]">{LEAD[state]}</Serif>
          <p className="mt-3 max-w-[420px] text-[13px] leading-[1.5] text-muted">ACT means ORACLE may act within its earned authority. REVIEW requires a human. BENCH hands control to the fallback rule.</p>
          <TextLink href="/authority/1842" className="mt-4 self-start text-[13px]">View authority</TextLink>
          {simulated && (
            <div className="fade-in mt-4 flex items-center gap-3 text-[13px]">
              <span className="font-mono text-[10px] tracking-[0.16em] text-oxblood uppercase">Simulation</span>
              <button type="button" onClick={() => setCircuit(circuit.liveState)} className="link-underline">
                Return to the live state
              </button>
            </div>
          )}

          <div className="mt-9 grid grid-cols-2 gap-x-8">
            {circuit.signals.map((s) => {
              const r = s.readouts[state];
              return (
                <div key={s.id} className="flex flex-col gap-2 border-t border-hairline py-4">
                  <Eyebrow className="!text-[10px]" tone={r.tripped ? "oxblood" : "muted"}>
                    {s.label}
                  </Eyebrow>
                  <span className={cx("text-[44px] leading-none font-medium tracking-[-0.045em] transition-colors", r.tripped && "text-oxblood")}>{r.value}</span>
                  <Gauge frac={r.frac} threshold={s.threshold} tripped={r.tripped} />
                  <span className="text-[12.5px] text-muted">
                    {r.sub} <span className="text-oxblood">{s.thresholdLabel}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <OracleView
          variant="circuit"
          circuitState={state}
          label="The decision circuit as a machined instrument. The ORACLE object is its selector knob."
          fallback="/renders/objCircuit.webp"
          className="h-[340px] w-full md:h-[420px] lg:-mt-6 lg:h-[520px] xl:h-[600px]"
          fadeEdges={false}
          overlay={
            ORDER.map((k) => (
              <span key={k} data-anchor={k} className="absolute top-0 left-0 opacity-0 max-md:hidden">
                <button
                  type="button"
                  onClick={() => setCircuit(k)}
                  aria-pressed={state === k}
                  className={cx(
                    "pointer-events-auto flex flex-col gap-0.5 px-2 py-1 whitespace-nowrap",
                    k === "clear" && "-translate-x-full -translate-y-1/2 items-end text-right",
                    k === "review" && "-translate-x-1/2 items-center text-center",
                    k === "bench" && "-translate-y-1/2 items-start",
                  )}
                >
                  <span className={cx("font-mono text-[11px] font-semibold tracking-[0.18em] uppercase", k === "bench" ? "text-oxblood" : "text-ink", state === k && "border-b border-current")}>{circuit.states[k].title}</span>
                  <span className="text-[12px] text-muted">{k === "clear" ? "evidence decides" : k === "review" ? "a planner checks" : "fallback runs"}</span>
                </button>
              </span>
            ))
          }
        />
      </div>

      <section aria-label="Circuit states" className="mt-8 grid grid-cols-1 gap-8 border-t border-ink pt-6 md:grid-cols-3 lg:grid-cols-[repeat(3,1fr)_300px]">
        <div role="radiogroup" aria-label="Simulate the circuit state" className="contents">
          {ORDER.map((k, i) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={state === k}
              tabIndex={state === k ? 0 : -1}
              onKeyDown={(e) => onKey(e, i)}
              onClick={() => setCircuit(k)}
              className={cx("group flex flex-col gap-2 text-left transition-opacity", state !== k && "opacity-70 hover:opacity-100")}
            >
              <span className="flex items-center gap-2.5">
                <StateDot k={k} active={state === k} />
                <span className={cx("font-mono text-[11px] font-semibold tracking-[0.18em] uppercase", k === "bench" && "text-oxblood")}>{circuit.states[k].title}</span>
                {state === k && <span className="ml-1 font-mono text-[9.5px] tracking-[0.16em]">{simulated ? "SIMULATED" : "NOW"}</span>}
              </span>
              <span className="max-w-[260px] text-[14px] leading-[1.45] text-ink2">{circuit.states[k].plain}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 text-[13px] text-ink2">
          <Eyebrow className="!text-[10px]">Last trip</Eyebrow>
          <span>{circuit.lastTrip}</span>
          <span>{circuit.falseTripBudget}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2.5">
            Authority now
            <Chip kind={auth.level <= 1 ? "advisory" : "review"}>
              L{auth.level} · {levelDef.short}
            </Chip>
          </span>
        </div>
      </section>
    </div>
  );
}

function StateDot({ k, active }: { k: CircuitState; active: boolean }) {
  if (k === "bench")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="5.5" fill={active ? T.oxblood : "none"} stroke={T.oxblood} strokeWidth="1.4" />
        {!active && <path d="M3 11 L11 3" stroke={T.oxblood} strokeWidth="1.4" />}
      </svg>
    );
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r={active ? 6 : 5.5} fill={active ? T.ink : "none"} stroke={T.ink} strokeWidth="1.4" />
    </svg>
  );
}
