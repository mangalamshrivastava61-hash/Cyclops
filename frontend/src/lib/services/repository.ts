/**
 * Synchronous read model over the mock data. This is the only module that imports from src/data.
 * Swap these functions for API calls (see ./api.ts) when a backend exists.
 */
import { products, WORLD } from "@/data/products";
import { forecasts } from "@/data/forecasts";
import { decisions, PRIMARY_DECISION_ID, seedModifications } from "@/data/decisions";
import { evidenceReports } from "@/data/evidence";
import { authorityLevels, authorityRecords } from "@/data/authority";
import { circuit } from "@/data/circuit";
import { ledgerSeed } from "@/data/ledger";
import { replays } from "@/data/replays";
import { initialStress, singleStressPresets, stressControls } from "@/data/scenarios";
import { policyInput } from "@/lib/model/policy";
import { retailHistory } from "@/data/history";

export const world = WORLD;

export const listProducts = () => products;
export const getProduct = (sku: string) => products.find((p) => p.sku === sku);

export const listDecisions = () => decisions;
export const getDecision = (id: string) => decisions.find((d) => d.id === id);
/** Break My Plan applies to live orders; not to markdowns, no-order weeks or benched SKUs. */
export const canStress = (id: string) => {
  const d = getDecision(id);
  return !!d && d.action === "order" && d.circuit !== "bench";
};
export const getPrimaryDecision = () => getDecision(PRIMARY_DECISION_ID)!;
export const decisionForSku = (sku: string) => decisions.find((d) => d.sku === sku);
export const getSeedModification = (id: string) => seedModifications[id];

export const getForecast = (id: string) => forecasts.find((f) => f.id === id);
export const forecastForSku = (sku: string) => forecasts.find((f) => f.sku === sku);

export const getEvidence = (decisionId: string) => evidenceReports.find((e) => e.decisionId === decisionId);
export const listEvidence = () => evidenceReports;

export const getAuthority = (sku: string) => authorityRecords.find((a) => a.sku === sku);
export const listAuthority = () => authorityRecords;
export const levels = authorityLevels;

export const getCircuit = () => circuit;

export const listLedgerSeed = () => ledgerSeed;
export const listRetailHistory = () => retailHistory;
export const getReplay = (id: string) => replays.find((r) => r.id === id);
export const listReplays = () => replays;

export const stress = { controls: stressControls, initial: initialStress, singles: singleStressPresets };

/** Everything a decision page needs, joined. */
export function decisionBundle(id: string) {
  const decision = getDecision(id);
  if (!decision) return undefined;
  const product = getProduct(decision.sku)!;
  const forecast = getForecast(decision.forecastId)!;
  const evidence = getEvidence(decision.id);
  const authority = getAuthority(decision.sku);
  return { decision, product, forecast, evidence, authority, policy: policyInput(decision, forecast, product) };
}
export type DecisionBundle = NonNullable<ReturnType<typeof decisionBundle>>;
