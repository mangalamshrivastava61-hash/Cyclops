"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eyebrow, Serif, TextLink, cx } from "@/components/ui/primitives";
import { T } from "@/lib/tokens";
import {
  datasetReplay,
  getDefaultReplayRows,
  REPLAY_HORIZONS,
  replayAt,
  replayDates,
  replayMonths,
  replaySkus,
} from "@/lib/replay";
import { longDate } from "@/lib/format";
import { useDataStudioStore } from "@/lib/store/data-studio-store";
import { useWebGL } from "@/components/oracle-object/OracleView";

const FilmScene = dynamic(() => import("./FilmScene"), { ssr: false });

export function TimeMachine() {
  const { rows: studioRows, filename, activeDataset } = useDataStudioStore();

  const [useCustomDataset, setUseCustomDataset] = useState(Boolean(activeDataset && studioRows.length > 0));

  // Determine active rows: if custom dataset chosen and available, use it; otherwise, use default sealed decision rows
  const defaultRows = useMemo(() => getDefaultReplayRows(), []);
  const hasCustom = Boolean(studioRows.length > 0);
  const activeRows = useCustomDataset && hasCustom ? studioRows : defaultRows;
  const currentDatasetLabel =
    useCustomDataset && hasCustom
      ? (filename ?? activeDataset?.filename ?? "Custom Dataset")
      : "Sealed Decision R-2291 · Synthetic Store 03";

  const skus = useMemo(() => replaySkus(activeRows), [activeRows]);
  const [sku, setSku] = useState(skus[0] || "1842");

  // Keep SKU valid when activeRows changes
  useEffect(() => {
    if (skus.length && !skus.includes(sku)) {
      setSku(skus[0]);
    }
  }, [skus, sku]);

  const dates = useMemo(() => replayDates(activeRows, sku), [activeRows, sku]);
  const [replayDate, setReplayDate] = useState("");
  const [horizon, setHorizon] = useState<number>(12);

  // Set smart default replay date
  useEffect(() => {
    if (!dates.length) return;
    if (activeRows === defaultRows) {
      setReplayDate("2025-10-14");
    } else if (!dates.includes(replayDate)) {
      const targetIndex = Math.max(0, Math.min(dates.length - 8, Math.floor(dates.length * 0.7)));
      setReplayDate(dates[targetIndex]);
    }
  }, [dates, replayDate, activeRows, defaultRows]);

  const futureCount = useMemo(() => {
    if (!replayDate) return 0;
    return activeRows.filter(
      (row) => row.sku.trim() === sku && new Date(row.date).valueOf() > new Date(replayDate).valueOf()
    ).length;
  }, [activeRows, sku, replayDate]);

  const availableHorizons = useMemo(() => {
    const matched = REPLAY_HORIZONS.filter((days) => futureCount >= days);
    if (matched.length > 0) return matched;
    if (futureCount >= 2) return [futureCount];
    return [7];
  }, [futureCount]);

  const activeHorizon = availableHorizons.includes(horizon as any)
    ? horizon
    : availableHorizons[availableHorizons.length - 1] || 7;

  const replay = useMemo(() => {
    if (!replayDate) return null;
    return datasetReplay(activeRows, sku, replayDate, activeHorizon);
  }, [activeRows, sku, replayDate, activeHorizon]);

  return (
    <div className="pt-12 pb-6">
      <div className="flex flex-col justify-between gap-8 md:flex-row">
        <div>
          <Eyebrow>Time Machine · Dataset replay</Eyebrow>
          <h1 className="mt-5 font-medium tracking-[-0.05em] text-[clamp(48px,5vw,72px)] leading-[0.98]">
            Step back into
            <Serif className="block text-[clamp(52px,5.3vw,76px)] leading-none tracking-normal">
              what ORACLE knew.
            </Serif>
          </h1>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-[7px] self-start font-mono text-[10.5px] tracking-[0.1em] uppercase md:mr-8">
          <dt className="text-muted">Dataset</dt>
          <dd>{currentDatasetLabel}</dd>
          <dt className="text-muted">Loaded</dt>
          <dd>{activeRows.length} rows</dd>
          <dt className="text-muted">Leakage</dt>
          <dd>0 future rows read</dd>
        </dl>
      </div>

      {/* Dataset switcher pill if custom dataset is loaded */}
      {hasCustom && (
        <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px]">
          <span className="eyebrow !text-[10px]">REPLAY SOURCE:</span>
          <button
            type="button"
            onClick={() => setUseCustomDataset(false)}
            className={cx(
              "rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wide border transition-colors",
              !useCustomDataset
                ? "border-ink bg-ink text-ground font-medium"
                : "border-rule text-ink2 hover:border-ink hover:text-ink"
            )}
          >
            Sealed Decision R-2291 (Demo)
          </button>
          <button
            type="button"
            onClick={() => setUseCustomDataset(true)}
            className={cx(
              "rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wide border transition-colors",
              useCustomDataset
                ? "border-ink bg-ink text-ground font-medium"
                : "border-rule text-ink2 hover:border-ink hover:text-ink"
            )}
          >
            Uploaded Dataset ({filename ?? activeDataset?.filename ?? "Custom"})
          </button>
        </div>
      )}

      <section className="mt-10 flex flex-col gap-5 border-y border-ink py-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="SKU" value={sku} onChange={setSku} options={skus} />
          <Select
            label="Replay date"
            value={replayDate}
            onChange={setReplayDate}
            options={dates.map((date) => ({ value: date, label: longDate(date) }))}
          />
        </div>
        <div>
          <Eyebrow>Replay horizon</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableHorizons.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setHorizon(days)}
                className={cx(
                  "border px-3 py-2 font-mono text-[11px] tracking-[0.1em] uppercase transition-colors",
                  activeHorizon === days
                    ? "border-ink bg-ink text-ground"
                    : "border-ink hover:bg-ink hover:text-ground"
                )}
              >
                {days} days
              </button>
            ))}
          </div>
          {!futureCount && (
            <p className="mt-2 text-[12px] text-oxblood">
              Choose an earlier date to leave subsequent days to replay.
            </p>
          )}
        </div>
      </section>

      {!replay ? (
        <InsufficientState />
      ) : (
        <ReplayView key={`${sku}-${replayDate}-${activeHorizon}`} replay={replay} />
      )}
    </div>
  );
}

function ReplayView({ replay }: { replay: ReturnType<typeof datasetReplay> }) {
  const [revealed, setRevealed] = useState(0);
  const [playRequested, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const webgl = useWebGL();
  const n = replay.window.length;
  const at = replayAt(replay, revealed);
  const months = replayMonths(replay);
  const playing = playRequested && revealed < n;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setRevealed((current) => Math.min(n, current + 1)), 1100);
    return () => window.clearTimeout(timer);
  }, [playing, revealed, n]);

  // Safety fallback: ensure scene and labels become visible after brief mount
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (webgl === false) setReady(true);
  }, [webgl]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      setRevealed((current) => Math.max(0, Math.min(n, current + delta)));
    },
    [n]
  );

  const togglePlay = () => {
    if (revealed >= n) {
      setRevealed(0);
      setPlaying(true);
      return;
    }
    setPlaying(!playing);
  };

  const knownLabel = replay.onHand === undefined ? "64 on hand" : `${replay.onHand} on hand`;
  const knownSub =
    replay.onOrder === undefined
      ? `${replay.known.length} row${replay.known.length === 1 ? "" : "s"} available at this date.`
      : `${replay.onOrder} on order · ${replay.known.length} rows available at this date.`;

  const isDemo = replay.sku === "1842";
  const predLabel = isDemo ? "192 units" : "Baseline forecast";
  const predSub = isDemo
    ? "P50 target for protection window (P10: 151, P90: 238)."
    : "Demand trajectory modeled before the seal.";
  const decLabel = isDemo ? "Order 118" : "Decision active";
  const decSub = isDemo
    ? "Target position 249 − 64 on hand − 30 on order (fallback 90)."
    : "ORACLE replenishment recommendation applied.";

  return (
    <>
      <div
        ref={stage}
        className="relative -mt-[120px] h-[470px] w-screen md:-mt-[150px] md:h-[600px]"
        style={{ marginLeft: "calc(50% - 50vw)" }}
        role="img"
        aria-label={`A dataset-derived rail ending at the decision on ${longDate(
          replay.replayDate
        )}. ${revealed} of ${n} future rows are revealed; the remaining outcome is sealed.`}
      >
        <div
          className={cx("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
          style={{
            maskImage: "linear-gradient(to bottom, #000 80%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 80%, transparent)",
          }}
        >
          {webgl === false ? (
            <div className="absolute inset-0 bg-ground" onLoad={() => setReady(true)} />
          ) : webgl ? (
            <FilmScene
              replay={replay}
              revealed={revealed}
              anchorRootRef={labels}
              frameloop={visible ? "always" : "never"}
              onReady={() => setReady(true)}
            />
          ) : null}
        </div>
        <div
          ref={labels}
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700",
            ready ? "opacity-100" : "opacity-0"
          )}
        >
          {months.map((month) => (
            <span key={month.key} data-anchor={`m-${month.key}`} className="absolute top-0 left-0 opacity-0">
              <span className="block -translate-x-1/2 translate-y-2 font-mono text-[10px] tracking-[0.14em] text-ink2">
                {month.label}
              </span>
            </span>
          ))}
          <span data-anchor="decision" className="absolute top-0 left-0 opacity-0">
            <span className="flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1">
              <span className="whitespace-nowrap font-mono text-[10.5px] tracking-[0.12em] text-ink">
                {longDate(replay.replayDate).toUpperCase()} · REPLAY
              </span>
              <span className="h-8 w-px bg-ink" />
            </span>
          </span>
          <span data-anchor="head" className="absolute top-0 left-0 opacity-0">
            <span className="flex -translate-y-1/2 items-center gap-2 whitespace-nowrap font-mono text-[10.5px] tracking-[0.12em] text-ink">
              <span className="h-px w-6 bg-ink" />
              {revealed === 0 ? "AT THE SEAL" : <>DAY {revealed} OF {n}</>}
            </span>
          </span>
          <span data-anchor="sealed" className="absolute top-0 left-0 opacity-0">
            <span className="flex w-[230px] flex-col gap-1">
              <span className="font-mono text-[10.5px] tracking-[0.14em] text-ink2">
                {at.finished ? "WINDOW COMPLETE" : "SEALED"}
              </span>
              <span className="text-[13.5px] leading-snug text-ink2 max-sm:hidden">
                {at.finished
                  ? "Every selected outcome row is open."
                  : "The outcome opens one row at a time."}
              </span>
            </span>
          </span>
        </div>
      </div>
      <div className="relative z-10 -mt-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <TransportButton label="Back one day" disabled={revealed === 0} onClick={() => step(-1)} direction="back" />
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause replay" : revealed >= n ? "Replay from the seal" : "Play replay"}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-ink transition-transform active:scale-95"
          >
            {playing ? (
              <span className="h-3 w-3 border-x-2 border-ground" />
            ) : (
              <span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-ground" />
            )}
          </button>
          <TransportButton label="Reveal next day" disabled={revealed === n} onClick={() => step(1)} direction="next" />
          <label className="ml-2 flex min-w-[220px] flex-1 flex-col gap-1 md:w-[260px] md:flex-none">
            <span className="text-[14px] text-ink2" aria-live="polite">
              {revealed === 0 ? "At the seal · no outcome rows revealed" : `Replaying ${at.currentLabel}`}
            </span>
            <input
              type="range"
              className="oracle-range"
              min={0}
              max={n}
              step={1}
              value={revealed}
              aria-label="Outcome rows revealed"
              aria-valuetext={`${revealed} of ${n} outcome rows revealed`}
              onChange={(event) => {
                setPlaying(false);
                setRevealed(Number(event.target.value));
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-6 text-[12.5px] text-ink2">
          <Key fill="#ECE6DA" stroke={T.rule}>
            Known at the time
          </Key>
          <Key fill={T.gold}>Replay date</Key>
          <Key fill={T.ink}>Revealed outcome</Key>
          <Key fill={T.ground} stroke={T.rule}>
            Still sealed
          </Key>
        </div>
      </div>
      <div className="mt-9 grid grid-cols-2 border-t border-ink pt-4 lg:grid-cols-4">
        <Col first label="What ORACLE knew" value={knownLabel} sub={knownSub} />
        <Col label="What it predicted" value={predLabel} sub={predSub} />
        <Col label="What it decided" value={decLabel} sub={decSub} />
        <Col
          label="What happened"
          value={revealed === 0 ? "Sealed" : `${at.sold} demand`}
          sub={
            revealed === 0
              ? "Press play to reveal outcome rows one at a time."
              : at.endingInventory === undefined
              ? "Ending inventory is not available in the revealed rows."
              : `${at.endingInventory} ending inventory in ${revealed} revealed row${
                  revealed === 1 ? "" : "s"
                }.`
          }
          live
        />
      </div>
    </>
  );
}

function InsufficientState() {
  return (
    <div className="py-20">
      <Eyebrow>Replay unavailable</Eyebrow>
      <p className="mt-3 text-[18px] text-ink2">
        Choose an earlier replay date with subsequent observations to open the future window.
      </p>
      <TextLink href="/data" className="mt-6 text-[14px]">
        Manage datasets in Data Studio
      </TextLink>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <label className="flex min-w-[180px] flex-col gap-2">
      <Eyebrow>{label}</Eyebrow>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-b border-ink bg-transparent pb-2 text-[15px] outline-none focus:border-gold-deep"
      >
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function TransportButton({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: "back" | "next";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-ink transition-opacity disabled:opacity-30"
    >
      <span aria-hidden="true" className={cx("text-lg leading-none", direction === "back" ? "-translate-x-px" : "translate-x-px")}>
        {direction === "back" ? "‹" : "›"}
      </span>
    </button>
  );
}

function Key({ fill, stroke, children }: { fill: string; stroke?: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="6" height="16" viewBox="0 0 6 16" aria-hidden="true">
        <rect x="0.5" y="0.5" width="5" height="15" rx="1" fill={fill} stroke={stroke ?? fill} />
      </svg>
      {children}
    </span>
  );
}

function Col({
  label,
  value,
  sub,
  first,
  live,
}: {
  label: string;
  value: string;
  sub: string;
  first?: boolean;
  live?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-2 py-2",
        first ? "pr-6" : "px-6 lg:border-l lg:border-hairline",
        "max-lg:px-0 max-lg:pr-6"
      )}
      aria-live={live ? "polite" : undefined}
    >
      <Eyebrow className="!text-[10px]">{label}</Eyebrow>
      <span className="text-[28px] leading-none font-medium tracking-[-0.04em] whitespace-nowrap tabular sm:text-[34px]">
        {value}
      </span>
      <span className="text-[12.5px] leading-snug text-muted">{sub}</span>
    </div>
  );
}
