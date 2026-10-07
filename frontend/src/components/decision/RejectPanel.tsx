"use client";

import { useState } from "react";
import { SecondaryButton, cx } from "@/components/ui/primitives";

const REASONS = ["Too high for this week", "Too low for this week", "Data looks wrong", "Other"];

export function RejectPanel({ fallback, onConfirm, onCancel }: { fallback: number; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  return (
    <section aria-label="Reject the order" className="fade-in mt-6 border border-rule bg-paper p-6">
      <span className="eyebrow">Reject · the fallback rule will order {fallback}</span>
      <div className="mt-3 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={cx("h-9 rounded-[2px] border px-3 text-[13px] transition-colors", reason === r ? "border-ink bg-ink text-ground" : "border-rule hover:border-ink")}>
            {r}
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onConfirm(reason)} className="inline-flex h-12 items-center rounded-[2px] border border-oxblood px-[22px] text-[14px] text-oxblood transition-colors hover:bg-oxblood hover:text-ground">
          Reject and use {fallback}
        </button>
        <SecondaryButton onClick={onCancel}>Keep reviewing</SecondaryButton>
      </div>
    </section>
  );
}
