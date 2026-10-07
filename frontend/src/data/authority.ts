import type { AuthorityLevelDef, AuthorityRecord } from "@/types";

export const authorityLevels: AuthorityLevelDef[] = [
  { level: 0, short: "Manual", plain: "You decide alone.", detail: "ORACLE is off for this SKU. Orders come from the planner or the fallback rule." },
  { level: 1, short: "Advisory", plain: "Suggests. You decide.", detail: "ORACLE shows its recommendation and the evidence. Nothing happens unless you place the order." },
  { level: 2, short: "Human review", plain: "Proposes. You approve.", detail: "ORACLE's order is the default. It waits for a planner to approve, modify or reject it." },
  { level: 3, short: "Limited autonomy", plain: "Acts on routine orders.", detail: "Routine orders inside the evidence band go through on their own. You are told, and can reverse within the day." },
  { level: 4, short: "Higher autonomy", plain: "Acts. You review weekly.", detail: "ORACLE places orders across the SKU and you review a weekly digest. Exceptions still wait for you." },
];

/** Authority over the last 26 weeks (simulated). Week 26 is now. */
const history: AuthorityRecord["history"] = [
  ...[1, 2, 3, 4].map((week) => ({ week, level: 1 as const })),
  ...[5, 6, 7, 8, 9, 10].map((week) => ({ week, level: 2 as const, note: week === 5 ? "Promoted" : undefined })),
  ...[11, 12, 13, 14, 15].map((week) => ({ week, level: 3 as const, note: week === 11 ? "Limited autonomy" : undefined })),
  ...[16, 17, 18, 19, 20].map((week) => ({ week, level: 1 as const, note: week === 16 ? "Benched · in-stock gate" : undefined })),
  ...[21, 22, 23].map((week) => ({ week, level: 2 as const, note: week === 21 ? "Re-earned" : undefined })),
  { week: 24, level: 3, note: "Limited autonomy" },
  { week: 25, level: 3 },
  { week: 26, level: 2, note: "Observability partial" },
];

export const authorityRecords: AuthorityRecord[] = [
  {
    sku: "1842",
    earnedLevel: 2,
    realWorldStart: 1,
    levels: authorityLevels,
    history,
    earn: {
      headline: "Eight steady weeks of good evidence.",
      detail: "Next step, L3, needs hidden demand under 5%. It is 11% now.",
      requirement: "Hidden demand under 5% for 8 weeks",
      metric: 0.11,
      threshold: 0.05,
    },
    lose: {
      headline: "At once, when any warning trips.",
      detail: "It happened in week 16, when the in-stock gate tripped.",
    },
  },
];
