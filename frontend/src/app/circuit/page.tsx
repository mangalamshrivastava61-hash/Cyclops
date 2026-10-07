import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { CircuitView } from "@/components/circuit/CircuitView";
import { api } from "@/lib/services/api";

export const metadata: Metadata = { title: "Decision Circuit" };

export default async function CircuitPage() {
  const circuit = await api.circuit();
  return (
    <PageShell section="Decision Circuit" n={7}>
      <CircuitView circuit={circuit} />
    </PageShell>
  );
}
