"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chip, Eyebrow, Serif, SecondaryButton, cx } from "@/components/ui/primitives";
import { int, stamp } from "@/lib/format";
import { getEvidence, getProduct, listDecisions, listRetailHistory } from "@/lib/services/repository";
import { selectDecision, useOracleStore } from "@/lib/store/oracle-store";
import { useRecentCsvStore } from "@/lib/store/recent-csv-store";
import { api } from "@/lib/services/api";
import { parseCsvToDataset, datasetRowToRetailHistory } from "@/lib/csv";
import { RetailHistoryRow, retailHistory } from "@/data/history";

type View = "data" | "decisions";
type Status = "all" | "approved" | "modified" | "rejected";

const defaultDecisions = listDecisions();

/** Formats date into exact uppercase format like: "26 SEPT 2026" */
const formatCardDate = (dateStr: string) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
    if (!isNaN(d.getTime())) {
      const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
      const month = d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    }
    return dateStr.toUpperCase();
  } catch {
    return dateStr.toUpperCase();
  }
};

const money = (amount: number) => `₹${int(Math.round(amount))}`;

export function HistoryView() {
  const [view, setView] = useState<View>("data");
  const [sku, setSku] = useState("all");
  const [date, setDate] = useState("all");
  const [status, setStatus] = useState<Status>("all");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store ONLY the CSV name and timestamp (no row details in storage)
  const { recentCsvName, setRecentCsv } = useRecentCsvStore();

  // In-memory records from the active CSV dataset (fetched or in-memory session)
  const [activeRecords, setActiveRecords] = useState<RetailHistoryRow[]>(retailHistory);
  const [displayCount, setDisplayCount] = useState(8);

  // Load records from the backend for the active CSV dataset
  useEffect(() => {
    let isMounted = true;
    api.mlHistory(200)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.records && res.records.length > 0) {
          if (!recentCsvName && res.data_source) {
            setRecentCsv(res.data_source);
          }
          const mapped: RetailHistoryRow[] = res.records.map((r) => ({
            date: r.date,
            sku: r.sku,
            demand: r.demand,
            inventory: r.inventory,
            price: r.price,
            promotion: r.promotion,
            stockout: r.stockout,
            productName: r.product_name,
          }));
          setActiveRecords(mapped);
        }
      })
      .catch(() => {
        // Fallback to default retail records if backend is unavailable
      });

    return () => {
      isMounted = false;
    };
  }, [recentCsvName, setRecentCsv]);

  // When a user selects a CSV, save ONLY the file name in store, and load rows in-memory
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Store ONLY the file name
    setRecentCsv(file.name);

    // 2. Parse in-memory for immediate display in the cards
    try {
      const text = await file.text();
      const parsedRows = parseCsvToDataset(text);
      if (parsedRows.length > 0) {
        const rows = parsedRows.map(datasetRowToRetailHistory);
        setActiveRecords(rows);
        setSku("all");
        setDate("all");
        setDisplayCount(8);
      }
    } catch (e) {
      console.warn("Could not parse file in-memory:", e);
    }

    // 3. Post to backend so ML backend stays in sync
    api.mlUploadAndPredict(file, 1).catch(() => {});

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Compute unique SKU options from current records
  const skuOptions = useMemo(() => {
    const set = new Set([
      ...activeRecords.map((r) => r.sku),
      ...defaultDecisions.map((d) => d.sku),
    ]);
    return Array.from(set).filter(Boolean).sort();
  }, [activeRecords]);

  // Compute unique Date options
  const dateOptions = useMemo(() => {
    if (view === "data") {
      return Array.from(new Set(activeRecords.map((r) => r.date).filter(Boolean))).sort().reverse();
    }
    return Array.from(new Set(defaultDecisions.map((d) => d.createdAt.slice(0, 10)))).sort().reverse();
  }, [view, activeRecords]);

  // Filtered retail records
  const filteredRecords = useMemo(() => {
    return activeRecords.filter(
      (record) =>
        (sku === "all" || record.sku === sku) &&
        (date === "all" || record.date === date || record.date.startsWith(date))
    );
  }, [activeRecords, sku, date]);

  const shownRecords = useMemo(() => {
    return filteredRecords.slice(0, displayCount);
  }, [filteredRecords, displayCount]);

  return (
    <div className="pt-12 pb-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-baseline">
        <Eyebrow>
          History · {recentCsvName ? `Active dataset: ${recentCsvName}` : "Synthetic demo records"}
        </Eyebrow>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="sr-only"
          />
          <SecondaryButton onClick={() => fileInputRef.current?.click()} className="!text-[12px] !py-1 !px-3">
            + UPLOAD CSV
          </SecondaryButton>
        </div>
      </div>

      <h1 className="mt-5 max-w-[970px] font-medium tracking-[-0.05em] text-[clamp(46px,5.9vw,80px)] leading-[0.98]">
        See what happened, what ORACLE recommended, <Serif>and what happened next.</Serif>
      </h1>

      <div className="mt-12 flex flex-col justify-between gap-5 border-y border-ink py-4 md:flex-row md:items-center">
        <div role="tablist" aria-label="History type" className="flex gap-7 text-[14px]">
          <Tab active={view === "data"} onClick={() => setView("data")}>
            DATA HISTORY
          </Tab>
          <Tab active={view === "decisions"} onClick={() => setView("decisions")}>
            DECISION HISTORY
          </Tab>
        </div>
        <Filters
          sku={sku}
          date={date}
          status={status}
          onSku={setSku}
          onDate={setDate}
          onStatus={setStatus}
          skuOptions={skuOptions}
          dates={dateOptions}
          showStatus={view === "decisions"}
        />
      </div>

      {view === "data" ? (
        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-5">
            <div>
              <Eyebrow>WHAT HAPPENED IN THE RETAIL SYSTEM</Eyebrow>
              <p className="mt-2 text-[14px] text-ink2">
                {recentCsvName
                  ? `Synthetic Store 03 observations · Source: ${recentCsvName}`
                  : "Synthetic Store 03 observations · sample only"}
              </p>
            </div>
            <span className="font-mono text-[11px] text-muted">
              {filteredRecords.length} {filteredRecords.length === 1 ? "RECORD" : "RECORDS"}
            </span>
          </div>

          {filteredRecords.length === 0 ? (
            <Empty label="NO DATA FOUND" message="Try changing the date or SKU filter, or upload a CSV." />
          ) : (
            <>
              {/* Exact card layout matching the original design */}
              <ol className="mt-6 grid gap-x-10 border-t border-ink md:grid-cols-2">
                {shownRecords.map((record, idx) => {
                  const product = getProduct(record.sku);
                  const displayName = record.productName || product?.name || `Product ${record.sku}`;
                  return (
                    <li
                      key={`${record.date}-${record.sku}-${idx}`}
                      className="grid grid-cols-[1fr_auto] gap-5 border-b border-hairline py-5"
                    >
                      <div>
                        <Eyebrow>
                          {formatCardDate(record.date)} · SKU {record.sku}
                        </Eyebrow>
                        <h2 className="mt-2 text-[23px] font-medium tracking-[-0.03em]">{displayName}</h2>
                        <p className="mt-2 text-[13px] text-ink2">
                          {record.promotion ? "Promotion active" : "Standard price"} ·{" "}
                          {record.stockout ? (
                            <span className="text-oxblood">Stockout observed</span>
                          ) : (
                            "In stock"
                          )}
                        </p>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-7 gap-y-3 self-start text-right">
                        <Fact label="Demand" value={String(record.demand)} />
                        <Fact label="Inventory" value={String(record.inventory)} />
                        <Fact label="Price" value={money(record.price)} />
                        <Fact
                          label="Status"
                          value={record.stockout ? "Stockout" : "Available"}
                          danger={record.stockout}
                        />
                      </dl>
                    </li>
                  );
                })}
              </ol>

              {filteredRecords.length > displayCount && (
                <div className="mt-8 text-center">
                  <SecondaryButton onClick={() => setDisplayCount((prev) => prev + 8)}>
                    SHOW MORE ({filteredRecords.length - displayCount} REMAINING)
                  </SecondaryButton>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <DecisionHistory sku={sku} date={date} status={status} />
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx("py-1.5", active ? "border-b border-ink font-medium" : "text-ink2 hover:text-ink")}
    >
      {children}
    </button>
  );
}

function Filters({
  sku,
  date,
  status,
  onSku,
  onDate,
  onStatus,
  skuOptions,
  dates,
  showStatus,
}: {
  sku: string;
  date: string;
  status: Status;
  onSku: (value: string) => void;
  onDate: (value: string) => void;
  onStatus: (value: Status) => void;
  skuOptions: string[];
  dates: string[];
  showStatus: boolean;
}) {
  const selectClass = "border-b border-rule bg-transparent py-2 text-[12px] outline-none focus:border-ink";
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      <label className="flex items-center gap-2">
        <span className="eyebrow !text-[9px]">SKU</span>
        <select value={sku} onChange={(event) => onSku(event.target.value)} className={selectClass}>
          <option value="all">All</option>
          {skuOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="eyebrow !text-[9px]">Date</span>
        <select value={date} onChange={(event) => onDate(event.target.value)} className={selectClass}>
          <option value="all">All</option>
          {dates.map((value) => (
            <option key={value} value={value}>
              {formatCardDate(value)}
            </option>
          ))}
        </select>
      </label>
      {showStatus && (
        <label className="flex items-center gap-2">
          <span className="eyebrow !text-[9px]">Status</span>
          <select
            value={status}
            onChange={(event) => onStatus(event.target.value as Status)}
            className={selectClass}
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="modified">Modified</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      )}
    </div>
  );
}

function DecisionHistory({ sku, date, status }: { sku: string; date: string; status: Status }) {
  const actions = useOracleStore((state) => state.decisions);
  const [selected, setSelected] = useState<string | null>(null);

  const records = useMemo(
    () =>
      defaultDecisions
        .map((decision) => ({ decision, action: selectDecision({ decisions: actions }, decision.id) }))
        .filter(
          ({ decision, action }) =>
            (sku === "all" || decision.sku === sku) &&
            (date === "all" || decision.createdAt.startsWith(date)) &&
            (status === "all" || action.status === status)
        ),
    [actions, sku, date, status]
  );

  const current = records.find((record) => record.decision.id === selected) ?? records[0];

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-5">
        <div>
          <Eyebrow>What ORACLE recommended, and what followed</Eyebrow>
          <p className="mt-2 text-[14px] text-ink2">
            Decision records and planner actions from the append-only demo ledger.
          </p>
        </div>
        <Link href="/ledger" className="link-underline whitespace-nowrap text-[13px]">
          VIEW IN LEDGER →
        </Link>
      </div>

      {records.length === 0 ? (
        <Empty label="NO DECISIONS FOUND" message="Try changing the date, SKU or status filter." />
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ol className="border-t border-ink">
            {records.map(({ decision, action }) => {
              const product = getProduct(decision.sku)!;
              const active = current?.decision.id === decision.id;
              return (
                <li key={decision.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(decision.id)}
                    className={cx(
                      "grid w-full grid-cols-[1fr_auto] gap-5 border-b border-hairline py-5 text-left transition-colors",
                      active && "-mx-4 w-[calc(100%+32px)] bg-paper px-4 shadow-[inset_0_0_0_1px_var(--color-ink)]"
                    )}
                  >
                    <div>
                      <Eyebrow>
                        {formatCardDate(decision.createdAt.slice(0, 10))} · SKU {decision.sku}
                      </Eyebrow>
                      <h2 className="mt-2 text-[24px] font-medium tracking-[-0.03em]">
                        {product.name} —{" "}
                        {decision.action === "order"
                          ? `order ${decision.recommendedOrder}`
                          : decision.action === "none"
                          ? "no order"
                          : "20% markdown"}
                      </h2>
                      <p className="mt-2 text-[13px] text-ink2">{outcome(decision.id, decision.circuit)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <StatusChip status={action.status} />
                      <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
                        {authorityLabel(decision.authority)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          {current && <DecisionDetail decision={current.decision} action={current.action} />}
        </div>
      )}
    </section>
  );
}

function DecisionDetail({
  decision,
  action,
}: {
  decision: (typeof defaultDecisions)[number];
  action: ReturnType<typeof selectDecision>;
}) {
  const product = getProduct(decision.sku)!;
  const evidence = getEvidence(decision.id);
  const overridden = action.quantity !== decision.recommendedOrder;

  return (
    <aside className="self-start border-t border-ink pt-5 lg:sticky lg:top-6">
      <Eyebrow>Decision detail</Eyebrow>
      <h2 className="mt-3 text-[31px] font-medium tracking-[-0.04em]">{product.name}</h2>
      <p className="mt-1 text-[13px] text-muted">
        SKU {decision.sku} · {stamp(decision.createdAt)}
      </p>
      <dl className="mt-6 space-y-3 border-t border-hairline pt-3">
        <Detail
          label="ORACLE recommended"
          value={
            decision.action === "order"
              ? `Order ${decision.recommendedOrder}`
              : decision.action === "none"
              ? "No order"
              : "20% markdown"
          }
          strong
        />
        <Detail
          label="Planner action"
          value={
            action.status === "pending"
              ? "Awaiting review"
              : action.status === "modified"
              ? `Modified to ${action.quantity}`
              : action.status
          }
        />
        <Detail
          label="Override"
          value={
            overridden
              ? `${decision.recommendedOrder} → ${action.quantity}${action.reason ? ` · ${action.reason}` : ""}`
              : "None"
          }
        />
        <Detail
          label="Evidence"
          value={
            evidence
              ? `${evidence.grades.filter((g) => g.grade === "pass").length} pass · ${
                  evidence.grades.filter((g) => g.grade === "partial").length
                } partial`
              : "Not assessed"
          }
        />
        <Detail label="Authority" value={authorityLabel(decision.authority)} />
        <Detail label="Outcome" value={outcome(decision.id, decision.circuit)} />
      </dl>
      <div className="mt-7 flex gap-5">
        <Link href={`/decision/${decision.id}`} className="link-underline inline-flex text-[13px]">
          OPEN DECISION →
        </Link>
        <Link href={`/ledger?entry=${decision.id}`} className="link-underline inline-flex text-[13px]">
          VIEW IN LEDGER →
        </Link>
      </div>
    </aside>
  );
}

function outcome(id: string, circuit: string) {
  if (id === "18509") return "Planner score scheduled for 8 Oct.";
  if (circuit === "bench") return "Fallback active after the in-stock gate breach.";
  if (id === "18511") return "No replenishment needed; stock covers the protection period.";
  return "Post-arrival outcome not yet recorded.";
}

function authorityLabel(level: number) {
  return level >= 3 ? "L3 · ACT" : level === 2 ? "L2 · REVIEW" : "L1 · ADVISORY";
}

function StatusChip({ status }: { status: string }) {
  const kind = status === "modified" ? "review" : status === "approved" ? "act" : "advisory";
  return <Chip kind={kind}>{status === "pending" ? "Waiting" : status}</Chip>;
}

function Fact({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <dt className="eyebrow !text-[9px]">{label}</dt>
      <dd className={cx("mt-1 text-[14px] font-medium", danger && "text-oxblood")}>{value}</dd>
    </div>
  );
}

function Detail({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-4 text-[13px]">
      <dt className="eyebrow !text-[9px]">{label}</dt>
      <dd className={cx("text-right", strong && "text-[17px] font-medium")}>{value}</dd>
    </div>
  );
}

function Empty({ label, message }: { label: string; message: string }) {
  return (
    <div className="border-y border-ink py-16 text-center">
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-3 text-[16px] text-ink2">{message}</p>
    </div>
  );
}
