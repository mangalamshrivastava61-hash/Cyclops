import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { Folio } from "./Folio";
import { cx } from "@/components/ui/primitives";

/** Product page frame: slim header, a 1440 editorial canvas with 96px margins, and the folio. */
export function PageShell({ section, n, children, className }: { section: string; n: number; children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader section={section} />
      <main id="main" className={cx("settle relative mx-auto w-full max-w-[1440px] flex-1 px-6 pb-12 md:px-12 lg:px-16 xl:px-24", className)}>
        {children}
      </main>
      <Folio n={n} />
    </div>
  );
}
