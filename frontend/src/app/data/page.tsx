import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { DataStudio } from "@/components/data/DataStudio";

export const metadata: Metadata = { title: "Data Studio" };
export default function DataPage() { return <PageShell section="Data Studio" n={11}><DataStudio /></PageShell>; }
