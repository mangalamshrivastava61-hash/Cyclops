import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/chrome/PageShell";
import { DecisionView } from "@/components/decision/DecisionView";
import { api } from "@/lib/services/api";

export async function generateStaticParams() {
  return (await api.decisions()).map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: PageProps<"/decision/[id]">): Promise<Metadata> {
  const { id } = await params;
  const b = await api.decision(id);
  return { title: b ? `${b.product.name} · #${id}` : "Decision" };
}

export default async function DecisionPage({ params }: PageProps<"/decision/[id]">) {
  const { id } = await params;
  const bundle = await api.decision(id);
  if (!bundle) notFound();
  return (
    <PageShell section="SKU Decision" n={3}>
      <DecisionView bundle={bundle} />
    </PageShell>
  );
}
