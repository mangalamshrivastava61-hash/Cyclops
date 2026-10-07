/**
 * The backend API boundary for ORACLE and ML Demand Forecasting.
 */
import * as repo from "./repository";

export const API_URL = process.env.ORACLE_API_URL ?? "http://localhost:8000";

const base = () => (typeof window === "undefined" ? API_URL : "");

async function fetchFromBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let detail = res.statusText || `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
      else if (Array.isArray(data?.detail)) detail = data.detail.map((d: any) => d.msg).join("; ");
    } catch {}
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  world: async () => repo.world,
  decision: async (id: string) => repo.decisionBundle(id),
  primaryDecision: async () => repo.decisionBundle(repo.getPrimaryDecision().id)!,
  decisions: async () => repo.listDecisions(),
  products: async () => repo.listProducts(),
  evidence: async (decisionId: string) => repo.getEvidence(decisionId),
  authority: async (sku: string) => repo.getAuthority(sku),
  circuit: async () => repo.getCircuit(),
  ledger: async () => repo.listLedgerSeed(),
  replay: async (id: string) => repo.getReplay(id),

  // ML demand forecast endpoints connected to FastAPI backend
  mlModelInfo: async () =>
    fetchFromBackend<{
      status: string;
      model_name?: string;
      model_file?: string;
      data_file?: string;
      target?: string;
      features_count?: number;
      features?: string[];
      last_date?: string;
      products_count?: number;
    }>("/api/ml-forecast/info"),

  mlPredict: async (months: number = 1) =>
    fetchFromBackend<{
      horizon_months: number;
      data_source: string;
      predictions: Array<{
        product_id: string;
        product_name: string;
        category: string;
        forecast_date: string;
        predicted_units_sold: number;
        price: number;
      }>;
      products: string[];
    }>(`/api/ml-forecast/predict?months=${months}`),

  mlUploadAndPredict: async (file: File, months: number = 1) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetchFromBackend<{
      horizon_months: number;
      data_source: string;
      predictions: Array<{
        product_id: string;
        product_name: string;
        category: string;
        forecast_date: string;
        predicted_units_sold: number;
        price: number;
      }>;
      products: string[];
    }>(`/api/ml-forecast/upload-and-predict?months=${months}`, {
      method: "POST",
      body: formData,
    });
  },

  mlHistory: async (limit: number = 500, sku?: string) =>
    fetchFromBackend<{
      data_source: string;
      total: number;
      records: Array<{
        date: string;
        sku: string;
        product_name: string;
        category?: string;
        demand: number;
        inventory: number;
        price: number;
        promotion: boolean;
        stockout: boolean;
      }>;
    }>(`/api/ml-forecast/history?limit=${limit}${sku && sku !== "all" ? `&sku=${encodeURIComponent(sku)}` : ""}`),

  // Auth & per-user CSV history
  login: async (body: { email: string; password: string }) =>
    fetchFromBackend<{ id: number; name: string; email: string; created_at: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  register: async (body: { name: string; email: string; password: string }) =>
    fetchFromBackend<{ id: number; name: string; email: string; created_at: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  saveCsvHistory: async (body: { user_email: string; filename: string; rows: any[] }) =>
    fetchFromBackend<{ id: number; filename: string; row_count: number; uploaded_at: string }>("/api/auth/csv-history", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listCsvHistory: async (userEmail: string) =>
    fetchFromBackend<Array<{ id: number; filename: string; row_count: number; uploaded_at: string }>>(
      `/api/auth/csv-history/${encodeURIComponent(userEmail)}`
    ),

  getCsvHistoryDetail: async (userEmail: string, entryId: number) =>
    fetchFromBackend<{ id: number; filename: string; row_count: number; uploaded_at: string; rows: any[] }>(
      `/api/auth/csv-history/${encodeURIComponent(userEmail)}/${entryId}`
    ),

  deleteCsvHistory: async (userEmail: string, entryId: number) =>
    fetchFromBackend<void>(`/api/auth/csv-history/${encodeURIComponent(userEmail)}/${entryId}`, {
      method: "DELETE",
    }),
};
