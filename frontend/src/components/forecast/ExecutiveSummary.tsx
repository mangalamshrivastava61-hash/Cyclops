"use client";

import { ForecastDataset } from "@/lib/forecasting";
import { AlertTriangle, CheckCircle2, Clock, DollarSign, Package, TrendingUp } from "lucide-react";

interface Props {
  dataset: ForecastDataset;
  horizonMonths: number;
}

export function ExecutiveSummary({ dataset, horizonMonths }: Props) {
  const horizonLabel =
    horizonMonths === 1
      ? "1 Month (30 Days)"
      : horizonMonths === 3
      ? "3 Months (Quarter)"
      : horizonMonths === 6
      ? "6 Months (Half Year)"
      : "1 Year (12 Months)";

  const isCritical = dataset.stockHealth === "critical";
  const isReorder = dataset.stockHealth === "reorder";

  return (
    <div className="space-y-6">
      {/* 1. Human-Readable Executive Insight Banner */}
      <div
        className={`rounded-sm border p-5 transition-all ${
          isCritical
            ? "border-rose-300 bg-rose-50/70 text-rose-950"
            : isReorder
            ? "border-amber-300 bg-amber-50/70 text-amber-950"
            : "border-emerald-300 bg-emerald-50/70 text-emerald-950"
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 shrink-0">
            {isCritical ? (
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            ) : isReorder ? (
              <Clock className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
                {isCritical ? "Action Required · Critical Stockout Horizon" : isReorder ? "Advisory · Reorder Window Approaching" : "Operational Status · Healthy Inventory Buffer"}
              </span>
              <span className="text-muted text-[11px]">· {horizonLabel} Horizon</span>
            </div>
            <p className="text-[14px] leading-relaxed font-sans font-medium">
              {dataset.executiveSummary}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Four Aesthetic KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Historical Sales Run-Rate */}
        <div className="rounded-sm border border-hairline bg-surface p-5 shadow-xs hover:border-ink2/30 transition-colors">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-mono uppercase tracking-wider">
              Historical Sales
            </span>
            <TrendingUp className="h-4 w-4 text-ink" />
          </div>
          <div className="mt-3">
            <div className="text-[28px] font-semibold tracking-tight text-ink font-sans">
              {dataset.overallHistoricalSales.toLocaleString()}
              <span className="text-[13px] font-normal text-muted ml-1">units</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
              <span>{dataset.historicalPoints.length} observed months</span>
              <span className="font-mono font-medium">
                ~{Math.round(dataset.overallHistoricalSales / Math.max(1, dataset.historicalPoints.length)).toLocaleString()}/mo
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Projected Demand & Revenue */}
        <div className="rounded-sm border border-hairline bg-surface p-5 shadow-xs hover:border-ink2/30 transition-colors">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-mono uppercase tracking-wider">
              Projected Demand ({horizonMonths === 1 ? "1M" : horizonMonths === 12 ? "1Y" : `${horizonMonths}M`})
            </span>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <div className="text-[28px] font-semibold tracking-tight text-ink font-sans">
              {dataset.overallProjectedSales.toLocaleString()}
              <span className="text-[13px] font-normal text-muted ml-1">units</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
              <span>Gross Revenue:</span>
              <span className="font-mono font-semibold text-emerald-700">
                ${Math.round(dataset.overallProjectedRevenue).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Inventory Runway & Health */}
        <div className="rounded-sm border border-hairline bg-surface p-5 shadow-xs hover:border-ink2/30 transition-colors">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-mono uppercase tracking-wider">
              Inventory Runway
            </span>
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[28px] font-semibold tracking-tight text-ink font-sans">
                {dataset.initialStock.toLocaleString()}
                <span className="text-[13px] font-normal text-muted ml-1">on hand</span>
              </span>
              <span
                className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-xs border ${
                  isCritical
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : isReorder
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                }`}
              >
                {dataset.stockHealth}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
              <span>Depletion Horizon:</span>
              <span className={`font-mono font-medium ${isCritical ? "text-rose-600 font-bold" : "text-ink"}`}>
                {dataset.stockoutDate ? dataset.stockoutDate : "Safe throughout horizon"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Recommended Reorder Quantity */}
        <div className="rounded-sm border border-hairline bg-surface p-5 shadow-xs hover:border-ink2/30 transition-colors">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-mono uppercase tracking-wider">
              Recommended Order
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-xs bg-ground text-muted border border-hairline">
              95% Service
            </span>
          </div>
          <div className="mt-3">
            <div className="text-[28px] font-semibold tracking-tight text-amber-700 font-sans">
              {dataset.recommendedOrder > 0 ? (
                <>
                  +{dataset.recommendedOrder.toLocaleString()}
                  <span className="text-[13px] font-normal text-muted ml-1">units</span>
                </>
              ) : (
                <span className="text-emerald-700 text-[24px]">0 (Stock Adequate)</span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
              <span>Lead Time Buffer:</span>
              <span className="font-mono text-ink">Newsvendor Policy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
