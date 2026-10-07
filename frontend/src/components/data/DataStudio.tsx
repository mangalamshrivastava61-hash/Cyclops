"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Eyebrow, PrimaryButton, SecondaryButton, TextLink, cx } from "@/components/ui/primitives";
import { DATA_FIELDS, DatasetRow, fieldLabels, useDataStudioStore } from "@/lib/store/data-studio-store";
import { parseCsvToDataset } from "@/lib/csv";
import { useRecentCsvStore } from "@/lib/store/recent-csv-store";

const sample = (rows: DatasetRow[]) => rows.slice(0, 6);

function parseCsv(input: string): string[][] {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line) => {
    const values: string[] = []; let current = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (line[i] === '"') quoted = !quoted;
      else if (line[i] === "," && !quoted) { values.push(current.trim()); current = ""; }
      else current += line[i];
    }
    values.push(current.trim()); return values;
  });
}

const aliases: Record<string, (typeof DATA_FIELDS)[number]> = {
  date: "date", sku: "sku", demand: "demand", sales: "demand", "demand sales": "demand",
  inventory: "inventory", "on order inventory": "onOrderInventory", "onorder inventory": "onOrderInventory",
  price: "price", promotion: "promotion", "lead time": "leadTime", leadtime: "leadTime",
};

function validate(rows: DatasetRow[]) {
  const issues: { kind: "error" | "warning"; message: string }[] = [];
  const count = (test: (row: DatasetRow) => boolean) => rows.filter(test).length;
  const missingDates = count((r) => !r.date.trim());
  const invalidDates = count((r) => Boolean(r.date.trim()) && Number.isNaN(Date.parse(r.date)));
  const missingSkus = count((r) => !r.sku.trim());
  const invalidNumbers = count((r) => [r.demand, r.inventory, r.onOrderInventory, r.price, r.leadTime].some((value) => value.trim() && !Number.isFinite(Number(value))));
  const negativeInventory = count((r) => [r.inventory, r.onOrderInventory].some((value) => value.trim() && Number(value) < 0));
  const invalidLead = count((r) => Boolean(r.leadTime.trim()) && (Number(r.leadTime) < 0 || !Number.isFinite(Number(r.leadTime))));
  const invalidPrice = count((r) => Boolean(r.price.trim()) && (Number(r.price) <= 0 || !Number.isFinite(Number(r.price))));
  const missingPrices = count((r) => !r.price.trim());
  if (missingDates) issues.push({ kind: "error", message: `${missingDates} missing date${missingDates === 1 ? "" : "s"}` });
  else if (invalidDates) issues.push({ kind: "error", message: `${invalidDates} invalid date${invalidDates === 1 ? "" : "s"}` });
  else issues.push({ kind: "warning", message: "No missing dates" });
  if (missingSkus) issues.push({ kind: "error", message: `${missingSkus} missing SKU value${missingSkus === 1 ? "" : "s"}` }); else issues.push({ kind: "warning", message: "No missing SKU values" });
  if (invalidNumbers) issues.push({ kind: "error", message: `${invalidNumbers} invalid numeric value${invalidNumbers === 1 ? "" : "s"}` });
  if (negativeInventory) issues.push({ kind: "error", message: `${negativeInventory} negative inventory value${negativeInventory === 1 ? "" : "s"}` }); else issues.push({ kind: "warning", message: "Inventory values valid" });
  if (invalidLead) issues.push({ kind: "error", message: `${invalidLead} invalid lead time${invalidLead === 1 ? "" : "s"}` });
  if (invalidPrice) issues.push({ kind: "error", message: `${invalidPrice} invalid price${invalidPrice === 1 ? "" : "s"}` });
  if (missingPrices) issues.push({ kind: "warning", message: `${missingPrices} missing price${missingPrices === 1 ? "" : "s"}` });
  return { issues, valid: rows.length > 0 && !issues.some((issue) => issue.kind === "error") };
}

function dateRange(rows: DatasetRow[]) {
  const dates = rows.map((r) => new Date(r.date)).filter((d) => !Number.isNaN(d.valueOf())).sort((a, b) => a.valueOf() - b.valueOf());
  if (!dates.length) return "—";
  const format = (date: Date) => date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return `${format(dates[0])} — ${format(dates[dates.length - 1])}`;
}

export function DataStudio({ manual = false }: { manual?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { rows, filename, source, setDataset, updateRow, addRow, deleteRow, clear, useDataset, activeDataset } = useDataStudioStore();
  const [validated, setValidated] = useState(false);
  const result = useMemo(() => validate(rows), [rows]);
  const skus = new Set(rows.map((r) => r.sku.trim()).filter(Boolean)).size;
  const datasetLabel = filename ?? (manual || source === "manual" ? "Manual entry" : "Untitled dataset");

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    useRecentCsvStore.getState().setRecentCsv(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsvToDataset(String(reader.result));
      setDataset(parsed, file.name, "upload");
      setValidated(false);
    };
    reader.readAsText(file);
  };

  const canUse = result.valid && validated;
  return (
    <div className="pt-12 pb-6">
      <Eyebrow>Data Studio</Eyebrow>
      <h1 className="mt-5 max-w-[760px] font-medium tracking-[-0.05em] text-[clamp(46px,5.9vw,80px)] leading-[0.98]">Bring your data into <span className="serif">ORACLE.</span></h1>
      <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-ink2">Upload a dataset, enter a small dataset manually, or inspect the data currently staged for ORACLE.</p>
      {!manual && <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px]"><button type="button" onClick={() => inputRef.current?.click()} className="link-underline">UPLOAD DATA</button><Link href="/data/manual" className="link-underline">ENTER MANUALLY</Link>{rows.length > 0 && <a href="#data-preview" className="link-underline">VIEW DATA</a>}</div>}

      {!manual && <section className="mt-14 border-y border-ink py-7">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><Eyebrow>Upload data</Eyebrow><p className="mt-3 text-[16px] leading-relaxed text-ink2">Select a CSV file to inspect, validate and stage in this browser.</p></div><div className="flex flex-wrap gap-3"><input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" /><SecondaryButton onClick={() => inputRef.current?.click()}>SELECT CSV</SecondaryButton><Link href="/data/manual" className="link-underline self-center text-[14px]">ENTER MANUALLY</Link></div></div>
      </section>}

      {manual && <section className="mt-14 border-y border-ink py-7"><div className="flex flex-wrap items-end justify-between gap-5"><div><Eyebrow>Enter manually</Eyebrow><p className="mt-3 text-[16px] text-ink2">Enter a small dataset manually, one retail observation at a time.</p></div><div className="flex gap-3"><TextLink href="/data">Upload data</TextLink><SecondaryButton onClick={() => { if (!rows.length) { addRow(); setValidated(false); } }}>+ ADD ROW</SecondaryButton></div></div></section>}

      {!rows.length ? <section className="py-16"><Eyebrow>Dataset status</Eyebrow><p className="mt-3 text-[18px] text-ink2">No dataset is loaded yet.</p><div className="mt-6 flex flex-wrap gap-3">{!manual && <SecondaryButton onClick={() => inputRef.current?.click()}>UPLOAD DATA</SecondaryButton>}<Link href="/data/manual" className="link-underline self-center text-[14px]">ENTER MANUALLY</Link></div></section> : <>
        <section className="mt-10 flex flex-col gap-4 border-y border-ink py-5 sm:flex-row sm:items-center sm:justify-between"><div><Eyebrow>Dataset status</Eyebrow><p className="mt-2 text-[15px]">{activeDataset ? "Dataset loaded" : "Dataset staged"} <span className="text-ink2">· {datasetLabel} · {rows.length} rows</span></p></div><div className={cx("font-mono text-[11px] tracking-[0.12em] uppercase", validated ? (result.valid ? "text-ink" : "text-oxblood") : "text-muted")}>{validated ? (result.valid ? "Validation passed" : "Validation needs attention") : "Not yet validated"}</div></section>
        <section className="mt-10 grid gap-x-12 gap-y-6 border-b border-rule pb-8 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Rows" value={String(rows.length)} /><Metric label="SKUs" value={String(skus)} /><Metric label="Date range" value={dateRange(rows)} /><Metric label="Columns" value="8" />
        </section>
        <section id="data-preview" className="mt-10 scroll-mt-8"><div className="flex items-baseline justify-between gap-5"><Eyebrow>{manual ? "Observations" : "Data preview"}</Eyebrow>{filename && <span className="font-mono text-[11px] text-muted">{filename}</span>}</div>
          <div className="mt-4 overflow-x-auto border-y border-ink"><table className="w-full min-w-[980px] text-left text-[12px]"><thead className="border-b border-rule font-mono text-[10px] tracking-[0.12em] text-muted uppercase"><tr>{DATA_FIELDS.map((field) => <th key={field} className="px-3 py-3 font-normal">{fieldLabels[field]}</th>)}{manual && <th className="px-3 py-3" />}</tr></thead><tbody>{(manual ? rows : sample(rows)).map((row) => <tr key={row.id} className="border-b border-hairline last:border-0">{DATA_FIELDS.map((field) => <td key={field} className="px-3 py-2.5">{manual ? <input aria-label={`${fieldLabels[field]} row`} value={row[field]} onChange={(e) => { updateRow(row.id, field, e.target.value); setValidated(false); }} className="w-full min-w-[80px] border-b border-transparent bg-transparent py-1 outline-none focus:border-ink" /> : row[field] || <span className="text-muted">—</span>}</td>)}{manual && <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => { deleteRow(row.id); setValidated(false); }} className="text-muted hover:text-oxblood">Delete</button></td>}</tr>)}</tbody></table></div>
          {manual && <div className="mt-5"><SecondaryButton onClick={() => { addRow(); setValidated(false); }}>+ ADD ROW</SecondaryButton></div>}
        </section>
        <section className="mt-12 grid gap-8 border-t border-ink pt-7 lg:grid-cols-[1fr_auto]"><div><Eyebrow>Data quality</Eyebrow><div className="mt-4 space-y-2 text-[14px]">{validated ? result.issues.map((issue, i) => <p key={`${issue.message}-${i}`} className={cx(issue.kind === "error" ? "text-oxblood" : "text-ink2")}><span className="mr-2">{issue.kind === "error" ? "×" : "✓"}</span>{issue.message}</p>) : <p className="text-ink2">Validate the dataset before using it.</p>}</div></div><div className="flex flex-wrap items-start gap-3"><SecondaryButton onClick={() => setValidated(true)}>VALIDATE DATASET</SecondaryButton><PrimaryButton disabled={!canUse} onClick={useDataset}>USE DATASET</PrimaryButton></div></section>
        <div className="mt-8 flex flex-wrap items-center gap-6"><button type="button" onClick={() => { clear(); setValidated(false); }} className="link-underline text-[14px]">CLEAR</button>{activeDataset && <><span className="text-[13px] text-muted">Dataset loaded locally: {activeDataset.filename} · {activeDataset.rows} rows</span><TextLink href="/time-machine" className="text-[14px]">Replay with Time Machine</TextLink></>}</div>
      </>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div><Eyebrow>{label}</Eyebrow><p className="mt-2 text-[18px] font-medium tracking-[-0.02em]">{value}</p></div>; }
