import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { HistoryView } from "@/components/history/HistoryView";

export const metadata: Metadata = { title: "History" };
export default function HistoryPage() { return <PageShell section="History" n={12}><HistoryView /></PageShell>; }
