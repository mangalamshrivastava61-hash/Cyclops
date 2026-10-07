"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { Eyebrow, Serif } from "@/components/ui/primitives";
import { FileUploadZone } from "@/components/forecast/FileUploadZone";
import { SalesInventoryChart } from "@/components/forecast/SalesInventoryChart";
import { ExecutiveSummary } from "@/components/forecast/ExecutiveSummary";
import { StockAdjustmentBar } from "@/components/forecast/StockAdjustmentBar";
import {
  generateProjections,
  getSampleFootwearData,
  normalizeRawRow,
  parseFileToRawRows,
  ForecastDataset,
} from "@/lib/forecasting";
import { api } from "@/lib/services/api";
import { getUserSession } from "@/lib/auth";
import { Calendar, Download, Filter, Search, Sparkles } from "lucide-react";

export default function MLForecastPage() {
  const [horizonMonths, setHorizonMonths] = useState<number>(1);
  const [rawRows, setRawRows] = useState<ReturnType<typeof normalizeRawRow>[]>([]);
  const [fileName, setFileName] = useState<string>("Footwear Sales Sample (Store 03)");
  const [loading, setLoading] = useState<boolean>(true);
  const [overrideStock, setOverrideStock] = useState<number | undefined>(undefined);
  const [serviceLevelZ, setServiceLevelZ] = useState<number>(1.645);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [backendModelName, setBackendModelName] = useState<string>("Gradient Boosting (best_sales_model.pkl)");

  // Initial load: load footwear sample or fetch backend history
  useEffect(() => {
    async function init() {
      setLoading(true);

      // Check if dataset was loaded from User Profile
      if (typeof window !== "undefined") {
        try {
          const imported = window.sessionStorage.getItem("oracle-imported-dataset");
          if (imported) {
            const parsed = JSON.parse(imported);
            if (parsed.rows && Array.isArray(parsed.rows)) {
              setRawRows(parsed.rows);
              setFileName(parsed.filename || "Imported Dataset");
              window.sessionStorage.removeItem("oracle-imported-dataset");
              setLoading(false);
              return;
            }
          }
        } catch {}
      }

      try {
        // Try getting backend model info
        const info = await api.mlModelInfo();
        if (info.model_name) {
          setBackendModelName(`${info.model_name} (${info.model_file || "best_sales_model.pkl"})`);
        }

        // Try getting backend history
        const hist = await api.mlHistory(500);
        if (hist.records && hist.records.length > 0) {
          const mapped = hist.records.map((r, i) =>
            normalizeRawRow(
              {
                date: r.date,
                product_id: r.sku,
                product_name: r.product_name,
                category: r.category || "General",
                units_sold: r.demand,
                inventory: r.inventory,
                price: r.price,
              },
              i
            )
          );
          setRawRows(mapped);
          setFileName(hist.data_source || "sales_data.csv");
          setLoading(false);
          return;
        }
      } catch (e) {
        // Fallback to sample data gracefully
      }

      // Default sample data
      const sample = getSampleFootwearData();
      setRawRows(sample);
      setFileName("Footwear Sales Sample (Store 03)");
      setLoading(false);
    }

    init();
  }, []);

  // Handle file drop/selection (CSV or Excel)
  const handleFileLoaded = async (file: File) => {
    setLoading(true);
    setOverrideStock(undefined);
    try {
      const parsed = await parseFileToRawRows(file);
      const normalized = parsed.map((r, i) => normalizeRawRow(r, i));
      setRawRows(normalized);
      setFileName(file.name);

      // Save to user profile CSV history if logged in
      const sessionUser = getUserSession();
      if (sessionUser?.email) {
        try {
          await api.saveCsvHistory({
            user_email: sessionUser.email,
            filename: file.name,
            rows: normalized.slice(0, 1000),
          });
        } catch {
          // Backend history save is non-blocking
        }
      }

      // Concurrently notify backend if available
      try {
        await api.mlUploadAndPredict(file, horizonMonths);
      } catch {
        // Backend optional
      }
    } catch (err: any) {
      alert(`Error reading file: ${err?.message || "Invalid spreadsheet format"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = () => {
    setLoading(true);
    setOverrideStock(undefined);
    const sample = getSampleFootwearData();
    setRawRows(sample);
    setFileName("Footwear Sales Sample (Store 03)");
    setSelectedCategory("all");
    setSelectedProduct("all");
    setLoading(false);
  };

  // Filter raw rows by product or category before generating projections
  const filteredRawRows = useMemo(() => {
    let rows = rawRows;
    if (selectedCategory !== "all") {
      rows = rows.filter((r) => r.category.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (selectedProduct !== "all") {
      rows = rows.filter((r) => r.productName === selectedProduct);
    }
    return rows;
  }, [rawRows, selectedCategory, selectedProduct]);

  // Compute dataset and projections
  const dataset: ForecastDataset = useMemo(() => {
    return generateProjections(
      filteredRawRows,
      fileName,
      horizonMonths,
      overrideStock,
      serviceLevelZ
    );
  }, [filteredRawRows, fileName, horizonMonths, overrideStock, serviceLevelZ]);

  // Categories and products lists
  const categories = useMemo(() => {
    return Array.from(new Set(rawRows.map((r) => r.category))).filter(Boolean);
  }, [rawRows]);

  const productList = useMemo(() => {
    const subset = selectedCategory === "all" ? rawRows : rawRows.filter((r) => r.category === selectedCategory);
    return Array.from(new Set(subset.map((r) => r.productName))).filter(Boolean);
  }, [rawRows, selectedCategory]);

  // Filtered product breakdown table
  const filteredSummaries = useMemo(() => {
    return dataset.productSummaries.filter((p) => {
      const matchesSearch =
        p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [dataset.productSummaries, searchQuery]);

  // Export forecast to CSV
  const handleExportForecast = () => {
    const headers = "Product ID,Product Name,Category,Unit Price,Historical Avg/mo,Projected Demand,Projected Revenue,Current Stock,Stockout Date,Recommended Order,Stock Health\n";
    const rows = dataset.productSummaries
      .map((p) =>
        [
          `"${p.productId}"`,
          `"${p.productName}"`,
          `"${p.category}"`,
          p.unitPrice.toFixed(2),
          p.historicalAvgMonthly,
          p.projectedSales,
          p.projectedRevenue,
          p.currentStock,
          p.stockoutDate || "None",
          p.recommendedOrder,
          p.stockHealth.toUpperCase(),
        ].join(",")
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `forecast_plan_${horizonMonths}m.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageShell section="Forecast Studio" n={12}>
      <div className="mx-auto max-w-[1440px] px-6 py-8 md:px-12 lg:px-16 space-y-8">
        {/* Header Title & Model Badge */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-hairline pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Eyebrow>Demand Intelligence & Stock Projections</Eyebrow>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted px-2 py-0.5 rounded-xs bg-surface border border-hairline">
                Version 2.4
              </span>
            </div>
            <h1 className="mt-2 text-[32px] font-medium tracking-tight text-ink md:text-[40px] leading-tight">
              Sales Forecast & Inventory Runway
              <Serif className="block text-[28px] md:text-[36px] text-ink2">
                Predict demand, model burn-down, and safeguard replenishment.
              </Serif>
            </h1>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Active Intelligence Core
            </span>
            <div className="flex items-center gap-2 rounded-sm border border-hairline bg-surface px-3 py-1.5 shadow-xs">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="font-mono text-[12px] font-semibold text-ink">
                {backendModelName}
              </span>
            </div>
          </div>
        </div>

        {/* 1. File Upload Dropzone (CSV & Excel) */}
        <FileUploadZone
          onFileLoaded={handleFileLoaded}
          onLoadSample={handleLoadSample}
          fileName={fileName}
          totalRows={rawRows.length}
          loading={loading}
        />

        {/* 2. Interactive Horizon Switcher (1 Month, 3 Months, 6 Months, 1 Year) */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-hairline bg-surface p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-ink font-semibold text-[13px]">
              <Calendar className="h-4 w-4 text-amber-600" />
              <span>Forecast Horizon:</span>
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { label: "1 Month (30d)", months: 1 },
                { label: "3 Months (Quarter)", months: 3 },
                { label: "6 Months (Half Year)", months: 6 },
                { label: "1 Year (Annual)", months: 12 },
              ].map((opt) => (
                <button
                  key={opt.months}
                  type="button"
                  onClick={() => setHorizonMonths(opt.months)}
                  className={`px-3.5 py-1.5 text-[12px] font-mono transition-all rounded-xs border ${
                    horizonMonths === opt.months
                      ? "border-ink bg-ink text-ground font-semibold shadow-xs"
                      : "border-hairline bg-ground text-ink hover:border-ink2"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product & Category Filter Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px] text-muted">
              <Filter className="h-3.5 w-3.5 text-ink" />
              <span>Category:</span>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedProduct("all");
              }}
              className="rounded-xs border border-hairline bg-ground px-2.5 py-1 text-[12px] font-mono text-ink outline-none focus:border-ink"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c, idx) => (
                <option key={`cat-${c}-${idx}`} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="rounded-xs border border-hairline bg-ground px-2.5 py-1 text-[12px] font-mono text-ink outline-none focus:border-ink max-w-[200px] truncate"
            >
              <option value="all">All Products ({productList.length})</option>
              {productList.map((p, idx) => (
                <option key={`prod-${p}-${idx}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Executive Storytelling & Human-Readable Insights */}
        <ExecutiveSummary dataset={dataset} horizonMonths={horizonMonths} />

        {/* 4. Primary Chart: Historical Sales + Prospective Demand + Inventory Burn-Down */}
        <SalesInventoryChart
          points={dataset.combinedPoints}
          initialStock={dataset.initialStock}
          stockoutDate={dataset.stockoutDate}
          height={380}
        />

        {/* 5. Interactive Stock Simulator Bar */}
        <StockAdjustmentBar
          currentStock={dataset.initialStock}
          onStockChange={(newStock) => setOverrideStock(newStock)}
          serviceLevelZ={serviceLevelZ}
          onServiceLevelChange={(z) => setServiceLevelZ(z)}
          onReset={() => {
            setOverrideStock(undefined);
            setServiceLevelZ(1.645);
          }}
        />

        {/* 6. Detailed Product Breakdown & Replenishment Table */}
        <div className="overflow-hidden rounded-sm border border-hairline bg-surface shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline px-6 py-4 bg-ground/30">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">
                Product-Level Projections & Replenishment Plan
              </h2>
              <p className="text-[12px] text-muted">
                Detailed demand expectations and recommended order quantities for each SKU.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search products or SKUs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xs border border-hairline bg-surface pl-8 pr-3 py-1 text-[12px] text-ink placeholder:text-muted focus:border-ink outline-none"
                />
              </div>

              {/* Export Button */}
              <button
                type="button"
                onClick={handleExportForecast}
                className="flex items-center gap-1.5 rounded-xs border border-hairline bg-surface hover:bg-ground px-3 py-1 text-[12px] font-mono font-medium text-ink transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV Plan
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-hairline bg-ground/60 font-mono text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-3">SKU / ID</th>
                  <th className="px-6 py-3">Product Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3 text-right">Price</th>
                  <th className="px-6 py-3 text-right">Past Avg/Mo</th>
                  <th className="px-6 py-3 text-right">
                    Projected Demand ({horizonMonths === 1 ? "1M" : horizonMonths === 12 ? "1Y" : `${horizonMonths}M`})
                  </th>
                  <th className="px-6 py-3 text-right">Est. Revenue</th>
                  <th className="px-6 py-3 text-right">On Hand</th>
                  <th className="px-6 py-3 text-center">Stockout Date</th>
                  <th className="px-6 py-3 text-right">Order Needed</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filteredSummaries.map((p, idx) => (
                  <tr key={`${p.productId}-${p.productName}-${idx}`} className="hover:bg-ground/40 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-[12px] font-semibold text-ink">
                      {p.productId}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-ink">
                      {p.productName}
                    </td>
                    <td className="px-6 py-3.5 text-muted">
                      {p.category}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-muted">
                      ${p.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-muted">
                      {p.historicalAvgMonthly.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-ink">
                      {p.projectedSales.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-emerald-800 font-medium">
                      ${p.projectedRevenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-ink">
                      {p.currentStock.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-center font-mono text-[12px]">
                      {p.stockoutDate ? (
                        <span className="text-rose-600 font-semibold">{p.stockoutDate}</span>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold">
                      {p.recommendedOrder > 0 ? (
                        <span className="text-amber-700">+{p.recommendedOrder.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-700 font-normal">0</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span
                        className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-xs border ${
                          p.stockHealth === "critical"
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : p.stockHealth === "reorder"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {p.stockHealth}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSummaries.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-muted">
                      No matching products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
