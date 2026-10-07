import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/chrome/PageShell";
import { BreakMyPlan } from "@/components/break-my-plan/BreakMyPlan";
import { api } from "@/lib/services/api";
import { canStress } from "@/lib/services/repository";

export async function generateStaticParams() {
  return (await api.decisions()).filter((d) => canStress(d.id)).map((d) => ({ id: d.id }));
}

export const metadata: Metadata = { title: "Break My Plan" };

export default async function BreakMyPlanPage({ params }: PageProps<"/break-my-plan/[id]">) {
  const { id } = await params;
  const bundle = await api.decision(id);
  if (!bundle || !canStress(id)) notFound();
  return (
    <PageShell section="Break My Plan" n={5}>
      <BreakMyPlan bundle={bundle} />
    </PageShell>
  );
}
