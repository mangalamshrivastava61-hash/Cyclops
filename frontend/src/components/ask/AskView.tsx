"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { AskAnswer, AskBlock, AskSource } from "@/types";
import { ask, DEFAULT_QUESTION, SUGGESTIONS, type AskContext } from "@/lib/ask/engine";
import { decisionBundle, getAuthority, stress as stressData, world } from "@/lib/services/repository";
import { selectDecision, useAuthorityLevel, useOracleStore } from "@/lib/store/oracle-store";
import { position, stockoutRisk } from "@/lib/model/policy";
import { flipCurve } from "@/lib/stress";
import { clock, nowOnWorldDay } from "@/lib/format";
import { DemandDistribution } from "@/components/charts/DemandDistribution";
import { PositionBar } from "@/components/charts/PositionBar";
import { DailySales } from "@/components/charts/DailySales";
import { FlipChart } from "@/components/charts/FlipChart";
import { AuthorityHistory } from "@/components/charts/AuthorityHistory";
import { Arrow, Eyebrow, GradeTag, LogoMark, cx } from "@/components/ui/primitives";

interface Turn {
  question: string;
  askedAt: string;
}

/** The first question of the session carries the time it was asked on the synthetic day. */
const OPENING_AT = `${world.today}T10:04:00`;

export function AskView() {
  const params = useSearchParams();
  const q = params.get("q")?.trim() || null;

  const decisions = useOracleStore((s) => s.decisions);
  const circuit = useOracleStore((s) => s.circuit);
  const authority = useAuthorityLevel("1842");
  const ctx = useMemo<AskContext>(() => ({ actionFor: (id) => selectDecision({ decisions }, id), circuit, authorityLevel: authority.level }), [decisions, circuit, authority.level]);

  const [turns, setTurns] = useState<Turn[]>(() => [{ question: q ?? DEFAULT_QUESTION, askedAt: OPENING_AT }]);
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState("");
  const [seenQ, setSeenQ] = useState(q);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusNext = useRef(false);

  // A new ?q= from elsewhere (a link into Ask) becomes the next question in the thread.
  if (q !== seenQ) {
    setSeenQ(q);
    if (q && q !== turns[active]?.question) {
      setTurns((t) => [...t, { question: q, askedAt: nowOnWorldDay(world.today) }]);
      setActive(turns.length);
    }
  }

  // Answers are recomputed from live records, so an approval or a circuit change elsewhere updates them.
  const answer = useMemo(() => ask(turns[active].question, ctx, turns[active].askedAt), [turns, active, ctx]);

  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  }, [active, turns]);

  const submit = (question: string) => {
    const text = question.trim();
    if (!text) return;
    focusNext.current = true;
    setTurns((t) => [...t, { question: text, askedAt: nowOnWorldDay(world.today) }]);
    setActive(turns.length);
    setDraft("");
    const url = `/ask?q=${encodeURIComponent(text)}`;
    window.history.replaceState(null, "", url);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) {
      inputRef.current?.focus();
      return;
    }
    submit(draft);
  };

  const earlier = turns.map((t, i) => ({ ...t, i })).filter((t) => t.i !== active).reverse();

  return (
    <div className="grid grid-cols-1 gap-x-[84px] gap-y-14 pt-12 pb-4 lg:grid-cols-[minmax(0,820px)_minmax(280px,344px)] lg:justify-between lg:pt-14">
      <section key={`${active}-${turns[active].question}`} aria-live="polite" aria-labelledby="ask-question" className="fade-in min-w-0">
        <Eyebrow as="p">
          You asked · {clock(answer.askedAt)}
          {answer.about ? ` · About decision #${answer.about}` : ""}
        </Eyebrow>
        <h1 id="ask-question" ref={headingRef} tabIndex={-1} className="mt-6 text-[clamp(38px,4.4vw,63px)] leading-[0.98] font-medium tracking-[-0.05em] outline-none">
          <Question text={answer.question} />
        </h1>

        <div className="mt-9 flex items-center justify-between border-b border-ink pb-3">
          <span className="flex items-center gap-3">
            <LogoMark size={16} stroke={1.2} />
            <span className="font-mono text-[11px] font-semibold tracking-[0.3em]">ORACLE</span>
            <span className="font-mono text-[10.5px] tracking-[0.16em] text-muted uppercase">
              · {answer.sources.length ? (
                <>
                  <span className="max-sm:hidden">Grounded in </span>
                  {answer.sources.length} records
                </>
              ) : (
                "No matching record"
              )}
            </span>
          </span>
          <span className="font-mono text-[10.5px] tracking-[0.16em] whitespace-nowrap text-muted uppercase">Read-only</span>
        </div>

        <Answer answer={answer} />

        {answer.followUps.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {answer.followUps.map((f) =>
              f.href ? (
                <Link key={f.label} href={f.href} className="inline-flex min-h-[46px] items-center gap-2.5 border border-rule px-4 text-[14px] transition-colors hover:border-ink">
                  {f.label}
                  <Arrow size={11} />
                </Link>
              ) : (
                <button key={f.label} type="button" onClick={() => submit(f.question!)} className="inline-flex min-h-[46px] items-center border border-rule px-4 text-left text-[14px] transition-colors hover:border-ink">
                  {f.label}
                </button>
              ),
            )}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 flex h-[60px] items-center gap-3 border border-ink bg-paper pr-2 pl-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink" role="search">
          <label htmlFor="ask-input" className="sr-only">
            Ask ORACLE a question
          </label>
          <input
            id="ask-input"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about a decision, a SKU or the evidence"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <span className="hidden font-mono text-[10px] tracking-[0.2em] text-muted uppercase sm:inline">Answers from records only</span>
          <button type="submit" aria-label="Ask" aria-disabled={!draft.trim()} className="grid h-11 w-11 shrink-0 place-items-center bg-ink text-ground transition-colors hover:bg-ink2">
            <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
              <path d="M6 13 V1.5 M1.5 5.5 L6 1 L10.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </form>
      </section>

      <aside aria-label="Sources and limits" className="min-w-0 lg:pt-2">
        <Eyebrow as="h2">Sources</Eyebrow>
        {answer.sources.length ? (
          <ol className="mt-3 border-t border-ink">
            {answer.sources.map((s, i) => (
              <SourceRow key={s.id} source={s} n={i + 1} />
            ))}
          </ol>
        ) : (
          <p className="mt-3 border-t border-b border-ink py-5 text-[14px] text-muted">No record matched this question, so nothing is cited.</p>
        )}

        <div className="mt-9 bg-stone px-[22px] py-[22px]">
          <Eyebrow as="h2" tone="ink" className="!text-[10px]">
            What this agent cannot do
          </Eyebrow>
          <p className="mt-3 text-[14px] leading-[1.55] text-ink2">It answers only from records and the ledger. It cannot place, change or approve an order — that stays with you.</p>
        </div>
        {answer.intent !== "none" && <p className="serif mt-8 text-[30px] leading-none">No record, no answer.</p>}

        {earlier.length > 0 && (
          <div className="mt-12">
            <Eyebrow as="h2">Earlier in this session</Eyebrow>
            <ul className="mt-3 border-t border-hairline">
              {earlier.map((t) => (
                <li key={t.i} className="border-b border-hairline">
                  <button
                    type="button"
                    onClick={() => {
                      focusNext.current = true;
                      setActive(t.i);
                      window.history.replaceState(null, "", `/ask?q=${encodeURIComponent(t.question)}`);
                    }}
                    className="flex w-full items-baseline gap-4 py-3 text-left text-[14px] text-ink2 transition-colors hover:text-ink"
                  >
                    <span className="font-mono text-[10.5px] text-muted">{clock(t.askedAt)}</span>
                    <span className="flex-1">{t.question}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12 hidden lg:block">
          <Eyebrow as="h2">You can ask</Eyebrow>
          <ul className="mt-3 flex flex-col gap-2.5">
            {SUGGESTIONS.filter((s) => s.question !== answer.question && !answer.followUps.some((f) => f.label === s.label))
              .slice(0, 4)
              .map((s) => (
                <li key={s.label}>
                  <button type="button" onClick={() => submit(s.question)} className="text-left text-[14px] text-ink2 underline-offset-4 hover:text-ink hover:underline">
                    {s.question}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

/** The question in editorial type: the part that carries the number turns to the serif. */
function Question({ text: raw }: { text: string }) {
  const text = raw.charAt(0).toUpperCase() + raw.slice(1);
  const words = text.split(/\s+/);
  let at = words.findIndex((w) => /\d/.test(w));
  if (at < 1) at = Math.max(1, words.length - 2);
  if (words.length < 3) return <>{text}</>;
  return (
    <>
      {words.slice(0, at).join(" ")}{" "}
      <span className="serif block text-[1.28em] leading-[0.95] tracking-[-0.03em]">{words.slice(at).join(" ")}</span>
    </>
  );
}

function Answer({ answer }: { answer: AskAnswer }) {
  // consecutive figures share one row
  const groups: (AskBlock | AskBlock[])[] = [];
  for (const b of answer.blocks) {
    const last = groups[groups.length - 1];
    if (b.type === "figure" && Array.isArray(last)) last.push(b);
    else groups.push(b.type === "figure" ? [b] : b);
  }
  return (
    <div className="mt-7 flex flex-col gap-5">
      {groups.map((g, i) =>
        Array.isArray(g) ? (
          <Figures key={i} blocks={g as Extract<AskBlock, { type: "figure" }>[]} />
        ) : (
          <Block key={i} block={g} sources={answer.sources} />
        ),
      )}
    </div>
  );
}

function Block({ block, sources }: { block: AskBlock; sources: AskSource[] }) {
  switch (block.type) {
    case "text":
      return <p className={cx("max-w-[820px] text-[clamp(17px,1.35vw,19.5px)] leading-[1.55] tracking-[-0.005em]", block.tone === "secondary" ? "text-ink2" : "text-ink")}>{rich(block.text, sources)}</p>;
    case "refusal":
      return <p className="serif text-[clamp(34px,3.4vw,46px)] leading-[1.05] text-ink">{block.text}</p>;
    case "equation":
      return (
        <div role="math" aria-label={`${block.parts.map((p) => `${p.value} ${p.label}`).join(" minus ")} equals ${block.result.value} ${block.result.label}`} className="flex flex-wrap items-start gap-x-2 gap-y-3 border-y border-hairline py-3.5 sm:gap-x-3.5">
          {block.parts.map((p, i) => (
            <Fragment key={p.label}>
              {i > 0 && <Op>−</Op>}
              <Term value={p.value} label={p.label} />
            </Fragment>
          ))}
          <Op>=</Op>
          <Term value={block.result.value} label={block.result.label} decision />
        </div>
      );
    default:
      return null;
  }
}

function Op({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="text-[18px] leading-none font-light text-muted sm:text-[22px]">
      {children}
    </span>
  );
}

function Term({ value, label, decision }: { value: string; label: string; decision?: boolean }) {
  return (
    <span aria-hidden="true" className="flex flex-col gap-2">
      <span className="relative self-start text-[20px] leading-none font-medium tracking-[-0.03em] tabular sm:text-[24px]">
        {value}
        {decision && <span className="absolute inset-x-0 -bottom-[4px] h-[3px] bg-gold" />}
      </span>
      <span className="font-mono text-[9px] tracking-[0.08em] whitespace-nowrap text-muted uppercase sm:text-[10px] sm:tracking-[0.16em]">{label}</span>
    </span>
  );
}

/** **strong**, ==decision==, [[source]] */
function rich(text: string, sources: AskSource[]): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|==[^=]+==|\[\[[a-z-]+\]\])/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("==")) return <mark key={i} className="bg-gold-tint px-[3px] font-semibold text-ink">{part.slice(2, -2)}</mark>;
    if (part.startsWith("[[")) {
      const id = part.slice(2, -2);
      const n = sources.findIndex((s) => s.id === id) + 1;
      if (!n) return null;
      return (
        <a key={i} href={`#source-${n}`} aria-label={`Source ${n}: ${sources[n - 1].title}`} className="mx-[3px] inline-flex h-[17px] min-w-[15px] items-center justify-center border border-ink px-[3px] align-[2px] font-mono text-[10px] leading-none text-ink transition-colors hover:bg-ink hover:text-ground">
          {n}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function SourceRow({ source, n }: { source: AskSource; n: number }) {
  return (
    <li id={`source-${n}`} className="scroll-mt-24 border-b border-hairline transition-colors target:bg-paper">
      <Link href={source.href} className="group grid grid-cols-[34px_1fr_auto] items-start gap-x-1 py-5 pr-1">
        <span className="pt-[5px] font-mono text-[11px] text-muted">{String(n).padStart(2, "0")}</span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-2.5 text-[16px] font-medium tracking-[-0.01em]">
            {source.title}
            {source.grade && <GradeTag grade={source.grade} size={9} />}
          </span>
          <span className="text-[13px] text-muted">{source.detail}</span>
        </span>
        <Arrow size={11} className="mt-[7px] transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

const COLS: Record<number, string> = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

function Figures({ blocks }: { blocks: Extract<AskBlock, { type: "figure" }>[] }) {
  return (
    <div className={cx("mt-5 grid grid-cols-1 gap-x-10 gap-y-8 border-t border-hairline pt-5", COLS[Math.min(3, blocks.length)])}>
      {blocks.map((b) => (
        <FigureCell key={b.figure} block={b} wide={blocks.length === 1} />
      ))}
    </div>
  );
}

function FigureCell({ block, wide }: { block: Extract<AskBlock, { type: "figure" }>; wide: boolean }) {
  const bundle = decisionBundle("18513")!;
  const { decision: d, forecast: f, policy } = bundle;
  const level = useAuthorityLevel("1842").level;
  let eyebrow = "";
  let figure: ReactNode = null;
  let caption = "";
  switch (block.figure) {
    case "distribution": {
      eyebrow = `Demand · next ${f.horizonDays} days`;
      figure = <DemandDistribution p10={f.p10} p50={f.p50} p90={f.p90} target={d.targetPosition} width={230} />;
      caption = `Target ${d.targetPosition} covers ${Math.round((1 - stockoutRisk(policy, d.recommendedOrder)) * 100)}% of outcomes.`;
      break;
    }
    case "position": {
      eyebrow = "Position after this order";
      figure = <PositionBar onHand={d.onHand} onOrder={d.onOrder} order={d.recommendedOrder} p50={f.p50} width={212} />;
      caption = `The fallback of ${d.fallbackOrder} stops at ${Math.round(position(policy, d.fallbackOrder))}.`;
      break;
    }
    case "sales": {
      eyebrow = `Daily sales · ${f.history.length} days`;
      figure = <DailySales days={f.history} width={228} />;
      caption = "Dashed: sold out, demand not seen.";
      break;
    }
    case "flip": {
      const extra = block.lead ?? stressData.initial.leadTime.value;
      const state = { ...stressData.initial, leadTime: { on: true, value: extra } };
      const curve = flipCurve(policy, state, d.recommendedOrder, bundle.product.leadTimeDays);
      eyebrow = "Best order by lead time";
      figure = <FlipChart curve={curve} />;
      caption = curve.flipLead ? `${d.recommendedOrder} holds up to ${curve.flipLead.toFixed(1)} days of lead time. At ${curve.current.lead} days the best order is ${curve.current.order}.` : `${d.recommendedOrder} holds across the range tested.`;
      break;
    }
    case "authority": {
      const rec = getAuthority("1842")!;
      eyebrow = `Authority · ${rec.history.length} weeks`;
      figure = <AuthorityHistory history={rec.history} now={level} />;
      caption = "Promotion takes a full window of good evidence. Demotion is immediate.";
      break;
    }
  }
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <Eyebrow className="!text-[10px]">{eyebrow}</Eyebrow>
      <div className={cx("pt-1", wide && "max-w-[620px]")}>{figure}</div>
      <figcaption className="text-[13px] leading-snug text-ink2">{caption}</figcaption>
    </figure>
  );
}
