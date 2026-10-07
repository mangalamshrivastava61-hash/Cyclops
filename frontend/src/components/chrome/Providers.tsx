"use client";

import { useEffect } from "react";
import { useOracleStore } from "@/lib/store/oracle-store";

/** Rehydrates the persisted demo state after the first client render, so server and client HTML match. */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useOracleStore.persist.rehydrate();
  }, []);
  return <>{children}</>;
}
