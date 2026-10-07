"use client";

import Link from "next/link";
import { useState } from "react";
import type { EvidenceGrade, EvidenceReport, Product } from "@/types";
import { EvidenceMicro } from "@/components/charts/EvidenceMicro";
import { Chip, Eyebrow, GradeTag, PrimaryButton, SecondaryButton, Serif, cx } from "@/components/ui/primitives";
import { useOracleStore } from "@/lib/store/oracle-store";
import { stamp } from "@/lib/format";

function headlineFor(r: EvidenceReport) {
  const worst = r.grades.find((g) => g.grade === "failed") ?? r.grades.find((g) => g.grade === "partial") ?? r.grades.find((g) => g.grade === "insufficient");
  const title = r.authorityNow.level < r.authorityBefore.level ? "Authority reduced." : r.authorityNow.level > r.authorityBefore.level ? "Authority raised." : "Authority unchanged.";
  const sub =
    worst?.id === "observability"
      ? "Demand observability is incomplete."
      : worst?.id === "service"
        ? "Service fell below its floor."
        : worst?.id === "identification"
          ? "The price effect is not identified."
          : worst?.id === "forecast"
            ? "The forecast stopped covering demand."
            : "Every test holds.";
  return { title, sub };
}

export function EvidenceView({ report, product }: { report: EvidenceReport; product: Product }) {
  const [open, setOpen] = useState<string | null>(null);
  const [experiment, setExperiment] = useState(false);
  const [proposed, setProposed] = useState<string | null>(null);
  const logNote = useOracleStore((s) => s.logNote);
  const h = headlineFor(report);
  const nowKind = report.authorityNow.level <= 1 ? (report.authorityNow.label.startsWith("Benched") ? "bench" : "advisory") : "review";

  return (
    <div className="pt-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_300px]">
        <div>
          <Eyebrow>
            Evidence report · Decision #{report.decisionId} · Graded {stamp(report.gradedAt).split(" · ")[0].slice(4)} {report.gradedAt.slice(11, 16)}
          </Eyebrow>
          <h1 className="mt-6 font-medium tracking-[-0.055em] text-[clamp(56px,7vw,100px)] leading-[0.95]">{h.title}</h1>
          <Serif className="mt-1.5 block text-[clamp(34px,3.75vw,54px)] leading-[1.05] text-ink2">{h.sub}</Serif>
          <p className="mt-5 max-w-[620px] text-[15px] leading-[1.5] text-ink2">Evidence is the support available for this recommendation. Open a row to see its method, window and threshold.</p>
        </div>
        <dl className="grid grid-cols-[70px_1fr] items-baseline gap-y-3.5 self-start pt-1 text-[15px] lg:mt-9">
          <dt className="eyebrow !text-[10px]">Before</dt>
          <dd className={cx(report.authorityBefore.level !== report.authorityNow.level && "text-muted line-through decoration-1")}>{report.authorityBefore.label}</dd>
          <dt className="eyebrow !text-[10px]">Now</dt>
          <dd>
            <Chip kind={nowKind}>{report.authorityNow.label}</Chip>
          </dd>
          <dt className="eyebrow !text-[10px]">Why</dt>
          <dd className="text-[14px] leading-[1.45] text-ink2">{report.rule}</dd>
        </dl>
      </div>

      <div className="mt-12 border-t border-ink">
        {report.grades.map((g) => (
          <GradeRow key={g.id} g={g} open={open === g.id} onToggle={() => setOpen(open === g.id ? null : g.id)} />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-[15px] text-ink2">
          <span className="eyebrow mr-4 !text-[10.5px] !tracking-[0.16em]">To restore L{report.restore.level}</span>
          {report.restore.summary}
          {report.restore.cost > 0 && ` · about $${report.restore.cost} of extra stock`}.
        </p>
        {report.restore.experimentId !== "—" && (
          <SecondaryButton aria-expanded={experiment} onClick={() => setExperiment((v) => !v)}>
            Review experiment {report.restore.experimentId}
          </SecondaryButton>
        )}
        <div className="flex gap-5 self-start text-[13px] md:self-auto"><Link href={`/break-my-plan/${report.decisionId}`} className="link-underline">STRESS TEST →</Link><Link href="/circuit" className="link-underline">VIEW CIRCUIT →</Link></div>
      </div>
      {experiment && (
        <section aria-label={`Experiment ${report.restore.experimentId}`} className="fade-in mt-5 grid grid-cols-1 gap-6 border border-ink bg-paper p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[14px]">
            <dt className="eyebrow !text-[10px]">Experiment</dt>
            <dd>{report.restore.experimentId}</dd>
            <dt className="eyebrow !text-[10px]">Scope</dt>
            <dd>{report.restore.scope}</dd>
            <dt className="eyebrow !text-[10px]">Runs</dt>
            <dd>{report.restore.weeks} weeks</dd>
          </dl>
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[14px]">
            <dt className="eyebrow !text-[10px]">Measures</dt>
            <dd>{report.restore.measures}</dd>
            <dt className="eyebrow !text-[10px]">Cost</dt>
            <dd>{report.restore.cost ? `~$${report.restore.cost} of extra stock (simulated)` : "No extra stock"}</dd>
          </dl>
          {proposed ? (
            <Link href={`/ledger?entry=${proposed}`} className="link-underline self-center text-[14px]">
              Proposed · recorded as #{proposed}
            </Link>
          ) : (
            <PrimaryButton
              onClick={() => {
                const e = logNote({ kind: "note", sku: product.sku, eyebrow: `EXPERIMENT · ${report.restore.experimentId}`, title: `${report.restore.summary}`, meta: `Proposed to restore L${report.restore.level} for ${product.name}` });
                setProposed(e.id);
              }}
            >
              Propose experiment
            </PrimaryButton>
          )}
        </section>
      )}
    </div>
  );
}

function GradeRow({ g, open, onToggle }: { g: EvidenceGrade; open: boolean; onToggle: () => void }) {
  const highlight = g.grade === "partial" || g.grade === "failed";
  return (
    <div className={cx("border-b border-hairline", highlight && "bg-stone lg:-mx-5 lg:px-5")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[40px_1fr] items-center gap-x-6 gap-y-3 py-5 text-left md:grid-cols-[48px_260px_1fr] lg:grid-cols-[48px_300px_1fr_300px] lg:gap-x-8">
        <span className="font-mono text-[11px] text-muted">{g.index}</span>
        <span className="flex flex-col gap-1.5">
          <span className="text-[24px] font-medium tracking-[-0.025em]">{evidenceLabel(g.id, g.name)}</span>
          <GradeTag grade={g.grade} />
        </span>
        <span className="col-span-2 text-[15px] leading-normal text-ink2 md:col-span-1">{g.finding}</span>
        <span className="col-span-2 md:col-span-3 lg:col-span-1">
          <EvidenceMicro measure={g.measure} />
        </span>
      </button>
      {open && (
        <dl className="fade-in grid grid-cols-1 gap-4 pb-6 text-[13.5px] md:grid-cols-4 md:pl-[72px]">
          <div>
            <dt className="eyebrow !text-[10px]">Method</dt>
            <dd className="mt-1 leading-normal text-ink2">{g.method}</dd>
          </div>
          <div>
            <dt className="eyebrow !text-[10px]">Window</dt>
            <dd className="mt-1 text-ink2">{g.window}</dd>
          </div>
          <div>
            <dt className="eyebrow !text-[10px]">Threshold</dt>
            <dd className="mt-1 text-ink2">{g.threshold}</dd>
          </div>
          <div>
            <dt className="eyebrow !text-[10px]">Records</dt>
            <dd className="mt-1 text-ink2">{g.records.join(" · ")}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function evidenceLabel(id: string, name: string) {
  const labels: Record<string, string> = { identification: "Experimental support", observability: "Observability", forecast: "Forecast reliability", service: "Service reliability", data: "Data quality" };
  return labels[id] ?? name;
}
