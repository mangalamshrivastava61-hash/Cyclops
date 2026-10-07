"use client";

import { useId, useMemo, useState } from "react";
import type { DecisionBundle } from "@/lib/services/repository";
import { contributionFor, position, stockoutRisk } from "@/lib/model/policy";
import { PrimaryButton, SecondaryButton, cx } from "@/components/ui/primitives";
import { money, signedMoney } from "@/lib/format";

const REASONS = [
  { id: "LOCAL_EVENT", label: "Local event" },
  { id: "SUPPLIER", label: "Supplier constraint" },
  { id: "PROMOTION", label: "Promotion" },
  { id: "SPACE", label: "Shelf space" },
  { id: "OTHER", label: "Other" },
];

/** Change the quantity and see, live, what it does to position, risk and contribution. */
export function ModifyPanel({ bundle, initial, onSave, onCancel }: { bundle: DecisionBundle; initial: number; onSave: (qty: number, reason: string, note: string) => void; onCancel: () => void }) {
  const { decision, product, policy } = bundle;
  const [qty, setQty] = useState(initial);
  const [reason, setReason] = useState("LOCAL_EVENT");
  const [note, setNote] = useState("");
  const id = useId();
  const step = product.casePack;
  const rec = decision.recommendedOrder;
  const calc = useMemo(() => {
    const pos = Math.round(position(policy, qty));
    const risk = stockoutRisk(policy, qty);
    const contribution = contributionFor(policy, qty, { order: rec, contribution: decision.expectedContribution });
    return { pos, risk, contribution, vsRec: contribution - decision.expectedContribution };
  }, [policy, qty, rec, decision.expectedContribution]);
  const min = 0;
  const max = Math.max(rec * 2, 60);

  return (
    <section aria-label="Modify the order" className="fade-in mt-6 border border-ink bg-paper p-6">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Modify · ORACLE said {rec}</span>
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">Case pack {step}</span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button type="button" aria-label={`Remove a case of ${step}`} onClick={() => setQty((q) => Math.max(min, q - step))} className="h-11 w-11 rounded-[2px] border border-rule text-[20px] leading-none hover:border-ink">
          −
        </button>
        <label htmlFor={`${id}-qty`} className="sr-only">
          Order quantity
        </label>
        <input
          id={`${id}-qty`}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={qty}
          onChange={(e) => setQty(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
          className="w-[120px] border-b border-ink bg-transparent text-center text-[44px] font-medium tracking-[-0.04em] outline-none tabular"
        />
        <button type="button" aria-label={`Add a case of ${step}`} onClick={() => setQty((q) => Math.min(max, q + step))} className="h-11 w-11 rounded-[2px] border border-rule text-[20px] leading-none hover:border-ink">
          +
        </button>
        <input aria-label="Order quantity slider" type="range" className="oracle-range ml-4 flex-1" min={min} max={max} step={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-hairline pt-4 text-[13px]">
        <div>
          <dt className="eyebrow !text-[10px]">Position</dt>
          <dd className="mt-1 text-[20px] font-medium tracking-[-0.02em] tabular">{calc.pos}</dd>
        </div>
        <div>
          <dt className="eyebrow !text-[10px]">Stockout risk</dt>
          <dd className={cx("mt-1 text-[20px] font-medium tracking-[-0.02em] tabular", calc.risk > 0.3 && "text-oxblood")}>{Math.round(calc.risk * 100)}%</dd>
        </div>
        <div>
          <dt className="eyebrow !text-[10px]">Contribution</dt>
          <dd className="mt-1 text-[20px] font-medium tracking-[-0.02em] tabular">
            {money(calc.contribution)} <span className="text-[12px] font-normal text-muted">{qty === rec ? "as recommended" : `${signedMoney(calc.vsRec)} vs ORACLE`}</span>
          </dd>
        </div>
      </dl>
      <fieldset className="mt-5">
        <legend className="eyebrow !text-[10px]">Reason, recorded in the ledger</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button key={r.id} type="button" aria-pressed={reason === r.id} onClick={() => setReason(r.id)} className={cx("h-9 rounded-[2px] border px-3 text-[13px] transition-colors", reason === r.id ? "border-ink bg-ink text-ground" : "border-rule hover:border-ink")}>
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block">
        <span className="eyebrow !text-[10px]">Note</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="School sports day, Sat 3 Oct." className="mt-1.5 block w-full border-b border-rule bg-transparent py-2 text-[15px] outline-none placeholder:text-muted/70 focus:border-ink" />
      </label>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={() => onSave(qty, reason, note.trim())} disabled={qty === rec}>
          Save {qty} units
        </PrimaryButton>
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        <span className="text-[12px] text-muted">The override is scored against {rec} after delivery.</span>
      </div>
    </section>
  );
}
