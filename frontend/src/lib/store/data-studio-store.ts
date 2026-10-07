"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const DATA_FIELDS = ["date", "sku", "demand", "inventory", "onOrderInventory", "price", "promotion", "leadTime", "productName"] as const;
export type DataField = (typeof DATA_FIELDS)[number];
export type DatasetRow = Record<DataField, string> & { id: string };

export const fieldLabels: Record<DataField, string> = {
  date: "Date", sku: "SKU", demand: "Demand / Sales", inventory: "Inventory",
  onOrderInventory: "On-order Inventory", price: "Price", promotion: "Promotion", leadTime: "Lead Time",
  productName: "Product Name",
};

export const blankRow = (): DatasetRow => ({ id: crypto.randomUUID(), date: "", sku: "", demand: "", inventory: "", onOrderInventory: "", price: "", promotion: "", leadTime: "", productName: "" });

interface DataStudioState {
  rows: DatasetRow[];
  filename?: string;
  source?: "upload" | "manual";
  activeDataset?: { rows: number; filename: string };
  setDataset: (rows: DatasetRow[], filename: string, source: "upload" | "manual") => void;
  updateRow: (id: string, field: DataField, value: string) => void;
  addRow: () => void;
  deleteRow: (id: string) => void;
  clear: () => void;
  useDataset: () => void;
}

/** Browser-local staging area for Data Studio. Replace this boundary with an API call when persistence is introduced. */
export const useDataStudioStore = create<DataStudioState>()(
  persist(
    (set, get) => ({
      rows: [],
      setDataset: (rows, filename, source) => set({ rows, filename, source }),
      updateRow: (id, field, value) => set((state) => ({ rows: state.rows.map((row) => row.id === id ? { ...row, [field]: value } : row) })),
      addRow: () => set((state) => ({ rows: [...state.rows, blankRow()] })),
      deleteRow: (id) => set((state) => ({ rows: state.rows.filter((row) => row.id !== id) })),
      clear: () => set({ rows: [], filename: undefined, source: undefined, activeDataset: undefined }),
      useDataset: () => set({ activeDataset: { rows: get().rows.length, filename: get().filename ?? "manual-entry" } }),
    }),
    { name: "oracle-data-studio-v1", storage: createJSONStorage(() => localStorage) },
  ),
);
