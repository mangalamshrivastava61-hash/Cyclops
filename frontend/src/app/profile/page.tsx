"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/chrome/AppHeader";
import { Eyebrow, PrimaryButton, Serif } from "@/components/ui/primitives";
import { getInitials, useAuthSession } from "@/lib/auth";
import { api } from "@/lib/services/api";
import { world } from "@/lib/services/repository";

interface CsvHistoryItem {
  id: number;
  filename: string;
  row_count: number;
  uploaded_at: string;
}

export default function ProfilePage() {
  const { user, loaded, logout } = useAuthSession();
  const router = useRouter();

  const [history, setHistory] = useState<CsvHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingEntryId, setLoadingEntryId] = useState<number | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);

  // Load CSV history for this user
  useEffect(() => {
    if (!user?.email) return;
    setLoadingHistory(true);
    api
      .listCsvHistory(user.email)
      .then((items) => setHistory(items || []))
      .catch((err) => {
        console.warn("Could not load CSV history from backend:", err);
        setHistory([]);
      })
      .finally(() => setLoadingHistory(false));
  }, [user?.email]);

  const handleSignOut = () => {
    logout();
    router.push("/login");
  };

  // Load a saved CSV directly into Forecast Studio
  const handleOpenInForecast = async (item: CsvHistoryItem) => {
    if (!user?.email) return;
    setLoadingEntryId(item.id);
    try {
      const detail = await api.getCsvHistoryDetail(user.email, item.id);
      if (detail?.rows && detail.rows.length > 0) {
        window.sessionStorage.setItem(
          "oracle-imported-dataset",
          JSON.stringify({
            filename: detail.filename,
            rows: detail.rows,
          })
        );
      }
      router.push("/ml-forecast");
    } catch (err: any) {
      alert(`Could not load dataset: ${err?.message || "Failed to fetch"}`);
    } finally {
      setLoadingEntryId(null);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    if (!user?.email) return;
    if (!confirm("Are you sure you want to delete this dataset from your history?")) return;
    setDeletingEntryId(id);
    try {
      await api.deleteCsvHistory(user.email, id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (err: any) {
      alert(`Could not delete: ${err?.message || "Failed to delete"}`);
    } finally {
      setDeletingEntryId(null);
    }
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-ground text-ink">
        <AppHeader section="Profile" />
        <div className="mx-auto flex h-[60vh] max-w-[1200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink border-t-transparent" />
        </div>
      </div>
    );
  }

  // Not logged in view
  if (!user) {
    return (
      <div className="min-h-screen bg-ground text-ink">
        <AppHeader section="Profile" />
        <main className="mx-auto max-w-[800px] px-6 py-24 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-ink/5 text-muted">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="8" r="5" />
              <path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
          </div>
          <Eyebrow>ORACLE · Account</Eyebrow>
          <h1 className="mt-3 text-[36px] font-medium tracking-tight">
            Sign in to view your <Serif>profile.</Serif>
          </h1>
          <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-relaxed text-ink2">
            Sign in with your email to see your user details, demand forecasts, and previously uploaded CSV & Excel datasets.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <PrimaryButton onClick={() => router.push("/login")}>SIGN IN</PrimaryButton>
            <Link
              href="/signup"
              className="inline-flex items-center rounded-sm border border-rule px-5 py-2.5 text-[13px] font-medium tracking-wide transition-colors hover:border-ink hover:text-ink"
            >
              CREATE ACCOUNT
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const initials = getInitials(user.name);
  const formattedCreated = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Active Member";

  return (
    <div className="min-h-screen bg-ground text-ink">
      <AppHeader section="Profile & Account" />

      <main className="mx-auto max-w-[1240px] px-6 py-12 md:px-12 md:py-16">
        {/* Profile Header Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-ink/15 bg-gradient-to-br from-paper to-ground p-8 shadow-xs md:p-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              {/* Monogram circle */}
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-ink text-[32px] font-bold text-ground shadow-md ring-4 ring-gold-deep/20">
                {initials}
                <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-ground bg-emerald-500 shadow-xs" title="Session Active" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[32px] font-semibold tracking-tight md:text-[38px]">{user.name}</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/70 border border-amber-300 px-3 py-0.5 text-[12px] font-medium text-amber-900">
                    <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
                    Verified Planner
                  </span>
                </div>
                <p className="mt-1.5 text-[15px] text-ink2">{user.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-muted">
                  <span>Member #{String(user.id).padStart(3, "0")}</span>
                  <span>·</span>
                  <span>Joined {formattedCreated}</span>
                  <span>·</span>
                  <span>Store: {world.store}</span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/ml-forecast"
                className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-ground transition-all hover:bg-gold-deep hover:text-ink shadow-xs"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                <span>Forecast Studio</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50/70 px-4 py-2.5 text-[13px] font-medium text-rose-800 transition-colors hover:bg-rose-100"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="mt-10 grid grid-cols-2 gap-4 border-t border-rule/80 pt-8 sm:grid-cols-4">
            <div className="rounded-lg bg-ground/80 p-4 border border-rule/50">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Uploaded Datasets</span>
              <p className="mt-1 text-[24px] font-bold text-ink">{history.length}</p>
            </div>
            <div className="rounded-lg bg-ground/80 p-4 border border-rule/50">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Active Store</span>
              <p className="mt-1 text-[24px] font-bold text-ink">{world.store}</p>
            </div>
            <div className="rounded-lg bg-ground/80 p-4 border border-rule/50">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Forecast Engine</span>
              <p className="mt-1 text-[24px] font-bold text-amber-900">ML + Ridge</p>
            </div>
            <div className="rounded-lg bg-ground/80 p-4 border border-rule/50">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Session Status</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-[16px] font-semibold text-emerald-900">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* CSV History Section */}
        <section id="csv-history" className="mt-14 scroll-mt-24">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <Eyebrow>Data Persistence · Scoped by {user.email}</Eyebrow>
              <h2 className="mt-2 text-[28px] font-medium tracking-tight">
                Your Saved CSV & <Serif>Excel Datasets</Serif>
              </h2>
            </div>
            <Link
              href="/ml-forecast"
              className="inline-flex items-center gap-2 rounded-md border border-ink/20 px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-ground"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Upload New Dataset</span>
            </Link>
          </div>

          <p className="mt-2 text-[14px] text-ink2">
            Every CSV or Excel file you upload into Forecast Studio is automatically archived here under your profile. You can re-open any dataset at any time to run new projections or compare inventory horizons.
          </p>

          <div className="mt-6 overflow-hidden rounded-xl border border-ink/15 bg-ground shadow-xs">
            {loadingHistory ? (
              <div className="flex h-40 items-center justify-center gap-3 text-[14px] text-muted">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                <span>Loading your saved datasets...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-paper text-muted mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <h3 className="text-[16px] font-semibold text-ink">No CSV datasets uploaded yet</h3>
                <p className="mt-1 max-w-[420px] text-[13.5px] text-muted">
                  Head over to the Forecast Studio to drag and drop your retail sales spreadsheets. They will be stored here automatically.
                </p>
                <Link
                  href="/ml-forecast"
                  className="mt-5 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-[13px] font-semibold text-ground hover:bg-gold-deep hover:text-ink transition-colors"
                >
                  Go to Forecast Studio &rarr;
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13.5px]">
                  <thead>
                    <tr className="border-b border-rule bg-paper/60 text-[11px] font-semibold uppercase tracking-wider text-muted">
                      <th className="py-3.5 pl-6 pr-4">Dataset Name</th>
                      <th className="py-3.5 px-4">Records</th>
                      <th className="py-3.5 px-4">Uploaded At</th>
                      <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule/60">
                    {history.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-paper/40">
                        <td className="py-4 pl-6 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </div>
                            <span className="font-semibold text-ink">{item.filename}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-ink2">
                          <span className="rounded bg-paper px-2 py-1 font-mono text-[12px]">
                            {item.row_count.toLocaleString()} rows
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[12.5px] text-muted">
                          {new Date(item.uploaded_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-4 pl-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenInForecast(item)}
                              disabled={loadingEntryId === item.id}
                              className="inline-flex items-center gap-1.5 rounded bg-ink px-3 py-1.5 text-[12px] font-semibold text-ground hover:bg-gold-deep hover:text-ink transition-colors disabled:opacity-50"
                            >
                              {loadingEntryId === item.id ? (
                                "Loading..."
                              ) : (
                                <>
                                  <span>Open in Studio</span>
                                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 3 L11 8 L6 13" />
                                  </svg>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteHistory(item.id)}
                              disabled={deletingEntryId === item.id}
                              className="inline-flex items-center rounded p-1.5 text-muted hover:bg-rose-50 hover:text-rose-700 transition-colors"
                              title="Delete dataset"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Quick Product Links */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Link
            href="/control"
            className="group rounded-xl border border-ink/10 bg-paper/50 p-6 transition-all hover:border-gold-deep hover:shadow-xs"
          >
            <Eyebrow>Section 01</Eyebrow>
            <h3 className="mt-2 text-[20px] font-semibold group-hover:text-gold-deep transition-colors">
              Control Center &rarr;
            </h3>
            <p className="mt-1 text-[13px] text-ink2">
              Review real-time store replenishments, order recommendations, and inventory circuit breaker status.
            </p>
          </Link>

          <Link
            href="/ledger"
            className="group rounded-xl border border-ink/10 bg-paper/50 p-6 transition-all hover:border-gold-deep hover:shadow-xs"
          >
            <Eyebrow>Section 06</Eyebrow>
            <h3 className="mt-2 text-[20px] font-semibold group-hover:text-gold-deep transition-colors">
              Decision Ledger &rarr;
            </h3>
            <p className="mt-1 text-[13px] text-ink2">
              Immutable audit log of all automated replenishment runs, planner approvals, and overrides.
            </p>
          </Link>

          <Link
            href="/ask"
            className="group rounded-xl border border-ink/10 bg-paper/50 p-6 transition-all hover:border-gold-deep hover:shadow-xs"
          >
            <Eyebrow>Section 09</Eyebrow>
            <h3 className="mt-2 text-[20px] font-semibold group-hover:text-gold-deep transition-colors">
              Ask ORACLE (⌘K) &rarr;
            </h3>
            <p className="mt-1 text-[13px] text-ink2">
              Natural language demand intelligence queries across stockouts, promotions, and forecast variance.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
