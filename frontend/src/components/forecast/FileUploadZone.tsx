"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Sparkles, UploadCloud } from "lucide-react";

interface Props {
  onFileLoaded: (file: File) => void;
  onLoadSample: () => void;
  fileName: string;
  totalRows: number;
  loading: boolean;
}

export function FileUploadZone({
  onFileLoaded,
  onLoadSample,
  fileName,
  totalRows,
  loading,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileLoaded(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileLoaded(file);
    }
  };

  const handleDownloadTemplate = (format: "csv" | "excel") => {
    const headers = "date,product_id,product_name,category,units_sold,price,inventory\n";
    const rows = [
      "2023-01-01,P001,Aero Runner 01,Footwear,185,129.99,420",
      "2023-02-01,P001,Aero Runner 01,Footwear,210,129.99,390",
      "2023-03-01,P001,Aero Runner 01,Footwear,245,129.99,350",
      "2023-04-01,P001,Aero Runner 01,Footwear,230,129.99,310",
      "2023-05-01,P001,Aero Runner 01,Footwear,260,129.99,280",
      "2023-06-01,P001,Aero Runner 01,Footwear,285,129.99,240",
      "2023-07-01,P001,Aero Runner 01,Footwear,310,129.99,200",
      "2023-08-01,P001,Aero Runner 01,Footwear,295,129.99,160",
      "2023-09-01,P001,Aero Runner 01,Footwear,280,129.99,130",
      "2023-10-01,P001,Aero Runner 01,Footwear,320,129.99,90",
      "2023-11-01,P001,Aero Runner 01,Footwear,410,129.99,50",
      "2023-12-01,P001,Aero Runner 01,Footwear,430,129.99,20",
    ].join("\n");

    const content = headers + rows;
    const blob = new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8;" : "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sales_inventory_template.${format === "csv" ? "csv" : "csv"}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-sm border border-hairline bg-surface p-6 shadow-xs">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Dropzone Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`group flex-1 cursor-pointer rounded-sm border-2 border-dashed p-6 transition-all duration-200 ${
            isDragOver
              ? "border-amber-500 bg-amber-50/50"
              : "border-hairline bg-ground/40 hover:border-ink/50 hover:bg-ground/70"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-hairline bg-surface text-ink transition-transform group-hover:scale-105">
              <UploadCloud className="h-6 w-6 text-amber-600" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold tracking-tight text-ink">
                  Upload Sales Data
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-surface border border-hairline text-muted">
                  CSV · XLSX · XLS
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-muted truncate">
                Drag and drop your spreadsheet here, or click to browse from disk.
              </p>
            </div>

            {loading ? (
              <span className="font-mono text-[12px] text-amber-700 animate-pulse">
                Parsing data...
              </span>
            ) : (
              <span className="hidden sm:inline-block font-mono text-[11px] uppercase tracking-wider text-muted border border-hairline bg-surface px-2.5 py-1 rounded-xs group-hover:border-ink">
                Select File
              </span>
            )}
          </div>
        </div>

        {/* Quick Preload Actions & Status */}
        <div className="flex flex-col gap-3 lg:w-[340px] shrink-0 border-t border-hairline pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted">
            <span>ACTIVE DATASET</span>
            <span className="font-medium text-ink">{totalRows} rows loaded</span>
          </div>

          <div className="flex items-center gap-2 rounded-xs border border-hairline bg-ground px-3 py-1.5 text-[12px]">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="font-mono font-medium text-ink truncate" title={fileName}>
              {fileName}
            </span>
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onLoadSample}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xs border border-amber-300 bg-amber-50/70 hover:bg-amber-100/80 px-2.5 py-1.5 text-[11.5px] font-mono font-semibold text-amber-900 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Load Sample Data
            </button>

            <button
              type="button"
              onClick={() => handleDownloadTemplate("csv")}
              title="Download clean CSV format template"
              className="flex items-center justify-center gap-1 rounded-xs border border-hairline bg-surface hover:bg-ground px-2.5 py-1.5 text-[11.5px] font-mono text-muted hover:text-ink transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
