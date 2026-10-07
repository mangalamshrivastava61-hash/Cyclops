import { PageShell } from "@/components/chrome/PageShell";
import { PrimaryLink, Serif } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <PageShell section="Not found" n={0}>
      <div className="flex flex-col items-start pt-24 pb-24">
        <p className="eyebrow">404 · No record</p>
        <h1 className="mt-6 font-medium tracking-[-0.05em] text-[clamp(48px,6vw,84px)] leading-[0.98]">
          Nothing here.
          <Serif className="block leading-[1.02] tracking-normal">No record, no page.</Serif>
        </h1>
        <p className="mt-8 max-w-[440px] text-[16px] leading-relaxed text-ink2">This address matches no decision, SKU or record in the simulated store.</p>
        <PrimaryLink href="/control" className="mt-10">
          Open the Control Center
        </PrimaryLink>
      </div>
    </PageShell>
  );
}
