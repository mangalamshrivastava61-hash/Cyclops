"use client";

import { useMemo, useState } from "react";
import { DataPoint } from "@/lib/forecasting";

interface Props {
  points: DataPoint[];
  initialStock: number;
  stockoutDate: string | null;
  height?: number;
}

export function SalesInventoryChart({
  points,
  initialStock,
  stockoutDate,
  height = 360,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"combined" | "sales" | "inventory">("combined");

  // Determine scaling
  const {
    maxSales,
    maxInventory,
    xStep,
    svgWidth,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
  } = useMemo(() => {
    const pLeft = 56;
    const pRight = 56;
    const pTop = 32;
    const pBottom = 48;
    const width = 960;

    let sMax = Math.max(...points.map((p) => p.upperBound || p.sales), 100);
    // Add 15% headroom
    sMax = Math.ceil((sMax * 1.15) / 50) * 50;

    let iMax = Math.max(initialStock, ...points.map((p) => p.inventory || 0), 100);
    iMax = Math.ceil((iMax * 1.15) / 100) * 100;

    const availableWidth = width - pLeft - pRight;
    const step = points.length > 1 ? availableWidth / (points.length - 1) : availableWidth;

    return {
      maxSales: sMax,
      maxInventory: iMax,
      xStep: step,
      svgWidth: width,
      paddingLeft: pLeft,
      paddingRight: pRight,
      paddingTop: pTop,
      paddingBottom: pBottom,
    };
  }, [points, initialStock]);

  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => paddingLeft + index * xStep;
  const getYSales = (val: number) => paddingTop + chartHeight - (val / maxSales) * chartHeight;
  const getYInv = (val: number) => paddingTop + chartHeight - (val / maxInventory) * chartHeight;

  // Split historical vs forecast
  const historicalIndices = points
    .map((p, idx) => (!p.isForecast ? idx : null))
    .filter((v): v is number => v !== null);
  const forecastIndices = points
    .map((p, idx) => (p.isForecast ? idx : null))
    .filter((v): v is number => v !== null);

  // Path generators
  const salesHistPath = useMemo(() => {
    if (historicalIndices.length === 0) return "";
    return historicalIndices
      .map((idx, i) => `${i === 0 ? "M" : "L"} ${getX(idx).toFixed(1)} ${getYSales(points[idx].sales).toFixed(1)}`)
      .join(" ");
  }, [historicalIndices, points, xStep, maxSales]);

  const salesHistArea = useMemo(() => {
    if (historicalIndices.length === 0) return "";
    const firstX = getX(historicalIndices[0]);
    const lastX = getX(historicalIndices[historicalIndices.length - 1]);
    const bottomY = paddingTop + chartHeight;
    return `${salesHistPath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [salesHistPath, historicalIndices, chartHeight, paddingTop]);

  const salesForecastPath = useMemo(() => {
    if (forecastIndices.length === 0) return "";
    // Bridge from last historical point if exists
    const startIndex = historicalIndices.length > 0 ? historicalIndices[historicalIndices.length - 1] : forecastIndices[0];
    const pathPoints = [startIndex, ...forecastIndices];
    return pathPoints
      .map((idx, i) => `${i === 0 ? "M" : "L"} ${getX(idx).toFixed(1)} ${getYSales(points[idx].sales).toFixed(1)}`)
      .join(" ");
  }, [forecastIndices, historicalIndices, points, xStep, maxSales]);

  // Confidence Interval Band (Upper & Lower)
  const confidenceBandArea = useMemo(() => {
    if (forecastIndices.length === 0) return "";
    const startIndex = historicalIndices.length > 0 ? historicalIndices[historicalIndices.length - 1] : forecastIndices[0];
    const pathPoints = [startIndex, ...forecastIndices];

    const upper = pathPoints.map((idx, i) => {
      const p = points[idx];
      const y = getYSales(p.upperBound || p.sales);
      return `${i === 0 ? "M" : "L"} ${getX(idx).toFixed(1)} ${y.toFixed(1)}`;
    });

    const lower = [...pathPoints].reverse().map((idx) => {
      const p = points[idx];
      const y = getYSales(p.lowerBound || p.sales);
      return `L ${getX(idx).toFixed(1)} ${y.toFixed(1)}`;
    });

    return `${upper.join(" ")} ${lower.join(" ")} Z`;
  }, [forecastIndices, historicalIndices, points, xStep, maxSales]);

  // Inventory Curve
  const invPath = useMemo(() => {
    const invPoints = points
      .map((p, idx) => (p.inventory !== undefined ? idx : null))
      .filter((v): v is number => v !== null);

    if (invPoints.length === 0) return "";
    return invPoints
      .map((idx, i) => `${i === 0 ? "M" : "L"} ${getX(idx).toFixed(1)} ${getYInv(points[idx].inventory!).toFixed(1)}`)
      .join(" ");
  }, [points, xStep, maxInventory]);

  // Stockout X coordinate
  const stockoutIndex = points.findIndex((p) => p.date === stockoutDate);
  const stockoutX = stockoutIndex >= 0 ? getX(stockoutIndex) : null;

  // Active hover point
  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative w-full rounded-sm border border-hairline bg-surface p-6 shadow-xs select-none">
      {/* Chart Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">
              Sales Velocity & Inventory Trajectory
            </h3>
          </div>
          <p className="mt-1 text-[12px] text-muted font-sans">
            Historical observations paired with prospective demand projection and on-hand stock burn-down.
          </p>
        </div>

        {/* View Switcher & Legends */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-sm border border-hairline bg-ground p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setViewMode("combined")}
              className={`px-2.5 py-1 rounded-xs transition-colors ${
                viewMode === "combined" ? "bg-surface font-semibold text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
            >
              Unified
            </button>
            <button
              type="button"
              onClick={() => setViewMode("sales")}
              className={`px-2.5 py-1 rounded-xs transition-colors ${
                viewMode === "sales" ? "bg-surface font-semibold text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
            >
              Sales Only
            </button>
            <button
              type="button"
              onClick={() => setViewMode("inventory")}
              className={`px-2.5 py-1 rounded-xs transition-colors ${
                viewMode === "inventory" ? "bg-surface font-semibold text-ink shadow-xs" : "text-muted hover:text-ink"
              }`}
            >
              Inventory Runway
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono pl-2 border-l border-hairline text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ink" />
              Past Actuals
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Projected Demand
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Stock Runway
            </span>
          </div>
        </div>
      </div>

      {/* SVG Chart Canvas */}
      <div className="relative mt-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="w-full h-auto overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Sales gradient */}
            <linearGradient id="salesHistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#12110f" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#12110f" stopOpacity="0.00" />
            </linearGradient>

            {/* Forecast Confidence gradient */}
            <linearGradient id="forecastBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, pIdx) => {
            const y = paddingTop + chartHeight * (1 - pct);
            const salesVal = Math.round(maxSales * pct);
            const invVal = Math.round(maxInventory * pct);

            return (
              <g key={`grid-${pct}-${pIdx}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#ddd6c9"
                  strokeWidth="0.75"
                  strokeDasharray="3 3"
                />
                {/* Left Axis: Sales Units */}
                {(viewMode === "combined" || viewMode === "sales") && (
                  <text
                    x={paddingLeft - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fill="#8c8273"
                  >
                    {salesVal}
                  </text>
                )}
                {/* Right Axis: Inventory Units */}
                {(viewMode === "combined" || viewMode === "inventory") && (
                  <text
                    x={svgWidth - paddingRight + 8}
                    y={y + 3.5}
                    textAnchor="start"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fill="#3b82f6"
                  >
                    {invVal}
                  </text>
                )}
              </g>
            );
          })}

          {/* Forecast separation marker line */}
          {historicalIndices.length > 0 && forecastIndices.length > 0 && (
            <g>
              <line
                x1={getX(historicalIndices[historicalIndices.length - 1])}
                y1={paddingTop - 10}
                x2={getX(historicalIndices[historicalIndices.length - 1])}
                y2={paddingTop + chartHeight}
                stroke="#cfc7b8"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <text
                x={getX(historicalIndices[historicalIndices.length - 1]) + 6}
                y={paddingTop - 2}
                fontSize="9"
                fontFamily="monospace"
                fill="#b45309"
                fontWeight="600"
              >
                PROJECTION HORIZON →
              </text>
            </g>
          )}

          {/* Stockout Alert Marker Line */}
          {stockoutX !== null && (viewMode === "combined" || viewMode === "inventory") && (
            <g>
              <line
                x1={stockoutX}
                y1={paddingTop - 14}
                x2={stockoutX}
                y2={paddingTop + chartHeight}
                stroke="#e11d48"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <rect
                x={stockoutX - 44}
                y={paddingTop - 24}
                width="88"
                height="18"
                rx="2"
                fill="#ffe4e6"
                stroke="#f43f5e"
                strokeWidth="0.8"
              />
              <text
                x={stockoutX}
                y={paddingTop - 12}
                textAnchor="middle"
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight="700"
                fill="#9f1239"
              >
                ⚠️ STOCKOUT
              </text>
            </g>
          )}

          {/* 1. SALES: Area fill & Line */}
          {(viewMode === "combined" || viewMode === "sales") && (
            <g>
              {/* Historical Area */}
              <path d={salesHistArea} fill="url(#salesHistGrad)" />

              {/* Forecast Confidence Interval Band */}
              <path d={confidenceBandArea} fill="url(#forecastBandGrad)" />

              {/* Historical Line */}
              <path
                d={salesHistPath}
                fill="none"
                stroke="#12110f"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Forecast Projection Line */}
              <path
                d={salesForecastPath}
                fill="none"
                stroke="#d97706"
                strokeWidth="2.4"
                strokeDasharray="6 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* 2. INVENTORY: Burn-down Line */}
          {(viewMode === "combined" || viewMode === "inventory") && (
            <g>
              <path
                d={invPath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Data Points / Circles */}
          {points.map((p, idx) => {
            const cx = getX(idx);
            const cySales = getYSales(p.sales);
            const cyInv = p.inventory !== undefined ? getYInv(p.inventory) : null;
            const isHovered = hoverIndex === idx;

            return (
              <g key={`point-${p.date}-${p.isForecast ? 'fc' : 'hist'}-${idx}`}>
                {/* Sales point */}
                {(viewMode === "combined" || viewMode === "sales") && (
                  <circle
                    cx={cx}
                    cy={cySales}
                    r={isHovered ? 5.5 : p.isForecast ? 3.5 : 2.5}
                    fill={p.isForecast ? "#d97706" : "#12110f"}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2 : 1}
                    className="transition-all duration-150 cursor-pointer"
                  />
                )}

                {/* Inventory point */}
                {(viewMode === "combined" || viewMode === "inventory") && cyInv !== null && (
                  <circle
                    cx={cx}
                    cy={cyInv}
                    r={isHovered ? 5 : 3}
                    fill={p.inventory! <= 0 ? "#e11d48" : "#2563eb"}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    className="transition-all duration-150 cursor-pointer"
                  />
                )}

                {/* X-axis tick & label */}
                {(points.length <= 14 || idx % Math.ceil(points.length / 10) === 0 || idx === points.length - 1) && (
                  <text
                    x={cx}
                    y={paddingTop + chartHeight + 20}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fill={p.isForecast ? "#b45309" : "#6b665c"}
                    fontWeight={p.isForecast ? "600" : "400"}
                  >
                    {p.date.slice(2, 7)}
                  </text>
                )}

                {/* Invisible hover catcher */}
                <rect
                  x={cx - xStep / 2}
                  y={paddingTop}
                  width={xStep}
                  height={chartHeight + 20}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(idx)}
                  className="cursor-crosshair"
                />
              </g>
            );
          })}

          {/* Active Hover Crosshair Line */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={paddingTop}
              x2={getX(hoverIndex)}
              y2={paddingTop + chartHeight}
              stroke="#12110f"
              strokeWidth="1"
              strokeDasharray="2 2"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* Floating Tooltip Card */}
        {activePoint && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute z-30 transform -translate-x-1/2 -translate-y-full rounded-sm border border-hairline bg-surface/95 p-3.5 shadow-md backdrop-blur-xs text-[12px] min-w-[210px]"
            style={{
              left: `${(getX(hoverIndex) / svgWidth) * 100}%`,
              top: `${Math.max(10, getYSales(activePoint.sales) - 20)}px`,
            }}
          >
            <div className="flex items-center justify-between border-b border-hairline pb-1.5 mb-2">
              <span className="font-mono font-semibold text-ink">
                {activePoint.date}
              </span>
              <span
                className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-xs font-medium ${
                  activePoint.isForecast
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-ground text-muted border border-hairline"
                }`}
              >
                {activePoint.isForecast ? "Forecast" : "Historical"}
              </span>
            </div>

            <div className="space-y-1.5 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${activePoint.isForecast ? "bg-amber-500" : "bg-ink"}`} />
                  {activePoint.isForecast ? "Projected Demand:" : "Sales Volume:"}
                </span>
                <span className="font-mono font-semibold text-ink">
                  {activePoint.sales.toLocaleString()} units
                </span>
              </div>

              {activePoint.revenue && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Est. Revenue:</span>
                  <span className="font-mono font-medium text-emerald-800">
                    ${activePoint.revenue.toLocaleString()}
                  </span>
                </div>
              )}

              {activePoint.isForecast && activePoint.lowerBound !== undefined && (
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>90% Range:</span>
                  <span className="font-mono">
                    {activePoint.lowerBound} – {activePoint.upperBound}
                  </span>
                </div>
              )}

              {activePoint.inventory !== undefined && (
                <div className="flex items-center justify-between pt-1 border-t border-hairline/60">
                  <span className="text-muted flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    Remaining Stock:
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      activePoint.inventory <= 0
                        ? "text-rose-600"
                        : activePoint.inventory < 50
                        ? "text-amber-600"
                        : "text-blue-700"
                    }`}
                  >
                    {activePoint.inventory.toLocaleString()} units
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Axis Footer Labels */}
      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-muted border-t border-hairline/60 pt-2">
        <span>← Timeline (Monthly Aggregation)</span>
        <span>Left: Sales Demand · Right: Inventory on Hand →</span>
      </div>
    </div>
  );
}
