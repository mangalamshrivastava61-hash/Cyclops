/** Small, explicitly synthetic retail observations for the History page. */
export interface RetailHistoryRow {
  date: string;
  sku: string;
  demand: number;
  inventory: number;
  price: number;
  promotion: boolean;
  stockout: boolean;
  productName?: string;
  category?: string;
}

export const retailHistory: RetailHistoryRow[] = [
  { date: "2026-09-26", sku: "1842", demand: 84, inventory: 82, price: 499, promotion: false, stockout: false },
  { date: "2026-09-25", sku: "1842", demand: 79, inventory: 166, price: 499, promotion: false, stockout: false },
  { date: "2026-09-24", sku: "2210", demand: 61, inventory: 84, price: 799, promotion: false, stockout: false },
  { date: "2026-09-23", sku: "2210", demand: 58, inventory: 145, price: 799, promotion: true, stockout: false },
  { date: "2026-09-26", sku: "3021", demand: 43, inventory: 12, price: 349, promotion: false, stockout: false },
  { date: "2026-09-25", sku: "3021", demand: 49, inventory: 0, price: 349, promotion: false, stockout: true },
  { date: "2026-09-25", sku: "0937", demand: 12, inventory: 118, price: 999, promotion: true, stockout: false },
  { date: "2026-09-24", sku: "1555", demand: 36, inventory: 131, price: 649, promotion: false, stockout: false },
];
