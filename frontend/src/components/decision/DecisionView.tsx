"use client";

import Link from "next/link";
import { useState } from "react";
import { DemandDistribution } from "@/components/charts/DemandDistribution";
import { OracleView } from "@/components/oracle-object/OracleView";
import { Arrow, DecisionNumber, Eyebrow, PrimaryButton, SecondaryButton, SecondaryLink, Serif, TextLink, cx } from "@/components/ui/primitives";
import type { DecisionBundle } from "@/lib/services/repository";
import { canStress, world } from "@/lib/services/repository";
import { useAuthorityLevel, useDecisionAction, useOracleStore } from "@/lib/store/oracle-store";
import { contributionFor, position, stockoutRisk } from "@/lib/model/policy";
import { clock, dayLabel, money, reasonLabel, signedMoney } from "@/lib/format";
import { ModifyPanel } from "./ModifyPanel";
import { RejectPanel } from "./RejectPanel";
import { AuthorityNote } from "./AuthorityNote";

type Mode = "idle" | "modify" | "reject";

export function DecisionView({ bundle }: { bundle: DecisionBundle }) {
  const { decision, product, forecast, evidence } = bundle;
  const action = useDecisionAction(decision.id);
  const approve = useOracleStore((s) => s.approve);
  const reject = useOracleStore((s) => s.reject);
  const modify = useOracleStore((s) => s.modify);
  const authority = useAuthorityLevel(decision.sku);
  const [mode, setMode] = useState<Mode>("idle");
  const [receipt, setReceipt] = useState<string | null>(null);

  const benched = decision.circuit === "bench";
  const markdown = decision.action === "markdown";
  const noOrder = decision.action === "none";
  const rejected = action.status === "rejected";
  const qty = rejected || benched ? decision.fallbackOrder : action.quantity;
  const settled = action.status !== "pending";
  const pos = Math.round(position(bundle.policy, qty));
  const risk = stockoutRisk(bundle.policy, qty);
  const contribution = contributionFor(bundle.policy, qty, { order: decision.recommendedOrder, contribution: decision.expectedContribution });
  const partials = evidence?.grades.filter((g) => g.grade === "partial").length ?? 0;

  const chip = benched
    ? { label: "Bench", kind: "bench" as const, reason: "A demand spike breached the in-stock floor. ORACLE is benched for this SKU and the fallback rule orders until the gate clears." }
    : markdown
      ? { label: "Advisory", kind: "advisory" as const, reason: "The price effect is not identified: past markdowns moved with the season. The advice is shown, never acted on." }
      : product.authorityChip === "review" || authority.level <= 2
        ? { label: authority.level <= 1 ? "Advisory" : "Human review", kind: authority.level <= 1 ? ("advisory" as const) : ("review" as const), reason: authority.level <= 1 ? "The decision circuit is benched, so ORACLE only advises. You decide." : `Authority L2. Demand observability is partial (${partials} partial grade), so every order for this SKU waits for a planner.` }
        : { label: "Act", kind: "act" as const, reason: "Evidence passes, so routine orders for this SKU go through on their own. You are told and can reverse within the day." };

  const approveLabel = markdown ? "Acknowledge advice" : noOrder ? "Confirm no order" : `Approve ${qty}`;

  return (
    <div className="grid grid-cols-1 gap-x-16 gap-y-10 pt-12 lg:grid-cols-2 xl:grid-cols-[560px_1fr]">
      {/* product */}
      <div className="flex flex-col">
        <Eyebrow>
          SKU {product.sku} · {product.category} · {product.store}
        </Eyebrow>
        <h1 className="mt-5 text-[clamp(40px,3.9vw,56px)] font-medium leading-none tracking-[-0.045em]">{product.name}</h1>
        <Serif className="text-[clamp(32px,3vw,44px)] leading-[1.1] text-ink2">{product.colorway}</Serif>
        <p className="mt-4 text-[15px] text-ink2">What should ORACLE do?</p>
        <OracleView variant="product" label={`The ${product.name} box: an ivory base with its black lid lifted`} fallback="/renders/skuInk.webp" className="mt-4 h-[380px] w-full max-w-[540px]" />
        <dl className="mt-2 flex flex-wrap gap-x-7 gap-y-2 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
          {[
            ["Price", `$${product.price}`],
            ["Cost", `$${product.unitCost}`],
            ["Case", String(product.casePack)],
            ["Lead time", `${product.leadTimeDays} days`],
            ["Reviewed", product.reviewCycleDays === 7 ? "weekly" : `every ${product.reviewCycleDays} days`],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt>{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* the decision: the hero number sizes itself to its column */}
      <div className="@container flex min-w-0 flex-col">
        <Eyebrow>
          {benched ? "Fallback rule · ORACLE benched" : "ORACLE recommends"} · Week {world.week}
        </Eyebrow>
        <div className={cx("mt-7 flex items-end gap-3 md:gap-4", markdown ? "[--fs:clamp(88px,calc((100cqw-200px)/1.55),260px)]" : "[--fs:clamp(96px,calc((100cqw-184px)/1.34),300px)]")}>
          <span className="pb-[calc(var(--fs)*0.127)] text-[20px] font-medium tracking-[-0.02em] md:text-[30px]">{markdown ? "Markdown" : rejected || benched ? "Fallback" : "Order"}</span>
          {markdown ? (
            <DecisionNumber value="20%" className="text-(length:--fs)" underline={false} />
          ) : (
            <DecisionNumber value={benched ? decision.fallbackOrder : qty} className={cx("text-(length:--fs)", (rejected || benched) && "[&>span]:!bg-ink")} label={`${benched ? decision.fallbackOrder : qty} units`} />
          )}
          <span className="pb-[calc(var(--fs)*0.127)] text-[20px] font-medium tracking-[-0.02em] md:text-[30px]">{markdown ? "off" : "units"}</span>
        </div>

        <p className="mt-14 text-[16px] leading-normal text-ink2">
          {markdown
            ? `Suggested for ${dayLabel(decision.arrival)}. Shown as advice only.`
            : noOrder && !settled
              ? `No order this week. Stock covers demand until the next review on ${dayLabel(decision.nextDelivery)}.`
              : `Arrives ${dayLabel(decision.arrival)} and covers demand until the next delivery on ${dayLabel(decision.nextDelivery)}.`}
          {action.status === "modified" && !markdown && <span className="text-muted"> ORACLE said {decision.recommendedOrder}.</span>}
        </p>
        <p className="mt-3.5 max-w-[600px] serif text-[30px] leading-[1.15]">{decision.rationale}</p>
        <p className="mt-4 text-[13px] leading-[1.5] text-muted">Recommended order quantity. It is based on the forecast, inventory already on hand and on order, plus the {product.leadTimeDays}-day lead time.</p>

        {settled && !benched ? (
          <div className="fade-in mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-hairline py-4 text-[14px]">
            <span className={cx("inline-flex items-center gap-2 font-medium", rejected && "text-oxblood")}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                {rejected ? <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.6" /> : <path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />}
              </svg>
              {action.status === "approved" && (markdown ? "Acknowledged" : noOrder ? "No order confirmed" : `Approved · ${qty} units`)}
              {action.status === "modified" && `Modified · ${qty} units${action.reason ? ` · ${reasonLabel(action.reason)}` : ""}`}
              {rejected && `Rejected · fallback orders ${decision.fallbackOrder}`}
            </span>
            <span className="text-muted">
              {action.at ? `${clock(action.at)} · ` : ""}
              {action.by ?? world.planner}
            </span>
            <span className="flex-1" />
            <TextLink href={receipt ? `/ledger?entry=${receipt}` : "/ledger"}>View in the ledger</TextLink>
          </div>
        ) : benched ? (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <SecondaryLink href="/circuit">Open the circuit</SecondaryLink>
            <AuthorityNote label={chip.label} kind={chip.kind} reason={chip.reason} sku={product.sku} decisionId={decision.id} hasEvidence={!!evidence} />
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PrimaryButton
              onClick={() => {
                const e = approve(decision.id);
                setReceipt(e.id);
                setMode("idle");
              }}
            >
              {approveLabel}
            </PrimaryButton>
            {!markdown && (
              <SecondaryButton aria-expanded={mode === "modify"} onClick={() => setMode(mode === "modify" ? "idle" : "modify")}>
                Modify
              </SecondaryButton>
            )}
            {!markdown && (
              <button type="button" aria-expanded={mode === "reject"} onClick={() => setMode(mode === "reject" ? "idle" : "reject")} className="px-3 text-[14px] text-ink2 underline-offset-4 hover:underline">
                Reject
              </button>
            )}
            <span className="flex-1" />
            <AuthorityNote label={chip.label} kind={chip.kind} reason={chip.reason} sku={product.sku} decisionId={decision.id} hasEvidence={!!evidence} />
          </div>
        )}

        {mode === "modify" && !settled && (
          <ModifyPanel
            bundle={bundle}
            initial={qty === 0 ? product.casePack * 4 : qty}
            onCancel={() => setMode("idle")}
            onSave={(q, reason, note) => {
              const e = modify(decision.id, q, reason, note);
              setReceipt(e.id);
              setMode("idle");
            }}
          />
        )}
        {mode === "reject" && !settled && (
          <RejectPanel
            fallback={decision.fallbackOrder}
            onCancel={() => setMode("idle")}
            onConfirm={(reason) => {
              const e = reject(decision.id, reason);
              setReceipt(e.id);
              setMode("idle");
            }}
          />
        )}

        {canStress(decision.id) && (
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-[13px] text-ink2"><Link href={`/evidence/${decision.id}`} className="inline-flex items-center gap-2 hover:text-gold-deep">View evidence <Arrow /></Link><Link href={`/break-my-plan/${decision.id}`} className="inline-flex items-center gap-2 hover:text-gold-deep">How fragile is {qty}? Break this plan <Arrow /></Link></div>
        )}
      </div>

      {/* supporting figures */}
      <section aria-label="Supporting figures" className="grid grid-cols-2 gap-x-8 gap-y-8 border-t border-ink pt-6 md:grid-cols-3 lg:col-span-2 xl:grid-cols-[300px_repeat(5,1fr)]">
        <div className="col-span-2 flex flex-col gap-2.5 md:col-span-1">
          <Eyebrow className="!text-[10px]">Demand · next {forecast.horizonDays} days</Eyebrow>
          <DemandDistribution p10={forecast.p10} p50={forecast.p50} p90={forecast.p90} target={markdown ? forecast.p50 : pos} />
          <p className="text-[11px] leading-[1.45] text-muted">P10 lower boundary · P50 expected demand · P90 higher-demand boundary</p>
        </div>
        <Figure label="On hand" value={String(decision.onHand)} sub="units in store" />
        <Figure label="On order" value={String(decision.onOrder)} sub={decision.onOrder ? `due ${dayLabel(decision.onOrderDue)}` : "nothing open"} />
        <Figure label="Fallback" value={String(decision.fallbackOrder)} sub="alternative policy used for comparison" />
        <Figure label="Stockout risk" value={markdown ? "—" : `${Math.round(risk * 100)}%`} sub={markdown ? "not an order" : `with ${qty}`} warn={risk > 0.3} />
        <Figure label="Contribution" value={money(contribution)} sub={markdown ? "if the advice is taken" : benched ? "the fallback's order" : qty === decision.recommendedOrder ? `${signedMoney(decision.contributionVsFallback)} vs fallback` : `${signedMoney(contribution - decision.expectedContribution)} vs ORACLE`} />
      </section>
    </div>
  );
}

function Figure({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow className="!text-[10px]">{label}</Eyebrow>
      <span className={cx("text-[44px] leading-none font-medium tracking-[-0.045em] tabular", warn && "text-oxblood")}>{value}</span>
      <span className="text-[12px] text-muted">{sub}</span>
    </div>
  );
}
