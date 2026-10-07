import * as XLSX from "xlsx";

export interface DataPoint {
  date: string;
  sales: number;
  isForecast: boolean;
  inventory?: number;
  lowerBound?: number;
  upperBound?: number;
  revenue?: number;
}

export interface ProductSummary {
  productId: string;
  productName: string;
  category: string;
  unitPrice: number;
  historicalTotalSales: number;
  historicalAvgMonthly: number;
  projectedSales: number;
  projectedRevenue: number;
  currentStock: number;
  stockoutDate: string | null;
  daysUntilStockout: number | null;
  recommendedOrder: number;
  stockHealth: "healthy" | "reorder" | "critical";
}

export interface ForecastDataset {
  fileName: string;
  totalRows: number;
  products: string[];
  categories: string[];
  historicalPoints: DataPoint[];
  forecastPoints: DataPoint[];
  combinedPoints: DataPoint[];
  productSummaries: ProductSummary[];
  overallProjectedSales: number;
  overallProjectedRevenue: number;
  overallHistoricalSales: number;
  initialStock: number;
  stockoutDate: string | null;
  daysUntilStockout: number | null;
  recommendedOrder: number;
  stockHealth: "healthy" | "reorder" | "critical";
  executiveSummary: string;
}

/** Parse an uploaded File (CSV or Excel) into clean structured rows */
export async function parseFileToRawRows(file: File): Promise<any[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  
  if (extension === "xlsx" || extension === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return json;
  }

  // Fallback to text parsing (CSV / TSV)
  const text = await file.text();
  const workbook = XLSX.read(text, { type: "string" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

/** Normalize messy column headers */
export function normalizeRawRow(row: Record<string, any>, index: number): {
  date: string;
  productId: string;
  productName: string;
  category: string;
  unitsSold: number;
  inventory?: number;
  price: number;
} {
  const keys = Object.keys(row);
  const findValue = (aliases: string[]) => {
    for (const key of keys) {
      const cleanKey = key.toLowerCase().replace(/[\s_-]+/g, "").trim();
      if (aliases.includes(cleanKey)) return row[key];
    }
    return undefined;
  };

  const rawDate = findValue(["date", "orderdate", "salesdate", "period", "day", "time", "timestamp", "transactiondate"]);
  const rawSales = findValue(["sales", "unitssold", "units", "quantity", "qty", "demand", "volume", "sold", "unitdemand"]);
  const rawInventory = findValue(["inventory", "stock", "onhand", "stockonhand", "currentstock", "inventorylevel", "qtyonhand"]);
  const rawPrice = findValue(["price", "unitprice", "retailprice", "cost", "mrp", "rate"]);
  const rawProdId = findValue(["productid", "sku", "itemid", "code", "barcode", "upc", "id"]);
  const rawProdName = findValue(["productname", "product", "itemname", "item", "description", "title", "name"]);
  const rawCategory = findValue(["category", "department", "type", "group", "class"]);

  // Format date
  let dateStr = "";
  if (rawDate instanceof Date) {
    dateStr = rawDate.toISOString().slice(0, 10);
  } else if (rawDate) {
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      dateStr = parsed.toISOString().slice(0, 10);
    } else {
      dateStr = String(rawDate).trim();
    }
  }
  if (!dateStr) {
    // Generate sequential fallback date
    const d = new Date(2024, 0, 1);
    d.setDate(d.getDate() + index);
    dateStr = d.toISOString().slice(0, 10);
  }

  const unitsSold = Math.max(0, Number(rawSales) || 0);
  const inventory = rawInventory !== undefined && rawInventory !== "" ? Math.max(0, Number(rawInventory)) : undefined;
  const price = Number(rawPrice) > 0 ? Number(rawPrice) : 49.99;
  const productId = String(rawProdId || (rawProdName ? `P${String(index + 1).padStart(3, "0")}` : "SKU-001")).trim();
  const productName = String(rawProdName || productId).trim();
  const category = String(rawCategory || "General").trim();

  return {
    date: dateStr,
    productId,
    productName,
    category,
    unitsSold,
    inventory,
    price,
  };
}

/** Compute projections for 1 month, 3 months, 6 months, or 1 year (12 months) */
export function generateProjections(
  normalizedRows: ReturnType<typeof normalizeRawRow>[],
  fileName: string,
  horizonMonths: number = 1,
  overrideStock?: number,
  serviceLevelZ: number = 1.645 // 95% default
): ForecastDataset {
  if (normalizedRows.length === 0) {
    return {
      fileName,
      totalRows: 0,
      products: [],
      categories: [],
      historicalPoints: [],
      forecastPoints: [],
      combinedPoints: [],
      productSummaries: [],
      overallProjectedSales: 0,
      overallProjectedRevenue: 0,
      overallHistoricalSales: 0,
      initialStock: 0,
      stockoutDate: null,
      daysUntilStockout: null,
      recommendedOrder: 0,
      stockHealth: "healthy",
      executiveSummary: "No data available.",
    };
  }

  // Sort rows chronologically
  const sorted = [...normalizedRows].sort((a, b) => a.date.localeCompare(b.date));

  // Aggregate by month or date
  // Group historical data by month (YYYY-MM)
  const monthlyHistMap: Record<string, { date: string; sales: number; revenue: number; inventory: number }> = {};
  
  sorted.forEach((row) => {
    const monthKey = row.date.slice(0, 7); // "YYYY-MM"
    if (!monthlyHistMap[monthKey]) {
      monthlyHistMap[monthKey] = {
        date: `${monthKey}-01`,
        sales: 0,
        revenue: 0,
        inventory: row.inventory ?? 0,
      };
    }
    monthlyHistMap[monthKey].sales += row.unitsSold;
    monthlyHistMap[monthKey].revenue += row.unitsSold * row.price;
    if (row.inventory !== undefined) {
      monthlyHistMap[monthKey].inventory = row.inventory;
    }
  });

  const historicalMonths = Object.keys(monthlyHistMap).sort();
  const historicalPoints: DataPoint[] = historicalMonths.map((m) => ({
    date: monthlyHistMap[m].date,
    sales: Math.round(monthlyHistMap[m].sales),
    isForecast: false,
    inventory: monthlyHistMap[m].inventory > 0 ? monthlyHistMap[m].inventory : undefined,
    revenue: Math.round(monthlyHistMap[m].revenue),
  }));

  const overallHistoricalSales = historicalPoints.reduce((acc, p) => acc + p.sales, 0);

  // Recent sales run-rate analysis
  const recentPoints = historicalPoints.slice(-6);
  const avgMonthlySales = recentPoints.length > 0 
    ? recentPoints.reduce((acc, p) => acc + p.sales, 0) / recentPoints.length 
    : 100;
  
  // Calculate historical variance / standard deviation
  const variances = recentPoints.map((p) => Math.pow(p.sales - avgMonthlySales, 2));
  const stdDevMonthly = Math.sqrt(variances.reduce((a, b) => a + b, 0) / Math.max(1, variances.length));

  // Determine trend factor (linear slope of recent sales)
  let trendSlope = 0;
  if (recentPoints.length >= 2) {
    const first = recentPoints[0].sales;
    const last = recentPoints[recentPoints.length - 1].sales;
    trendSlope = (last - first) / (recentPoints.length - 1);
  }

  // Initial Inventory Determination
  const latestRowWithInv = sorted.slice().reverse().find((r) => r.inventory !== undefined);
  let startingStock = overrideStock !== undefined 
    ? overrideStock 
    : (latestRowWithInv?.inventory ?? Math.round(avgMonthlySales * 1.4));

  // Determine forecast start date (1 month after last historical date)
  const lastHistDateStr = historicalPoints[historicalPoints.length - 1]?.date || "2024-12-01";
  const lastHistDate = new Date(lastHistDateStr);

  const forecastPoints: DataPoint[] = [];
  let remainingInventory = startingStock;
  let stockoutDate: string | null = null;
  let daysUntilStockout: number | null = null;

  const avgUnitPrice = sorted.reduce((acc, r) => acc + r.price, 0) / sorted.length;

  for (let m = 1; m <= horizonMonths; m++) {
    const fDate = new Date(lastHistDate);
    fDate.setMonth(fDate.getMonth() + m);
    const dateStr = fDate.toISOString().slice(0, 10);

    // Seasonality adjustment (e.g. holiday bump in Nov/Dec, summer in July)
    const monthNum = fDate.getMonth() + 1;
    let seasonalMultiplier = 1.0;
    if (monthNum === 11 || monthNum === 12) seasonalMultiplier = 1.22; // Q4 peak
    else if (monthNum === 7 || monthNum === 8) seasonalMultiplier = 1.08; // Summer
    else if (monthNum === 1 || monthNum === 2) seasonalMultiplier = 0.92; // Post-holiday dip

    // Projection calculation with trend dampening
    const projectedSales = Math.max(
      10,
      Math.round((avgMonthlySales + trendSlope * m * 0.3) * seasonalMultiplier)
    );

    // Confidence bounds (+/- 1.645 * stdDev)
    const margin = Math.round(Math.max(15, stdDevMonthly * 1.35 * Math.sqrt(m * 0.5 + 0.5)));
    const lowerBound = Math.max(0, projectedSales - margin);
    const upperBound = projectedSales + margin;

    // Inventory burn-down
    remainingInventory = remainingInventory - projectedSales;
    const invAtMonthEnd = Math.max(0, remainingInventory);

    if (remainingInventory <= 0 && stockoutDate === null) {
      stockoutDate = dateStr;
      daysUntilStockout = Math.max(1, Math.round(m * 30 * (invAtMonthEnd / (projectedSales || 1))));
    }

    forecastPoints.push({
      date: dateStr,
      sales: projectedSales,
      isForecast: true,
      inventory: invAtMonthEnd,
      lowerBound,
      upperBound,
      revenue: Math.round(projectedSales * avgUnitPrice),
    });
  }

  const combinedPoints: DataPoint[] = [...historicalPoints, ...forecastPoints];
  const overallProjectedSales = forecastPoints.reduce((acc, p) => acc + p.sales, 0);
  const overallProjectedRevenue = forecastPoints.reduce((acc, p) => acc + (p.revenue || 0), 0);

  // Recommended Order: Target = Projected Demand + Safety Stock - Starting Stock
  const safetyStock = Math.round(serviceLevelZ * stdDevMonthly * Math.sqrt(horizonMonths * 0.7));
  const recommendedOrder = Math.max(0, overallProjectedSales + safetyStock - startingStock);

  // Health assessment
  const daysCoverage = avgMonthlySales > 0 ? (startingStock / avgMonthlySales) * 30 : 60;
  let stockHealth: "healthy" | "reorder" | "critical" = "healthy";
  if (daysCoverage < 15 || remainingInventory <= 0) {
    stockHealth = "critical";
  } else if (daysCoverage < 40) {
    stockHealth = "reorder";
  }

  // Group products by unique SKU / ID first, falling back to productName
  const productKeyMap = new Map<string, { productId: string; productName: string; category: string }>();
  sorted.forEach((r) => {
    const key = (r.productId && r.productId.trim()) || (r.productName && r.productName.trim()) || "UNKNOWN";
    if (!productKeyMap.has(key)) {
      productKeyMap.set(key, {
        productId: (r.productId && r.productId.trim()) || key,
        productName: (r.productName && r.productName.trim()) || key,
        category: (r.category && r.category.trim()) || "General",
      });
    }
  });

  const uniqueProductKeys = Array.from(productKeyMap.keys());
  const products = uniqueProductKeys.map((k) => productKeyMap.get(k)!.productName);
  const categories = Array.from(new Set(Array.from(productKeyMap.values()).map((v) => v.category)));

  // Product breakdown calculation
  const productSummaries: ProductSummary[] = uniqueProductKeys.map((prodKey, keyIdx) => {
    const meta = productKeyMap.get(prodKey)!;
    const prodRows = sorted.filter((r) => {
      const rowKey = (r.productId && r.productId.trim()) || (r.productName && r.productName.trim()) || "UNKNOWN";
      return rowKey === prodKey;
    });

    const prodPrice = prodRows[0]?.price || avgUnitPrice;
    const prodHistTotal = prodRows.reduce((a, b) => a + b.unitsSold, 0);
    const prodAvgMonthly = prodHistTotal / Math.max(1, historicalPoints.length);

    // Approximate product-level forecast based on product's share
    const share = overallHistoricalSales > 0 ? prodHistTotal / overallHistoricalSales : 1 / Math.max(1, uniqueProductKeys.length);
    const prodProjected = Math.round(overallProjectedSales * share);
    const prodRevenue = Math.round(prodProjected * prodPrice);

    const latestInv = prodRows.slice().reverse().find((r) => r.inventory !== undefined);
    const prodCurrentStock = latestInv?.inventory ?? Math.round(prodAvgMonthly * 1.3);

    const prodRemaining = prodCurrentStock - prodProjected;
    const prodDaysCov = prodAvgMonthly > 0 ? (prodCurrentStock / prodAvgMonthly) * 30 : 45;
    
    let prodHealth: "healthy" | "reorder" | "critical" = "healthy";
    if (prodDaysCov < 15 || prodRemaining <= 0) prodHealth = "critical";
    else if (prodDaysCov < 40) prodHealth = "reorder";

    const prodRecOrder = Math.max(0, Math.round(prodProjected * 1.15 - prodCurrentStock));

    return {
      productId: meta.productId || `SKU-${keyIdx + 1}`,
      productName: meta.productName,
      category: meta.category,
      unitPrice: prodPrice,
      historicalTotalSales: prodHistTotal,
      historicalAvgMonthly: Math.round(prodAvgMonthly),
      projectedSales: prodProjected,
      projectedRevenue: prodRevenue,
      currentStock: prodCurrentStock,
      stockoutDate: prodRemaining <= 0 ? forecastPoints[Math.min(forecastPoints.length - 1, Math.max(0, Math.floor((prodCurrentStock / (prodProjected || 1)) * horizonMonths)))]?.date || null : null,
      daysUntilStockout: prodRemaining <= 0 ? Math.round(prodDaysCov) : null,
      recommendedOrder: prodRecOrder,
      stockHealth: prodHealth,
    };
  });

  // Plain-English narrative for humans
  const horizonText = horizonMonths === 1 ? "1 month (30 days)" : horizonMonths === 12 ? "1 year (12 months)" : `${horizonMonths} months`;
  const growthRate = historicalPoints.length >= 2 
    ? ((overallProjectedSales / horizonMonths - avgMonthlySales) / Math.max(1, avgMonthlySales)) * 100 
    : 0;
  const growthSign = growthRate >= 0 ? "+" : "";

  let executiveSummary = `Over the next ${horizonText}, demand is projected to reach ${overallProjectedSales.toLocaleString()} units ($${overallProjectedRevenue.toLocaleString()} revenue), representing a ${growthSign}${growthRate.toFixed(1)}% run-rate trend. `;

  if (stockHealth === "critical") {
    executiveSummary += `⚠️ Critical Stockout Alert: Your starting stock of ${startingStock.toLocaleString()} units will deplete in approximately ${Math.round(daysCoverage)} days (around ${stockoutDate || "soon"}). An urgent replenishment order of ${recommendedOrder.toLocaleString()} units is recommended.`;
  } else if (stockHealth === "reorder") {
    executiveSummary += `⚡ Reorder Recommended: Your inventory covers approximately ${Math.round(daysCoverage)} days. To maintain target 95% service level without stockout, place an order for ${recommendedOrder.toLocaleString()} units.`;
  } else {
    executiveSummary += `✅ Healthy Inventory: On-hand stock of ${startingStock.toLocaleString()} units provides ${Math.round(daysCoverage)} days of sales coverage. Operations are well-buffered against near-term demand fluctuations.`;
  }

  return {
    fileName,
    totalRows: normalizedRows.length,
    products,
    categories,
    historicalPoints,
    forecastPoints,
    combinedPoints,
    productSummaries,
    overallProjectedSales,
    overallProjectedRevenue,
    overallHistoricalSales,
    initialStock: startingStock,
    stockoutDate,
    daysUntilStockout,
    recommendedOrder,
    stockHealth,
    executiveSummary,
  };
}

/** Pre-packaged footwear sample dataset for 1-click test */
export function getSampleFootwearData(): ReturnType<typeof normalizeRawRow>[] {
  const dates = [
    "2023-01-01", "2023-02-01", "2023-03-01", "2023-04-01", "2023-05-01", "2023-06-01",
    "2023-07-01", "2023-08-01", "2023-09-01", "2023-10-01", "2023-11-01", "2023-12-01",
    "2024-01-01", "2024-02-01", "2024-03-01", "2024-04-01", "2024-05-01", "2024-06-01",
    "2024-07-01", "2024-08-01", "2024-09-01", "2024-10-01", "2024-11-01", "2024-12-01",
  ];

  const items = [
    { id: "SKU-18513", name: "Aero Runner 01", category: "Performance Running", price: 129.99, base: 220, stock: 450 },
    { id: "SKU-18509", name: "Trail Master Pro", category: "Outdoor Trail", price: 159.99, base: 140, stock: 210 },
    { id: "SKU-18420", name: "Urban Strider Low", category: "Lifestyle Casual", price: 99.99, base: 310, stock: 520 },
    { id: "SKU-18330", name: "Court Classic Retro", category: "Tennis & Court", price: 89.99, base: 180, stock: 320 },
  ];

  const rows: ReturnType<typeof normalizeRawRow>[] = [];
  dates.forEach((d, dIdx) => {
    const month = parseInt(d.slice(5, 7), 10);
    const season = (month === 11 || month === 12) ? 1.35 : (month === 7 || month === 8) ? 1.15 : 1.0;
    const growth = 1 + (dIdx * 0.015);

    items.forEach((item) => {
      const noise = (Math.sin(dIdx + item.base) * 0.15) + 1;
      const sales = Math.round(item.base * season * growth * noise);
      const inv = Math.max(40, Math.round(item.stock - (dIdx % 3) * 35));
      rows.push({
        date: d,
        productId: item.id,
        productName: item.name,
        category: item.category,
        unitsSold: sales,
        inventory: inv,
        price: item.price,
      });
    });
  });

  return rows;
}
