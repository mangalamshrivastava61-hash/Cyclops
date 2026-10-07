"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { LedgerEntry, LedgerKind } from "@/types";
import { Arrow, Chip, Eyebrow, LogoMark, Serif, cx } from "@/components/ui/primitives";
import { useLedger, useOracleStore, selectDecision } from "@/lib/store/oracle-store";
import { receiptFor } from "@/lib/receipt";
import { canStress, getEvidence, world } from "@/lib/services/repository";
import { clock, dayLabel, stamp } from "@/lib/format";
import { T } from "@/lib/tokens";

const FILTERS: { id: string; label: string; kinds: LedgerKind[] | null }[] = [
  { id: "all", label: "All", kinds: null },
  { id: "orders", label: "Orders", kinds: ["order", "markdown", "approval", "rejection", "modification"] },
  { id: "authority", label: "Authority", kinds: ["authority", "circuit"] },
  { id: "overrides", label: "Overrides", kinds: ["override", "modification", "rejection"] },
  { id: "replays", label: "Replays", kinds: ["replay"] },
];
const DAYS: string[] = [world.today, world.yesterday];

export function LedgerView() {
  const entries = useLedger();
  const decisions = useOracleStore((s) => s.decisions);
  const params = useSearchParams();
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [day, setDay] = useState<string>(world.today);
  const [selected, setSelected] = useState<string>("18513");

  // deep link: /ledger?entry=18517 selects the entry and opens its day (also when the link changes)
  const entryParam = params.get("entry");
  const [linked, setLinked] = useState<string | null>(null);
  if (entryParam !== linked) {
    const e = entryParam ? entries.find((x) => x.id === entryParam) : undefined;
    if (e || !entryParam) setLinked(entryParam);
    if (e) {
      setSelected(e.id);
      setDay(e.at.slice(0, 10));
    }
  }

  const chainOk = entries.every((e, i) => i === 0 || e.prevHash === entries[i - 1].hash);
  const last = entries[entries.length - 1];
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, entries.filter((e) => !f.kinds || f.kinds.includes(e.kind)).length])), [entries]);
  const kinds = FILTERS.find((f) => f.id === filter)!.kinds;
  const shown = entries.filter((e) => e.at.startsWith(day) && (!kinds || kinds.includes(e.kind))).reverse();
  const current = entries.find((e) => e.id === selected) ?? entries.find((e) => e.id === "18513")!;
  const dayIndex = DAYS.indexOf(day);

  const select = (id: string) => {
    setSelected(id);
    router.replace(`/ledger?entry=${id}`, { scroll: false });
    // on one column the receipt sits below the list: bring it into view
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => document.getElementById("ledger-receipt")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 xl:grid-cols-[808px_408px] xl:justify-between">
      <div>
        <Eyebrow>Decision ledger · Append-only</Eyebrow>
        <h1 className="mt-5 font-medium tracking-[-0.05em] text-[clamp(48px,5vw,72px)] leading-[0.98]">
          Every decision,
          <Serif className="block text-[clamp(44px,4.3vw,62px)] leading-[1.02] tracking-normal">written once, kept forever.</Serif>
        </h1>
        <p className="mt-4 flex flex-wrap gap-x-5 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
          <span>
            <b className="font-medium text-ink">{last.seq.toLocaleString("en-US")}</b> records
          </span>
          <span>
            <b className="font-medium text-ink">0</b> edited
          </span>
          <span>
            <b className="font-medium text-ink">0</b> deleted
          </span>
          <span className={cx("flex items-center gap-1.5", !chainOk && "text-oxblood")}>
            {chainOk && (
              <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke={T.ink} strokeWidth="1.6" />
              </svg>
            )}
            {chainOk ? `Chain verified ${clock(last.at)}` : "Chain broken"}
          </span>
        </p>
        <Link href="/history" className="link-underline mt-5 inline-flex text-[13px]">View history →</Link>

        <div className="mt-8 flex flex-col justify-between gap-4 text-[13.5px] sm:flex-row sm:items-center lg:flex-col lg:items-start xl:flex-row xl:items-center">
          <div role="tablist" aria-label="Filter entries" className="flex flex-wrap gap-x-6 gap-y-2">
            {FILTERS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={cx("py-1.5", filter === f.id ? "border-b border-ink font-medium" : "text-ink2 hover:text-ink")}>
                {f.label} <span className="font-mono text-[10.5px] text-muted">{counts[f.id]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous day" disabled={dayIndex === DAYS.length - 1} onClick={() => setDay(DAYS[dayIndex + 1])} className="flex h-11 w-11 items-center justify-center disabled:opacity-30">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2 L3.5 6 L7.5 10" fill="none" stroke={T.ink} strokeWidth="1.4" /></svg>
            </button>
            <span className="min-w-[128px] text-center">{day === world.today ? `Today, ${world.todayLabel}` : `Yesterday, ${world.yesterdayLabel}`}</span>
            <button type="button" aria-label="Next day" disabled={dayIndex === 0} onClick={() => setDay(DAYS[dayIndex - 1])} className="flex h-11 w-11 items-center justify-center disabled:opacity-30">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2 L8.5 6 L4.5 10" fill="none" stroke={T.ink} strokeWidth="1.4" /></svg>
            </button>
          </div>
        </div>

        <ol className="mt-3 border-t border-ink" aria-label={`Entries for ${dayLabel(day)}`}>
          {shown.length === 0 && <li className="py-10 text-[15px] text-muted">No entries of this kind on {dayLabel(day)}.</li>}
          {shown.map((e) => (
            <Entry key={e.id} entry={e} active={e.id === current.id} decisions={decisions} onSelect={() => select(e.id)} />
          ))}
        </ol>
      </div>

      <ReceiptCard entry={current} entries={entries} />
    </div>
  );
}

function statusChip(e: LedgerEntry, decisions: ReturnType<typeof useOracleStore.getState>["decisions"]) {
  if (e.kind !== "order" || !e.decisionId || e.chip?.kind !== "review") return e.chip;
  const a = selectDecision({ decisions }, e.decisionId);
  if (a.status === "approved") return { label: "Review · approved", kind: "review" as const };
  if (a.status === "modified") return { label: "Review · modified", kind: "review" as const };
  if (a.status === "rejected") return { label: "Rejected", kind: "advisory" as const };
  return { label: "Review · waiting", kind: "review" as const };
}

function Entry({ entry: e, active, decisions, onSelect }: { entry: LedgerEntry; active: boolean; decisions: ReturnType<typeof useOracleStore.getState>["decisions"]; onSelect: () => void }) {
  const chip = statusChip(e, decisions);
  const node =
    e.kind === "circuit" ? (
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill={T.ground} stroke={T.oxblood} strokeWidth="1.4" /><path d="M2.6 9.4 L9.4 2.6" stroke={T.oxblood} strokeWidth="1.4" /></svg>
    ) : e.decisionId === "18513" && e.kind === "order" ? (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="6" fill={T.gold} stroke={T.ink} strokeWidth="1.4" /></svg>
    ) : e.kind === "override" || e.kind === "modification" || e.kind === "approval" ? (
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill={T.ink} /></svg>
    ) : (
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill={T.ground} stroke={e.kind === "markdown" || e.kind === "note" ? T.muted : T.ink} strokeWidth="1.3" /></svg>
    );
  const a = e.decisionId && e.kind === "order" ? selectDecision({ decisions }, e.decisionId) : null;
  const meta = a && e.decisionId === "18513" && a.status !== "pending" ? (a.status === "approved" ? `3 pass · 1 partial · approved ${a.at ? clock(a.at) : ""} by ${a.by ?? world.planner}` : a.status === "modified" ? `Modified to ${a.quantity} by ${a.by ?? world.planner}` : `Rejected · the fallback orders 97`) : e.meta;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={cx("grid grid-cols-[88px_22px_1fr] items-start gap-y-2 py-3.5 text-left transition-colors sm:grid-cols-[112px_26px_1fr_170px] lg:grid-cols-[92px_22px_1fr_132px] xl:grid-cols-[112px_26px_1fr_170px]", active ? "-mx-4 w-[calc(100%+32px)] bg-paper px-4 shadow-[inset_0_0_0_1px_var(--color-ink)]" : "w-full border-b border-hairline hover:bg-paper/60")}
      >
        <span className={cx("serif text-[38px] leading-[0.9]", !e.at.startsWith(world.today) && "text-muted")}>{clock(e.at)}</span>
        <span className="flex justify-center pt-1.5">{node}</span>
        <span className="flex flex-col gap-1.5 pl-2">
          <span className={cx("font-mono text-[10px] tracking-[0.16em] uppercase", e.kind === "circuit" ? "text-oxblood" : "text-muted")}>{e.eyebrow}</span>
          <span className="text-[22px] leading-[1.1] font-medium tracking-[-0.025em]">{e.title}</span>
          <span className="text-[13.5px] leading-[1.45] text-ink2">
            {e.quote && <Serif className="mr-1 text-[17px]">“{e.quote}”</Serif>}
            {meta}
          </span>
        </span>
        <span className="col-start-3 flex flex-row items-center gap-3 pl-2 sm:col-start-4 sm:flex-col sm:items-end sm:gap-2.5 sm:pl-0">
          {chip && <Chip kind={chip.kind === "sealed" ? "sealed" : chip.kind}>{chip.label}</Chip>}
          {e.link ? (
            <Link href={e.link.href} onClick={(ev) => ev.stopPropagation()} className="link-underline text-[12.5px]">
              {e.link.label}
            </Link>
          ) : (
            active && (
              <span className="flex items-center gap-1.5 text-[12.5px]">
                Receipt <Arrow />
              </span>
            )
          )}
        </span>
      </button>
    </li>
  );
}

function ReceiptCard({ entry, entries }: { entry: LedgerEntry; entries: LedgerEntry[] }) {
  const decisions = useOracleStore((s) => s.decisions);
  const action = entry.decisionId ? selectDecision({ decisions }, entry.decisionId) : undefined;
  const r = receiptFor(entry, action);
  const idx = entries.findIndex((e) => e.id === entry.id);
  const chain = entries.slice(Math.max(0, idx - 2), idx + 1);
  const isDecision = !!entry.decisionId && entry.kind !== "markdown";
  const zig = Array.from({ length: 34 }, (_, i) => `L${i * 12 + 6} 8 L${i * 12 + 12} 0`).join(" ");
  return (
    <section id="ledger-receipt" aria-label={`Record ${entry.id}`} aria-live="polite" className="scroll-mt-4 self-start drop-shadow-[0_16px_24px_rgba(18,17,15,0.08)] lg:sticky lg:top-6">
      <div className="bg-paper px-7 pt-7 pb-6">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <LogoMark size={18} stroke={1.6} />
            <span className="text-[11px] font-semibold tracking-[0.3em]">ORACLE</span>
          </span>
          <Eyebrow className="!text-[10px]">{isDecision ? "Decision record" : "Ledger record"}</Eyebrow>
        </div>
        <div className="mt-6 text-[60px] leading-none font-medium tracking-[-0.055em]">#{entry.id}</div>
        <div className="mt-2 font-mono text-[11px] text-muted">
          {stamp(entry.at)} · {world.store.toUpperCase()}
        </div>
        {r.groups.map((g, gi) => (
          <dl key={gi} className="mt-4 grid grid-cols-[124px_1fr] border-t border-dashed border-[#B5AD9E] pt-2 text-[13px]">
            {g.map((l) => (
              <div key={l.label} className="contents">
                <dt className="py-1.5 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">{l.label}</dt>
                <dd className={cx("py-[5px] text-right", l.emphasis === "decision" && "text-[17px] font-semibold", l.emphasis === "strong" && "font-medium")}>
                  {l.label === "Authority" && r.authority ? <Chip kind={r.authority.kind}>{r.authority.label}</Chip> : l.value}
                  {l.emphasis === "decision" && isDecision && <span className="mt-[3px] ml-auto block h-[3px] w-[136px] bg-gold" />}
                </dd>
              </div>
            ))}
          </dl>
        ))}
        <dl className="mt-4 grid grid-cols-[124px_1fr] border-t border-dashed border-[#B5AD9E] pt-2 font-mono text-[11.5px]">
          <dt className="py-1.5 text-[10px] tracking-[0.12em] text-muted uppercase">Record hash</dt>
          <dd className="py-[5px] text-right">
            {entry.hash} ← {entry.prevHash}
          </dd>
        </dl>
        <svg viewBox="0 0 352 46" className="mt-3 block w-full" role="img" aria-label={`Hash chain: ${chain.map((c) => c.id).join(" links to ")}`}>
          {chain.map((c, i) => {
            const x = chain.length === 3 ? [0.5, 146.5, 291.5][i] : chain.length === 2 ? [146.5, 291.5][i] : 291.5;
            const self = c.id === entry.id;
            return (
              <g key={c.id}>
                {i > 0 && <line x1={x - 86} y1="16" x2={x} y2="16" stroke={T.ink} />}
                <rect x={x} y="4.5" width="60" height="23" rx="2" fill={self && isDecision ? T.gold : T.paper} stroke={T.ink} />
                <text x={x + 30} y="20" textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize="10" fontWeight={self ? 600 : 400} fill={T.ink}>
                  {c.id}
                </text>
                <text x={x + 30} y="42" textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize="9" fill={T.muted}>
                  {c.hash}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="mt-4 text-center serif text-[22px] leading-[1.15]">Each record seals the one before it.</p>
        {entry.decisionId && (
          <div className="mt-5 flex gap-2">
            <Link href={`/decision/${entry.decisionId}`} className="flex h-11 flex-1 items-center justify-center rounded-[2px] bg-ink text-[13px] text-ground hover:bg-ink2">
              Open decision
            </Link>
            {getEvidence(entry.decisionId) ? (
              <Link href={`/evidence/${entry.decisionId}`} className="flex h-11 flex-1 items-center justify-center rounded-[2px] border border-ink text-[13px] hover:bg-ink hover:text-ground">
                Open evidence
              </Link>
            ) : canStress(entry.decisionId) ? (
              <Link href={`/break-my-plan/${entry.decisionId}`} className="flex h-11 flex-1 items-center justify-center rounded-[2px] border border-ink text-[13px] hover:bg-ink hover:text-ground">
                Break this plan
              </Link>
            ) : null}
          </div>
        )}
      </div>
      <svg width="100%" height="9" viewBox="0 0 408 9" preserveAspectRatio="none" aria-hidden="true" className="block">
        <path d={`M0 0 ${zig} Z`} fill={T.paper} />
      </svg>
    </section>
  );
}
