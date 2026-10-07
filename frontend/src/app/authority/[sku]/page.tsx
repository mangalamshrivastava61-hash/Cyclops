import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/chrome/PageShell";
import { AuthorityView } from "@/components/authority/AuthorityView";
import { api } from "@/lib/services/api";
import { getProduct, listAuthority } from "@/lib/services/repository";

export function generateStaticParams() {
  return listAuthority().map((a) => ({ sku: a.sku }));
}

export const metadata: Metadata = { title: "Earned Authority" };

export default async function AuthorityPage({ params }: PageProps<"/authority/[sku]">) {
  const { sku } = await params;
  const record = await api.authority(sku);
  const product = getProduct(sku);
  if (!record || !product) notFound();
  return (
    <PageShell section="Authority" n={8}>
      <AuthorityView record={record} product={product} />
    </PageShell>
  );
}
