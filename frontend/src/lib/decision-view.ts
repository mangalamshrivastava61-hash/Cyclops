import type { DecisionAction } from "@/lib/store/oracle-store";
import type { Decision } from "@/types";
import { clock, reasonLabel } from "@/lib/format";

/** How a decision reads right now, given what the planner has done. Shared by every page. */
export function describeDecision(decision: Decision, action: DecisionAction, planner: string) {
  const qty = action.quantity;
  const statusLine =
    action.status === "approved"
      ? `Approved ${action.at ? clock(action.at) : ""} by ${action.by ?? planner}`
      : action.status === "modified"
        ? `Modified to ${qty} · ${action.reason ? reasonLabel(action.reason).toLowerCase() : "planner override"}`
        : action.status === "rejected"
          ? `Rejected · the fallback rule orders ${decision.fallbackOrder}`
          : "Waiting for your review";
  return {
    quantity: qty,
    isFallback: action.status === "rejected",
    changed: action.status === "modified" && qty !== decision.recommendedOrder,
    statusLine,
    settled: action.status !== "pending",
  };
}
