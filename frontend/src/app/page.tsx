import Link from "next/link";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { OracleView } from "@/components/oracle-object/OracleView";
import { PrimaryLink, Serif } from "@/components/ui/primitives";
import { EnterOracleButton } from "@/components/landing/EnterOracleButton";
import { api } from "@/lib/services/api";

const STATES = [
  { n: "01", name: "Forecast", href: "/ml-forecast", caption: "The layers float apart: the range is open. The gold line is the order.", variant: "forecast" as const, label: "The object with its layers floating slightly apart", fallback: "/renders/objForecast.webp" },
  { n: "02", name: "Stress", href: "/break-my-plan/18513", caption: "The layers shear and the decision line rises, from 127 to 165.", variant: "stress" as const, label: "The object with its layers sheared out of line and the gold line raised", fallback: "/renders/objStress.webp" },
  { n: "03", name: "Circuit", href: "/circuit", caption: "It becomes a selector, set to clear, review or bench.", variant: "circuit" as const, label: "The object as the selector of a machined instrument", fallback: "/renders/objCircuit.webp" },
  { n: "04", name: "Authority", href: "/authority/1842", caption: "Its height is how much ORACLE may do alone. Unearned levels are only drawn.", variant: "authority" as const, label: "The object as a stack of levels, two only drawn in outline", fallback: "/renders/objAuthority.webp" },
];

export default async function Landing() {
  const world = await api.world();
  return (
    <div className="min-h-screen">
      <LandingHeader />
      <main id="main">
        <section aria-labelledby="hero-title" className="relative mx-auto grid max-w-[1440px] grid-cols-1 px-6 pt-10 md:px-12 lg:grid-cols-2 lg:gap-8 lg:px-16 lg:pt-[96px] xl:grid-cols-[minmax(0,720px)_1fr] xl:gap-0 xl:px-24 xl:pt-[112px]">
          <div className="settle relative z-10 flex flex-col">
            <p className="eyebrow !text-[12px]">Decision intelligence for retail</p>
            <h1 id="hero-title" className="mt-8 font-medium tracking-[-0.058em] text-[clamp(64px,7.8vw,112px)] leading-[0.92]">
              See the next
              <br />
              decision
              <Serif className="mt-1 block text-[clamp(66px,8vw,116px)] leading-none tracking-[-0.015em]">before it happens.</Serif>
            </h1>
            <p className="mt-9 max-w-[440px] text-[18px] leading-[1.55] text-ink2">
              ORACLE forecasts demand, recommends the order, tests it against the future, and shows exactly how much evidence stands behind it.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-8">
              <EnterOracleButton />
              <Link href="/time-machine?play=1" className="group inline-flex items-center gap-3 text-[15px] font-medium">
                <svg width="36" height="36" viewBox="0 0 34 34" aria-hidden="true" className="transition-transform duration-300 group-hover:scale-105">
                  <circle cx="17" cy="17" r="16" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M14 11.5 L23 17 L14 22.5 Z" fill="currentColor" />
                </svg>
                Watch a replay
              </Link>
            </div>
          </div>
          <div className="relative mt-10 lg:mt-0">
            <OracleView
              variant="hero"
              label="The ORACLE object: an ivory and black monolith cut by a thin gold decision line, its top layer lifted to reveal a gold ring"
              fallback="/renders/heroSolo.webp"
              className="mx-auto aspect-[1.13] w-full max-w-[640px] xl:absolute xl:-top-[70px] xl:-right-[96px] xl:aspect-auto xl:h-[640px] xl:w-[760px] xl:max-w-none"
            />
            <p className="eyebrow mt-4 !text-[10.5px] !tracking-[0.16em] xl:absolute xl:top-[570px] xl:left-[40px]">Low · expected · high — and one gold line: the decision</p>
          </div>
        </section>

        <section id="about" aria-labelledby="object-title" className="mx-auto mt-28 max-w-[1440px] px-6 md:px-12 lg:mt-[150px] lg:px-16 xl:mt-[190px] xl:px-24">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow !text-[12px]">The ORACLE object</p>
              <h2 id="object-title" className="mt-6 font-medium tracking-[-0.05em] text-[clamp(48px,5.3vw,76px)] leading-[0.96]">
                One object.
                <Serif className="block leading-[1.02]">Four states of a decision.</Serif>
              </h2>
            </div>
            <p className="max-w-[380px] pb-2 text-[16px] leading-[1.6] text-ink2">
              The same object runs through the product. It opens with the forecast, shears under stress, becomes the selector of the circuit and grows only as far as its authority is earned.
            </p>
          </div>

          <ul className="mt-16 grid grid-cols-1 gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {STATES.map((s) => (
              <li key={s.n}>
                <Link href={s.href} className="group flex flex-col">
                  <OracleView variant={s.variant} label={s.label} fallback={s.fallback} view={s.variant === "circuit" ? { fitAspect: 0 } : undefined} className="h-[260px] w-full transition-transform duration-500 ease-[var(--ease-product)] group-hover:-translate-y-1" float={false} />
                  <div className="mt-7 flex items-baseline justify-between border-t border-ink pt-4">
                    <span className="text-[26px] font-medium tracking-[-0.03em] transition-colors group-hover:text-gold-deep">{s.name}</span>
                    <span className="font-mono text-[11px] text-muted">{s.n}</span>
                  </div>
                  <span className="mt-2.5 text-[15px] leading-normal text-ink2">{s.caption}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mx-auto mt-24 max-w-[1440px] px-6 md:px-12 lg:px-16 xl:px-24">
          <div className="flex flex-col justify-between gap-10 border-t border-rule pt-4 lg:flex-row">
            <div aria-hidden="true" className="-ml-3 font-semibold tracking-[-0.05em] text-[clamp(96px,15.3vw,220px)] leading-[0.8]">
              ORACLE
            </div>
            <div className="flex gap-16 pt-4 text-[14px] text-ink2">
              <div className="flex flex-col gap-2.5">
                <span className="eyebrow">Product</span>
                <Link href="/control" className="hover:text-gold-deep">Control Center</Link>
                <Link href="/ledger" className="hover:text-gold-deep">Decision Ledger</Link>
                <Link href="/ask" className="hover:text-gold-deep">Ask ORACLE</Link>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="eyebrow">Project</span>
                <span>Team Cyclops</span>
                <span>Microsoft Innovate 2026</span>
                <span>Designed for Microsoft Fabric</span>
              </div>
            </div>
          </div>
          <p className="eyebrow py-8 !text-[10.5px]">All data simulated · Synthetic {world.store} · 3D rendered in the browser</p>
        </footer>
      </main>
    </div>
  );
}
