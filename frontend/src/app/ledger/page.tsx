import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { LedgerView } from "@/components/ledger/LedgerView";

export const metadata: Metadata = { title: "Decision Ledger" };

export default function LedgerPage() {
  return (
    <PageShell section="Decision Ledger" n={9}>
      <Suspense>
        <LedgerView />
      </Suspense>
    </PageShell>
  );
}
