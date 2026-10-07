import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { AskView } from "@/components/ask/AskView";

export const metadata: Metadata = { title: "Ask" };

export default function AskPage() {
  return (
    <PageShell section="Ask ORACLE" n={10}>
      <Suspense>
        <AskView />
      </Suspense>
    </PageShell>
  );
}
