import { blankRow, DatasetRow } from "./store/data-studio-store";
import { RetailHistoryRow } from "@/data/history";

/** Parse raw CSV text, handling quotes, escapes and Windows/Unix line breaks. */
export function parseCsv(input: string): string[][] {
  const clean = input.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
}

export const CSV_ALIASES: Record<string, string> = {
  date: "date",
  order_date: "date",
  "order date": "date",
  transaction_date: "date",
  "transaction date": "date",

  sku: "sku",
  product_id: "sku",
  "product id": "sku",
  productid: "sku",
  item_id: "sku",
  "item id": "sku",
  item: "sku",
  code: "sku",

  product_name: "productName",
  "product name": "productName",
  product: "productName",
  name: "productName",
  item_name: "productName",
  "item name": "productName",
  title: "productName",

  demand: "demand",
  sales: "demand",
  "demand sales": "demand",
  units_sold: "demand",
  "units sold": "demand",
  units: "demand",
  quantity: "demand",
  qty: "demand",
  volume: "demand",

  inventory: "inventory",
  stock: "inventory",
  stock_level: "inventory",
  "stock level": "inventory",
  on_hand: "inventory",
  "on hand": "inventory",
  inventory_level: "inventory",

  on_order_inventory: "onOrderInventory",
  "on order inventory": "onOrderInventory",
  "onorder inventory": "onOrderInventory",
  on_order: "onOrderInventory",
  "on order": "onOrderInventory",

  price: "price",
  unit_price: "price",
  "unit price": "price",
  retail_price: "price",
  "retail price": "price",
  mrp: "price",

  promotion: "promotion",
  promo: "promotion",
  is_promotion: "promotion",
  "is promotion": "promotion",
  discount_pct: "promotion",
  "discount pct": "promotion",
  discount: "promotion",

  lead_time: "leadTime",
  "lead time": "leadTime",
  leadtime: "leadTime",
};

/** Parses raw CSV text into validated DatasetRows with smart column mapping. */
export function parseCsvToDataset(csvText: string): DatasetRow[] {
  const [header = [], ...body] = parseCsv(csvText);
  if (!header.length || !body.length) return [];

  const mapped = header.map((col) => {
    const norm = col.toLowerCase().replace(/[\s_-]+/g, " ").trim();
    return CSV_ALIASES[norm] || CSV_ALIASES[col.toLowerCase().trim()] || null;
  });

  return body.map((values, index) => {
    const row = blankRow();
    mapped.forEach((field, i) => {
      if (field && i < values.length) {
        (row as any)[field] = values[i] ?? "";
      }
    });

    if (!row.sku) {
      row.sku = row.productName ? `P${String(index + 1).padStart(3, "0")}` : `SKU-${index + 1}`;
    }
    if (!row.price) {
      row.price = "499";
    }
    if (!row.inventory && row.demand) {
      const demandNum = Number(row.demand);
      row.inventory = Number.isFinite(demandNum) ? String(Math.max(0, Math.round(demandNum * 1.2))) : "100";
    }
    return row;
  });
}

/** Convert a DatasetRow into a RetailHistoryRow for History page display. */
export function datasetRowToRetailHistory(row: DatasetRow): RetailHistoryRow {
  const demand = Math.round(Number(row.demand)) || 0;
  const inventory = Number(row.inventory) !== undefined && row.inventory !== "" ? Math.round(Number(row.inventory)) : Math.round(demand * 1.2);
  const price = Number(row.price) || 499;
  const promoVal = String(row.promotion || "").toLowerCase().trim();
  const promotion = promoVal === "1" || promoVal === "true" || promoVal === "yes" || (Number(promoVal) > 0);
  const stockout = inventory <= 0 || demand === 0;

  return {
    date: row.date || new Date().toISOString().slice(0, 10),
    sku: row.sku || "UNKNOWN",
    demand,
    inventory,
    price,
    promotion,
    stockout,
    productName: row.productName || undefined,
  };
}
