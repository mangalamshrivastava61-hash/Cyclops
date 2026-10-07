import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { ControlCenter } from "@/components/control/ControlCenter";
import { api } from "@/lib/services/api";

export const metadata: Metadata = { title: "Control Center" };

export default async function ControlPage() {
  const bundle = await api.primaryDecision();
  const decisions = await api.decisions();
  const products = await api.products();
  const also = decisions
    .filter((d) => d.id !== bundle.decision.id)
    .map((d) => ({ id: d.id, sku: d.sku, name: products.find((p) => p.sku === d.sku)!.name, action: d.action, order: d.recommendedOrder, fallback: d.fallbackOrder, circuit: d.circuit }));
  return (
    <PageShell section="Control Center" n={2}>
      <ControlCenter bundle={bundle} also={also} />
    </PageShell>
  );
}
