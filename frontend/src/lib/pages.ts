/** The product's pages in reading order. The folio and the Index use this list. */
export const PAGES = [
  { n: 1, name: "Landing", href: "/" },
  { n: 2, name: "Control Center", href: "/control" },
  { n: 3, name: "SKU Decision", href: "/decision/18513" },
  { n: 4, name: "Time Machine", href: "/time-machine" },
  { n: 5, name: "Break My Plan", href: "/break-my-plan/18513" },
  { n: 6, name: "Evidence", href: "/evidence/18513" },
  { n: 7, name: "Decision Circuit", href: "/circuit" },
  { n: 8, name: "Authority", href: "/authority/1842" },
  { n: 9, name: "Decision Ledger", href: "/ledger" },
  { n: 10, name: "Ask ORACLE", href: "/ask" },
  { n: 11, name: "Data Studio", href: "/data" },
  { n: 12, name: "ML Demand Forecast", href: "/ml-forecast" },
  { n: 13, name: "History", href: "/history" },
] as const;

export type PageNumber = (typeof PAGES)[number]["n"];
