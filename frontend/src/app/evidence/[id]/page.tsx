import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/chrome/PageShell";
import { EvidenceView } from "@/components/evidence/EvidenceView";
import { api } from "@/lib/services/api";
import { listEvidence } from "@/lib/services/repository";

export function generateStaticParams() {
  return listEvidence().map((e) => ({ id: e.decisionId }));
}

export const metadata: Metadata = { title: "Evidence" };

export default async function EvidencePage({ params }: PageProps<"/evidence/[id]">) {
  const { id } = await params;
  const report = await api.evidence(id);
  const bundle = await api.decision(id);
  if (!report || !bundle) notFound();
  return (
    <PageShell section="Evidence" n={6}>
      <EvidenceView report={report} product={bundle.product} />
    </PageShell>
  );
}
