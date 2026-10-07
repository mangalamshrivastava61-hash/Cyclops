"use client";

import Link from "next/link";
import { useAuthSession } from "@/lib/auth";

export function EnterOracleButton() {
  const { user, loaded } = useAuthSession();

  const href = loaded && user ? "/ml-forecast" : "/login";

  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-sm bg-ink px-6 py-3 text-[13px] font-semibold tracking-wider text-ground transition-all hover:bg-gold-deep hover:text-ink shadow-xs"
    >
      ENTER ORACLE
    </Link>
  );
}
