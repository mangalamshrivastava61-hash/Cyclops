"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark, cx } from "@/components/ui/primitives";
import { PAGES } from "@/lib/pages";
import { useOracleStore } from "@/lib/store/oracle-store";
import { world } from "@/lib/services/repository";
import { UserProfileMenu } from "@/components/auth/UserProfileMenu";

/** The only chrome: logo, the section name, and three quiet utilities. */
export function AppHeader({ section }: { section: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const onAsk = pathname.startsWith("/ask");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/ask");
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      <header className="relative z-40 mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="ORACLE home" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-[13px] font-semibold tracking-[0.34em]">ORACLE</span>
          </Link>
          <span aria-hidden="true" className="h-3.5 w-px bg-rule" />
          <span className="text-[13px] text-ink2">{section}</span>
        </div>
        <nav aria-label="Utility" className="flex items-center gap-5 text-[13px] md:gap-7">
          <span className="hidden text-muted lg:inline">
            {world.store} · Week {world.week}
          </span>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="oracle-index" className="py-1 hover:text-gold-deep">
            Index
          </button>
          <Link href="/ml-forecast" aria-current={pathname.startsWith("/ml-forecast") ? "page" : undefined} className={cx("hidden py-1 sm:inline", pathname.startsWith("/ml-forecast") && "border-b border-ink font-semibold text-amber-900")}>
            Forecast Studio
          </Link>
          <Link href="/data" aria-current={pathname.startsWith("/data") ? "page" : undefined} className={cx("hidden py-1 sm:inline", pathname.startsWith("/data") && "border-b border-ink font-medium")}>
            Data
          </Link>
          <Link href="/history" aria-current={pathname.startsWith("/history") ? "page" : undefined} className={cx("hidden py-1 sm:inline", pathname.startsWith("/history") && "border-b border-ink font-medium")}>
            History
          </Link>
          <Link href="/ask" aria-current={onAsk ? "page" : undefined} className={cx("hidden items-center gap-2 py-1 sm:flex", onAsk && "border-b border-ink font-medium")}>
            Ask ORACLE <span className="font-mono text-[11px] text-muted">⌘K</span>
          </Link>
          <UserProfileMenu />
        </nav>
      </header>
      {open && <IndexPanel onClose={() => setOpen(false)} current={pathname} />}
    </>
  );
}

function IndexPanel({ onClose, current }: { onClose: () => void; current: string }) {
  const reset = useOracleStore((s) => s.reset);
  const [resetDone, setResetDone] = useState(false);
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div id="oracle-index" role="dialog" aria-modal="true" aria-label="Index" className="fade-in fixed inset-0 z-30 bg-ground/95 backdrop-blur-[2px]" onClick={onClose}>
      <div className="mx-auto max-w-[1440px] px-6 pt-24 md:px-24" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-10 md:grid-cols-[1fr_320px]">
          <ol className="border-t border-ink">
            {PAGES.map((p, i) => {
              const active = p.href === "/" ? current === "/" : current.startsWith(p.href.split("/").slice(0, 2).join("/"));
              return (
                <li key={p.href} className="border-b border-hairline">
                  <Link ref={i === 0 ? first : undefined} href={p.href} onClick={onClose} aria-current={active ? "page" : undefined} className="group grid grid-cols-[56px_1fr_auto] items-baseline py-3.5">
                    <span className="font-mono text-[11px] text-muted">{String(p.n).padStart(2, "0")}</span>
                    <span className={cx("text-[28px] font-medium tracking-[-0.03em] transition-colors group-hover:text-gold-deep md:text-[34px]", active && "serif !font-normal")}>{p.name}</span>
                    {active && <span className="eyebrow">You are here</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-col gap-4 text-[14px] text-ink2">
            <span className="eyebrow">Simulated data · Synthetic Store 03</span>
            <p className="leading-relaxed">Every figure in ORACLE comes from a synthetic store. Approvals, overrides and circuit simulations are kept in this browser only.</p>
            <button
              type="button"
              onClick={() => {
                reset();
                setResetDone(true);
              }}
              className="self-start border-b border-ink pb-0.5 hover:text-gold-deep"
            >
              {resetDone ? "Simulation reset" : "Reset the simulation"}
            </button>
            <button type="button" onClick={onClose} className="mt-6 self-start font-mono text-[11px] tracking-[0.16em] text-muted uppercase">
              Close · Esc
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
