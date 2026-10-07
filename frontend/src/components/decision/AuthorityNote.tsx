"use client";

import { useEffect, useRef, useState } from "react";
import { Chip, TextLink } from "@/components/ui/primitives";
import { getAuthority } from "@/lib/services/repository";

/** The authority chip is a button: it explains why a person has to decide. */
export function AuthorityNote({ label, kind, reason, sku, decisionId, hasEvidence }: { label: string; kind: "review" | "act" | "advisory" | "bench"; reason: string; sku: string; decisionId: string; hasEvidence: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded-[2px]" aria-label={`${label}: why`}>
        <Chip kind={kind}>{label}</Chip>
      </button>
      {open && (
        <div role="dialog" aria-label="Why a person decides" className="fade-in absolute right-0 bottom-full z-20 mb-3 w-[320px] border border-ink bg-paper p-5 text-[14px] leading-relaxed shadow-[0_14px_30px_-18px_rgba(18,17,15,0.35)]">
          <span className="eyebrow !text-[10px]">Authority</span>
          <p className="mt-2 text-ink2">{reason}</p>
          <div className="mt-4 flex flex-col gap-2 text-[13px]">
            {hasEvidence && <TextLink href={`/evidence/${decisionId}`} arrow>See the evidence</TextLink>}
            <TextLink href={getAuthority(sku) ? `/authority/${sku}` : "/authority/1842"} arrow>How authority is earned</TextLink>
          </div>
        </div>
      )}
    </div>
  );
}
