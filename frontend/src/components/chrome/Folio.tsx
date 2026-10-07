import Link from "next/link";
import { PAGES } from "@/lib/pages";

/** Editorial page folio: where you are, and the next page. Doubles as the product's navigation. */
export function Folio({ n }: { n: number }) {
  // n = 0: a page outside the sequence (not found) — the folio points back to the start
  const page = PAGES[n - 1];
  const prev = n ? PAGES[(n + PAGES.length - 2) % PAGES.length] : PAGES[0];
  const next = n ? PAGES[n % PAGES.length] : PAGES[1];
  return (
    <footer className="mx-auto w-full max-w-[1440px] px-6 md:px-12">
      <div className="flex flex-col gap-3 border-t border-hairline py-4 sm:h-[52px] sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <span className="eyebrow !text-[10.5px] !tracking-[0.16em]">
          {page ? `${String(page.n).padStart(2, "0")} / ${String(PAGES.length).padStart(2, "0")} — ${page.name}` : "Outside the index"}
        </span>
        <span className="eyebrow hidden !text-[10.5px] !tracking-[0.16em] md:inline">Simulated data · Synthetic Store 03</span>
        <nav aria-label="Pages" className="flex gap-7 text-[12px]">
          <Link href={prev.href} className="text-ink2 hover:text-gold-deep">
            ← {prev.name}
          </Link>
          <Link href={next.href} className="hover:text-gold-deep">
            {next.name} →
          </Link>
        </nav>
      </div>
    </footer>
  );
}
