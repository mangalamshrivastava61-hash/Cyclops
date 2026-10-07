import Link from "next/link";
import { LogoMark } from "@/components/ui/primitives";

const NAV = [
  { label: "Platform", href: "/control" },
  { label: "Data Studio", href: "/data" },
  { label: "ML Forecast", href: "/ml-forecast" },
  { label: "Intelligence", href: "/ask" },
  { label: "Time Machine", href: "/time-machine" },
  { label: "Evidence", href: "/evidence/18513" },
  { label: "About", href: "/about" },
];

export function LandingHeader() {
  return (
    <header className="mx-auto flex h-[88px] w-full max-w-[1440px] items-center justify-between px-6 md:px-12 lg:px-16 xl:px-24">
      <Link href="/" aria-label="ORACLE home" className="flex items-center gap-3">
        <LogoMark size={24} />
        <span className="text-[14px] font-semibold tracking-[0.34em]">ORACLE</span>
      </Link>
      <nav aria-label="Primary" className="hidden gap-10 text-[14px] text-ink2 md:flex">
        {NAV.map((n) => (
          <Link key={n.label} href={n.href} className="transition-colors hover:text-gold-deep">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
