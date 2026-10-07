import type { LedgerEntry, ReceiptLine } from "@/types";
import type { DecisionAction } from "@/lib/store/oracle-store";
import { decisionBundle, getCircuit, levels, world } from "@/lib/services/repository";
import { clock, dayLabel, money, shortDate, signedMoney } from "@/lib/format";
import { contributionFor, position, stockoutRisk } from "@/lib/model/policy";

export interface Receipt {
  groups: ReceiptLine[][];
  authority?: { label: string; kind: "review" | "act" | "advisory" | "bench" };
}

/** Receipt lines for a ledger entry. Decision entries are rebuilt from the record and what the planner did. */
export function receiptFor(entry: LedgerEntry, action: DecisionAction | undefined): Receipt {
  if (!entry.decisionId || !action) return { groups: entry.receipt ?? [] };
  const b = decisionBundle(entry.decisionId);
  if (!b) return { groups: entry.receipt ?? [] };
  const { decision: d, product: p, forecast: f, evidence: e, policy } = b;
  if (d.action === "markdown") {
    return {
      groups: [
        [
          { label: "SKU", value: `${p.sku} · ${p.name}` },
          { label: "Action", value: "Markdown 20% (advice)", emphasis: "decision" },
          { label: "On hand", value: `${d.onHand} units · ${f.coverDaysNow} days cover` },
          { label: "Demand · 14 d", value: `${f.p10} · ${f.p50} · ${f.p90}` },
        ],
        [
          { label: "Evidence", value: e ? gradeSummary(e.grades.map((g) => g.grade)) : "—" },
          { label: "Authority", value: "L1 · Advisory" },
          { label: "Acknowledged", value: action.status === "approved" ? `${action.by ?? world.planner} · ${action.at ? clock(action.at) : ""}` : "Not yet" },
        ],
      ],
      authority: { label: "L1 · Advisory", kind: "advisory" },
    };
  }
  const benched = d.circuit === "bench";
  const qty = action.status === "rejected" || benched ? d.fallbackOrder : action.quantity;
  const pos = Math.round(position(policy, qty));
  const risk = stockoutRisk(policy, qty);
  const contribution = contributionFor(policy, qty, { order: d.recommendedOrder, contribution: d.expectedContribution });
  const lvl = benched ? 1 : d.authority;
  const levelDef = levels.find((l) => l.level === lvl)!;
  const approved =
    action.status === "approved"
      ? `${action.by ?? world.planner} · ${action.at ? clock(action.at) : ""}`
      : action.status === "modified"
        ? `${action.by ?? world.planner} · modified ${action.at ? clock(action.at) : ""}`
        : action.status === "rejected"
          ? `Rejected · ${action.at ? clock(action.at) : ""}`
          : "Awaiting review";
  const actionLine =
    d.action === "none" && qty === 0
      ? "No order"
      : benched
        ? `Fallback orders ${qty} units`
        : action.status === "rejected"
          ? `Fallback orders ${qty} units`
          : action.status === "modified"
            ? `Order ${qty} units (ORACLE ${d.recommendedOrder})`
            : `Order ${qty} units`;
  return {
    groups: [
      [
        { label: "SKU", value: `${p.sku} · ${p.name}` },
        { label: "Action", value: actionLine, emphasis: "decision" },
        { label: "Arrives", value: `${dayLabel(d.arrival)} · ${p.leadTimeDays}-day lead` },
        { label: "Fallback", value: `${d.fallbackOrder} units` },
        { label: `Demand · ${f.horizonDays} d`, value: `${f.p10} · ${f.p50} · ${f.p90}` },
        { label: "Position", value: `${d.onHand} + ${d.onOrder} + ${qty} = ${pos}` },
        { label: "Stockout risk", value: `${Math.round(risk * 100)}%` },
        { label: "Contribution", value: `${money(contribution)} ${qty === d.recommendedOrder ? `${signedMoney(d.contributionVsFallback)} vs fallback` : `${signedMoney(contribution - d.expectedContribution)} vs ORACLE`}` },
      ],
      [
        { label: "Evidence", value: e ? gradeSummary(e.grades.map((g) => g.grade)) : "4 pass" },
        { label: "Authority", value: `L${lvl} ${levelDef.short}` },
        { label: "Circuit", value: benched ? "Bench · in-stock gate" : `Clear since ${shortDate(getCircuit().since)}` },
        { label: "Approval", value: approved, emphasis: action.status === "pending" ? undefined : "strong" },
      ],
    ],
    authority: { label: `L${lvl} · ${levelDef.short}`, kind: benched ? "bench" : lvl <= 1 ? "advisory" : lvl === 2 ? "review" : "act" },
  };
}

function gradeSummary(grades: string[]) {
  const c = (g: string) => grades.filter((x) => x === g).length;
  return [c("pass") && `${c("pass")} pass`, c("partial") && `${c("partial")} partial`, c("insufficient") && `${c("insufficient")} insufficient`, c("failed") && `${c("failed")} failed`].filter(Boolean).join(" · ");
}
