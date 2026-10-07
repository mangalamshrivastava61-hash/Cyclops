"use client";

import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { Eyebrow, Serif, SecondaryButton } from "@/components/ui/primitives";
import { api } from "@/lib/services/api";
import { useRecentCsvStore } from "@/lib/store/recent-csv-store";

interface PredictionItem {
  product_id: string;
  product_name: string;
  category: string;
  forecast_date: string;
  predicted_units_sold: number;
  price: number;
}

interface ModelInfo {
  status: string;
  model_name?: string;
  model_file?: string;
  data_file?: string;
  target?: string;
  features_count?: number;
  features?: string[];
  last_date?: string;
  products_count?: number;
}

export default function MLForecastPage() {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [months, setMonths] = useState<number>(1);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dataSource, setDataSource] = useState<string>("sales_data.csv");
  const [loading, setLoading] = useState<boolean>(true);
  const [predicting, setPredicting] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const info = await api.mlModelInfo();
        setModelInfo(info);
        if (info.data_file) setDataSource(info.data_file);
        const res = await api.mlPredict(1);
        setPredictions(res.predictions);
        if (res.data_source) setDataSource(res.data_source);
      } catch (err: any) {
        setError(err?.message || "Failed to connect to backend ML API.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRunForecast = async (m: number) => {
    setMonths(m);
    setPredicting(true);
    setError(null);
    setUploadSuccess(null);
    try {
      const res = await api.mlPredict(m);
      setPredictions(res.predictions);
      if (res.data_source) setDataSource(res.data_source);
    } catch (err: any) {
      setError(err?.message || "Prediction error");
    } finally {
      setPredicting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadSuccess(null);

    try {
      const res = await api.mlUploadAndPredict(file, months);
      setPredictions(res.predictions);
      setDataSource(res.data_source);
      setUploadSuccess(`Successfully processed file: ${file.name}`);
      const info = await api.mlModelInfo();
      setModelInfo(info);

      if (file.name.toLowerCase().endsWith(".csv")) {
        useRecentCsvStore.getState().setRecentCsv(file.name);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to process uploaded file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const categories = Array.from(new Set(predictions.map((p) => p.category)));
  const filteredPredictions = predictions.filter(
    (p) => selectedCategory === "all" || p.category === selectedCategory
  );

  const totalPredictedUnits = filteredPredictions.reduce(
    (sum, p) => sum + p.predicted_units_sold,
    0
  );
  const totalPredictedRevenue = filteredPredictions.reduce(
    (sum, p) => sum + p.predicted_units_sold * p.price,
    0
  );

  return (
    <PageShell section="ML Demand Forecasting" n={12}>
      <div className="pt-10 pb-16">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <Eyebrow>Trained Machine Learning Model · Inference & Data Pipeline</Eyebrow>
          <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
            <div>
              <h1 className="text-[clamp(36px,4.5vw,56px)] font-medium tracking-tight">
                Sales Demand Forecast
              </h1>
              <Serif className="text-[22px] text-ink2">
                Processed through {modelInfo?.model_name ?? "Gradient Boosting Regressor"}
              </Serif>
            </div>

            {/* Model Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-[12px] font-mono uppercase tracking-wider text-muted">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {modelInfo?.status === "ready" ? "Model Online" : "Model Loading"}
              </span>
              <span className="rounded-full border border-hairline bg-surface px-3 py-1 text-[12px] font-mono text-muted">
                {modelInfo?.features_count ?? 24} Features
              </span>
              <span className="rounded-full border border-hairline bg-surface px-3 py-1 text-[12px] font-mono text-muted">
                Source: {dataSource}
              </span>
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="mt-8 rounded-sm border border-dashed border-ink/25 bg-surface/60 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">
                Upload Data File or Model Artifact
              </h3>
              <p className="mt-0.5 text-[13px] text-muted">
                Upload your sales history CSV (<span className="font-mono text-xs">date, product, units_sold, price</span>) or a new model artifact (<span className="font-mono text-xs">.pkl</span> / <span className="font-mono text-xs">.joblib</span>).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pkl,.joblib"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`inline-flex items-center gap-2 cursor-pointer rounded-sm border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-ground transition-opacity hover:opacity-90 ${
                  uploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {uploading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ground border-t-transparent" />
                    Processing with Model...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload & Run Inference
                  </>
                )}
              </label>
            </div>
          </div>

          {uploadSuccess && (
            <div className="mt-4 rounded-sm border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800 flex items-center justify-between">
              <span>{uploadSuccess}</span>
              <button
                type="button"
                onClick={() => setUploadSuccess(null)}
                className="text-xs font-mono uppercase underline hover:text-emerald-950"
              >
                Dismiss
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-sm border border-rose-300 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-800 flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs font-mono uppercase underline hover:text-rose-950"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Duration Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-hairline py-4">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-mono uppercase tracking-wider text-muted">
              Forecast Horizon:
            </span>
            {[1, 3, 6, 12].map((num) => (
              <button
                key={num}
                type="button"
                disabled={predicting || uploading}
                onClick={() => handleRunForecast(num)}
                className={`px-3.5 py-1 text-[13px] font-mono transition-colors rounded-sm border ${
                  months === num
                    ? "border-ink bg-ink text-ground"
                    : "border-hairline bg-surface text-ink hover:border-ink2"
                }`}
              >
                {num === 1 ? "Next Month (1m)" : `${num} Months`}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-mono uppercase tracking-wider text-muted">
              Category:
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-sm border border-hairline bg-surface px-3 py-1 text-[13px] text-ink outline-none focus:border-ink"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-sm border border-hairline bg-surface p-5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted">
              Active Source Data
            </div>
            <div className="mt-2 text-[20px] font-semibold tracking-tight truncate" title={dataSource}>
              {dataSource}
            </div>
            <div className="mt-1 text-[12px] text-muted">
              {filteredPredictions.length} prediction lines computed
            </div>
          </div>

          <div className="rounded-sm border border-hairline bg-surface p-5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted">
              Total Units Forecasted
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-tight">
              {totalPredictedUnits.toLocaleString()}
            </div>
            <div className="mt-1 text-[12px] text-muted">
              For {months} month{months > 1 ? "s" : ""} horizon
            </div>
          </div>

          <div className="rounded-sm border border-hairline bg-surface p-5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted">
              Expected Sales Revenue
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-tight">
              ${Math.round(totalPredictedRevenue).toLocaleString()}
            </div>
            <div className="mt-1 text-[12px] text-muted">
              Aggregated across product prices
            </div>
          </div>

          <div className="rounded-sm border border-hairline bg-surface p-5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted">
              Model Artifact
            </div>
            <div className="mt-2 text-[18px] font-mono font-medium truncate" title={modelInfo?.model_file ?? "best_sales_model.pkl"}>
              {modelInfo?.model_file ?? "best_sales_model.pkl"}
            </div>
            <div className="mt-1 text-[12px] text-muted">
              {modelInfo?.model_name ?? "Gradient Boosting"}
            </div>
          </div>
        </div>

        {/* Designated Area for Model Results */}
        <div className="mt-10 overflow-hidden rounded-sm border border-hairline bg-surface shadow-xs">
          <div className="border-b border-hairline px-6 py-4 flex items-center justify-between bg-surface">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight">
                Model Prediction Results
              </h2>
              <p className="text-[12px] text-muted">
                Live output generated by {modelInfo?.model_name ?? "model"} from {dataSource}
              </p>
            </div>
            {(predicting || uploading) && (
              <span className="flex items-center gap-1.5 text-[12px] font-mono text-muted animate-pulse">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Processing inference...
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-hairline bg-ground/60 font-mono text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-3">Product ID</th>
                  <th className="px-6 py-3">Product Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Forecast Date</th>
                  <th className="px-6 py-3 text-right">Unit Price</th>
                  <th className="px-6 py-3 text-right">Predicted Demand</th>
                  <th className="px-6 py-3 text-right">Est. Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filteredPredictions.map((row, idx) => (
                  <tr key={`${row.product_id}-${row.forecast_date}-${idx}`} className="hover:bg-ground/40 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-[12px] font-semibold">
                      {row.product_id}
                    </td>
                    <td className="px-6 py-3.5 font-medium">{row.product_name}</td>
                    <td className="px-6 py-3.5 text-ink2">{row.category}</td>
                    <td className="px-6 py-3.5 font-mono text-[12px] text-muted">
                      {row.forecast_date}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-muted">
                      ${row.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-medium text-ink">
                      {row.predicted_units_sold.toLocaleString()} units
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-ink">
                      ${Math.round(row.predicted_units_sold * row.price).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredPredictions.length === 0 && !loading && !uploading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted">
                      No predictions found. Upload a CSV file or click a forecast horizon to generate.
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
