"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface RecentCsvState {
  recentCsvName: string | null;
  uploadedAt: string | null;
  setRecentCsv: (name: string) => void;
  clearRecentCsv: () => void;
}

/** Stores only the recently uploaded CSV file name and upload timestamp (no row details). */
export const useRecentCsvStore = create<RecentCsvState>()(
  persist(
    (set) => ({
      recentCsvName: null,
      uploadedAt: null,
      setRecentCsv: (name: string) =>
        set({
          recentCsvName: name,
          uploadedAt: new Date().toISOString(),
        }),
      clearRecentCsv: () =>
        set({
          recentCsvName: null,
          uploadedAt: null,
        }),
    }),
    {
      name: "oracle-recent-csv-name-only",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
