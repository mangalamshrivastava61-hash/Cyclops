"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { DemandInventoryChart } from "@/components/charts/DemandInventoryChart";
import { OracleView } from "@/components/oracle-object/OracleView";
import { Eyebrow, PrimaryLink, Serif, TextLink, cx } from "@/components/ui/primitives";
import type { DecisionBundle } from "@/lib/services/repository";
import { world } from "@/lib/services/repository";
import { useDecisionAction, selectDecision, useOracleStore } from "@/lib/store/oracle-store";
import { describeDecision } from "@/lib/decision-view";
import { shortDate } from "@/lib/format";

interface Also {
  id: string;
  sku: string;
  name: string;
  action: "order" | "markdown" | "none";
  order: number;
  fallback: number;
  circuit: "clear" | "review" | "bench";
}

export function ControlCenter({ bundle, also }: { bundle: DecisionBundle; also: Also[] }) {
  const { decision, product, forecast, evidence } = bundle;
  const action = useDecisionAction(decision.id);
  const view = describeDecision(decision, action, world.planner);
  const decisions = useOracleStore((s) => s.decisions);
  const grades = evidence?.grades ?? [];
  const passes = grades.filter((g) => g.grade === "pass" && g.id !== "identification").length;
  const partials = grades.filter((g) => g.grade === "partial").length;
  const first = forecast.daily[0].date;
  const last = forecast.daily[forecast.daily.length - 1].date;
  const statementNumber = view.quantity;
  // on narrow screens the chart scrolls sideways: open it near today, where the forecast and the order are
  const chartScroller = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = chartScroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.round(el.scrollWidth * 0.22);
  }, []);

  const alsoLabel = (a: Also) => {
    const act = selectDecision({ decisions }, a.id);
    if (a.circuit === "bench") return { text: `${a.name}, benched`, bench: true };
    if (a.action === "markdown") return { text: `${a.name}, markdown advice`, bench: false };
    if (a.action === "none") return { text: `${a.name}, no order`, bench: false };
    return { text: `${a.name}, order ${act.quantity}`, bench: false };
  };

  return (
    <div className="relative pt-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_300px]">
        <div>
          <Eyebrow>
            Next 28 days · {shortDate(first)} – {shortDate(last)} · {product.category}
          </Eyebrow>
          <p className="mt-4 text-[15px] text-ink2">Your decision cockpit.</p>
          <h1 className="mt-6 flex flex-col gap-0.5 font-medium tracking-[-0.05em] text-[clamp(46px,5.9vw,84px)] leading-none">
            <Statement note={`+${Math.round(forecast.demandTrend * 100)}% · 28 D`}>
              Demand is <Serif className="text-[1.095em] tracking-[-0.01em]">rising.</Serif>
            </Statement>
            <Statement note={`${forecast.coverDaysNow} → ${forecast.coverDaysEnd} days cover`}>
              Stock is <Serif className="text-[1.095em] tracking-[-0.01em]">tightening.</Serif>
            </Statement>
            <Statement note={view.isFallback ? `Fallback rule · arrives ${shortDate(decision.arrival)}` : `${product.name} · arrives ${shortDate(decision.arrival)}`}>
              {view.isFallback ? "Fallback " : "Order "}
              <span className="relative inline-block tabular">
                {statementNumber}
                <span aria-hidden="true" className={cx("absolute right-[2px] bottom-[2px] left-1 h-[7px] transition-colors duration-500", view.isFallback ? "bg-ink" : "bg-gold")} />
              </span>
              .
            </Statement>
          </h1>
          <div className="mt-9 flex flex-wrap items-center gap-7">
            <PrimaryLink href={`/decision/${decision.id}`}>{view.settled ? "Open the decision" : "Review the decision"}</PrimaryLink>
            <TextLink href={`/break-my-plan/${decision.id}`}>Break my plan</TextLink>
            <span className="text-[13px] text-muted">
              {view.settled ? view.statusLine : `Fallback ${decision.fallbackOrder} · Human review · ${passes} pass, ${partials} partial`}
            </span>
          </div>
        </div>
        <div className="hidden flex-col items-center lg:flex">
          <OracleView variant="forecast" label="The ORACLE object in its forecast state: the layers float apart to show an open range, with the gold decision line set" fallback="/renders/objForecast.webp" className="-mt-4 h-[300px] w-[300px]" />
          <span className="eyebrow mt-1 !text-[10px] !tracking-[0.16em]">Forecast state · range open</span>
        </div>
      </div>

      <p className="eyebrow mt-12 mb-1 !text-[10px] md:hidden">Swipe for all 28 days →</p>
      <section ref={chartScroller} aria-label="Demand and stock, next 28 days" className="-mx-6 overflow-x-auto px-6 pt-2 md:mx-0 md:mt-12 md:overflow-visible md:px-0 md:pt-0">
        <div className="min-w-[760px] md:min-w-0">
        <DemandInventoryChart
          forecast={forecast}
          decision={decision}
          plan={
            view.isFallback
              ? { quantity: decision.fallbackOrder, kind: "fallback", label: `+${decision.fallbackOrder} · fallback rule` }
              : { quantity: view.quantity, kind: "decision", label: `+${view.quantity} · this decision` }
          }
        />
        </div>
      </section>

      <div className="mt-8 flex flex-col justify-between gap-3 text-[13px] text-ink2 md:flex-row md:items-baseline">
        <p className="flex flex-col items-start gap-x-2 gap-y-2 md:flex-row md:flex-wrap md:items-baseline md:gap-y-1">
          <span className="eyebrow mr-2 !text-[10.5px] !tracking-[0.16em]">Also this week</span>
          {also.map((a, i) => {
            const l = alsoLabel(a);
            return (
              <span key={a.id} className="inline-flex items-baseline gap-2">
                {i > 0 && <span className="text-muted max-md:hidden">·</span>}
                <Link href={`/decision/${a.id}`} className={cx("hover:underline", l.bench && "text-oxblood")}>
                  {l.text}
                </Link>
              </span>
            );
          })}
        </p>
        <TextLink href="/ledger" className="self-start text-[13px] md:self-auto">
          Open the ledger
        </TextLink>
      </div>
    </div>
  );
}

function Statement({ children, note }: { children: React.ReactNode; note: string }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-6 max-sm:mb-3">
      <span>{children}</span>
      <span className="font-mono text-[11px] font-normal tracking-[0.1em] text-muted uppercase sm:text-[12px]">{note}</span>
    </span>
  );
}
