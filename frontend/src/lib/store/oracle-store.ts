"use client";

/**
 * Client state for what the planner does in this session: approvals, modifications, rejections,
 * circuit simulations and new ledger entries. Persisted to localStorage so every page agrees.
 * Seed records never change; this store only records what happened on top of them (append-only).
 */
import { useMemo } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CircuitState, DecisionStatus, LedgerEntry, LedgerKind, ReceiptLine } from "@/types";
import * as repo from "@/lib/services/repository";
import { nowOnWorldDay, reasonLabel } from "@/lib/format";

export interface DecisionAction {
  status: DecisionStatus;
  quantity: number;
  reason?: string;
  note?: string;
  at?: string;
  by?: string;
}

interface OracleState {
  hydrated: boolean;
  decisions: Record<string, DecisionAction>;
  appended: LedgerEntry[];
  circuit: CircuitState;
  probesPreview: boolean;
  approve: (id: string) => LedgerEntry;
  reject: (id: string, reason: string) => LedgerEntry;
  modify: (id: string, quantity: number, reason: string, note: string) => LedgerEntry;
  setCircuit: (state: CircuitState) => void;
  logNote: (input: { kind?: LedgerKind; eyebrow: string; title: string; meta: string; sku?: string; decisionId?: string; receipt?: ReceiptLine[][] }) => LedgerEntry;
  setProbesPreview: (on: boolean) => void;
  reset: () => void;
}

/** Two FNV-1a passes → "ABCD…EF12", the short form every receipt shows. */
function shortHash(input: string) {
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).toUpperCase().padStart(8, "0");
  };
  return `${fnv(2166136261).slice(0, 4)}…${fnv(0x9e3779b9).slice(-4)}`;
}

function nextEntry(state: OracleState, partial: Omit<LedgerEntry, "id" | "seq" | "hash" | "prevHash" | "at"> & { at?: string }): LedgerEntry {
  const chain = [...repo.listLedgerSeed(), ...state.appended];
  const prev = chain[chain.length - 1];
  const seq = prev.seq + 1;
  const at = partial.at ?? nowOnWorldDay(repo.world.today);
  const body = { ...partial, at, seq, id: String(seq) };
  return { ...body, prevHash: prev.hash, hash: shortHash(`${prev.hash}|${JSON.stringify(body)}`) };
}

const initial = { decisions: {} as Record<string, DecisionAction>, appended: [] as LedgerEntry[], circuit: "clear" as CircuitState, probesPreview: false };

export const useOracleStore = create<OracleState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...initial,

      approve: (id) => {
        const b = repo.decisionBundle(id)!;
        const current = selectDecision(get(), id);
        const entry = nextEntry(get(), {
          kind: "approval",
          sku: b.decision.sku,
          decisionId: id,
          eyebrow: `APPROVAL · SKU ${b.decision.sku} · #${id}`,
          title: `${b.product.name} — ${current.quantity} approved`,
          meta: `Approved by ${repo.world.planner} · sealed to #${id}`,
          chip: { label: "REVIEW · APPROVED", kind: "review" },
        });
        set((s) => ({
          decisions: { ...s.decisions, [id]: { ...current, status: "approved", at: entry.at, by: repo.world.planner } },
          appended: [...s.appended, entry],
        }));
        return entry;
      },

      reject: (id, reason) => {
        const b = repo.decisionBundle(id)!;
        const current = selectDecision(get(), id);
        const entry = nextEntry(get(), {
          kind: "rejection",
          sku: b.decision.sku,
          decisionId: id,
          eyebrow: `REJECTION · SKU ${b.decision.sku} · #${id}`,
          title: `${b.product.name} — ${current.quantity} rejected`,
          meta: `${reason} · the fallback rule orders ${b.decision.fallbackOrder}`,
          chip: { label: "REJECTED", kind: "advisory" },
        });
        set((s) => ({
          decisions: { ...s.decisions, [id]: { status: "rejected", quantity: b.decision.fallbackOrder, reason, at: entry.at, by: repo.world.planner } },
          appended: [...s.appended, entry],
        }));
        return entry;
      },

      modify: (id, quantity, reason, note) => {
        const b = repo.decisionBundle(id)!;
        const entry = nextEntry(get(), {
          kind: "modification",
          sku: b.decision.sku,
          decisionId: id,
          eyebrow: `OVERRIDE · SKU ${b.decision.sku} · ${reasonLabel(reason).toUpperCase()}`,
          title: `${b.product.name} — ${b.decision.recommendedOrder} → ${quantity}`,
          meta: `${repo.world.planner} · scored against ${b.decision.recommendedOrder} after delivery`,
          quote: note || undefined,
          chip: { label: "REVIEW · MODIFIED", kind: "review" },
        });
        set((s) => ({
          decisions: { ...s.decisions, [id]: { status: "modified", quantity, reason, note, at: entry.at, by: repo.world.planner } },
          appended: [...s.appended, entry],
        }));
        return entry;
      },

      setCircuit: (state) => {
        if (state === get().circuit) return;
        set({ circuit: state });
      },

      logNote: (input) => {
        const entry = nextEntry(get(), { kind: input.kind ?? "note", ...input });
        set((s) => ({ appended: [...s.appended, entry] }));
        return entry;
      },

      setProbesPreview: (on) => set({ probesPreview: on }),

      reset: () => set({ ...initial }),
    }),
    {
      name: "oracle-demo-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ decisions: s.decisions, appended: s.appended, circuit: s.circuit, probesPreview: s.probesPreview }),
      onRehydrateStorage: () => () => {
        useOracleStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Seed record merged with anything the planner did. */
export function selectDecision(state: Pick<OracleState, "decisions">, id: string): DecisionAction {
  return state.decisions[id] ?? seedAction(id);
}

function seedAction(id: string): DecisionAction {
  const d = repo.getDecision(id)!;
  const seedMod = repo.getSeedModification(id);
  if (seedMod) return { status: "modified", quantity: seedMod.quantity, reason: seedMod.reason, note: seedMod.note, at: seedMod.at, by: repo.world.planner };
  const approvedAt = d.status === "approved" ? d.createdAt : undefined;
  return { status: d.status, quantity: d.recommendedOrder, at: approvedAt };
}

export const useDecisionAction = (id: string) => {
  const acted = useOracleStore((s) => s.decisions[id]);
  return useMemo(() => acted ?? seedAction(id), [acted, id]);
};

export function effectiveAuthority(state: Pick<OracleState, "circuit" | "probesPreview">, sku: string) {
  const record = repo.getAuthority(sku);
  const earned = record?.earnedLevel ?? 1;
  const preview = state.probesPreview && sku === "1842" ? 3 : earned;
  const cap = repo.getCircuit().states[state.circuit].authorityCap;
  const level = (cap === null ? preview : Math.min(preview, cap)) as 0 | 1 | 2 | 3 | 4;
  return { level, earned, preview: state.probesPreview, cap, circuit: state.circuit };
}

export const useAuthorityLevel = (sku: string) => {
  const circuit = useOracleStore((s) => s.circuit);
  const probesPreview = useOracleStore((s) => s.probesPreview);
  return effectiveAuthority({ circuit, probesPreview }, sku);
};

export const useLedger = () => {
  const appended = useOracleStore((s) => s.appended);
  return useMemo(() => [...repo.listLedgerSeed(), ...appended], [appended]);
};
