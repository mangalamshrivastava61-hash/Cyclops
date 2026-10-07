"use client";

import { Sliders, RefreshCw } from "lucide-react";

interface Props {
  currentStock: number;
  onStockChange: (newStock: number) => void;
  serviceLevelZ: number;
  onServiceLevelChange: (z: number) => void;
  onReset: () => void;
}

export function StockAdjustmentBar({
  currentStock,
  onStockChange,
  serviceLevelZ,
  onServiceLevelChange,
  onReset,
}: Props) {
  return (
    <div className="rounded-sm border border-hairline bg-surface p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline/80 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-ink" />
          <span className="text-[13px] font-semibold tracking-tight text-ink">
            Interactive Inventory Simulator & Policy Controls
          </span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 text-[11px] font-mono text-muted hover:text-ink transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Reset Defaults
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Slider 1: On-Hand Inventory Level */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted">Simulated Stock On Hand:</span>
            <span className="font-mono font-semibold text-ink">
              {currentStock.toLocaleString()} units
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(2000, currentStock * 2.5)}
            step={25}
            value={currentStock}
            onChange={(e) => onStockChange(Number(e.target.value))}
            className="w-full accent-ink cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-muted">
            <span>0 (Stockout)</span>
            <span>{Math.round(currentStock)}</span>
            <span>{Math.max(2000, Math.round(currentStock * 2.5))} max</span>
          </div>
        </div>

        {/* Control 2: Target Service Level */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted">Target Service Level:</span>
            <span className="font-mono font-semibold text-ink">
              {serviceLevelZ === 1.28 ? "90%" : serviceLevelZ === 2.326 ? "99%" : "95%"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: "90% (Low Buffer)", z: 1.28 },
              { label: "95% (Standard)", z: 1.645 },
              { label: "99% (High Priority)", z: 2.326 },
            ].map((lvl) => (
              <button
                key={lvl.z}
                type="button"
                onClick={() => onServiceLevelChange(lvl.z)}
                className={`flex-1 py-1.5 rounded-xs border text-[11px] font-mono transition-colors ${
                  serviceLevelZ === lvl.z
                    ? "border-ink bg-ink text-ground font-medium"
                    : "border-hairline bg-ground text-ink hover:border-ink2"
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted">
            Safety stock buffer scaled against historical demand variance.
          </p>
        </div>

        {/* Summary note */}
        <div className="rounded-xs border border-hairline/80 bg-ground/60 p-3 flex flex-col justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
            Dynamic What-If Analysis
          </span>
          <p className="text-[12px] text-ink2 leading-relaxed">
            Adjusting on-hand stock or service criteria immediately alters the projected depletion date, safety buffer, and recommended replenishment order in the graph above.
          </p>
        </div>
      </div>
    </div>
  );
}
