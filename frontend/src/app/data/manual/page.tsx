import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { DataStudio } from "@/components/data/DataStudio";

export const metadata: Metadata = { title: "Manual Entry · Data Studio" };
export default function ManualDataPage() { return <PageShell section="Data Studio" n={11}><DataStudio manual /></PageShell>; }
