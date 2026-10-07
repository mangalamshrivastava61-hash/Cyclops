import type { Metadata } from "next";
import { PageShell } from "@/components/chrome/PageShell";
import { TimeMachine } from "@/components/time-machine/TimeMachine";

export const metadata: Metadata = { title: "Time Machine" };

export default function TimeMachinePage() {
  return <PageShell section="Time Machine" n={4} className="overflow-x-clip"><TimeMachine /></PageShell>;
}
