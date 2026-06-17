import { marvinApiBaseUrl } from "@/lib/marvin-server";
import type { TaskRun } from "@/lib/api/types";
import { RunList } from "@/features/reports/RunList";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  let runs: TaskRun[] = [];

  try {
    const response = await fetch(`${marvinApiBaseUrl()}/runs`, { cache: "no-store" });
    if (response.ok) {
      runs = await response.json();
    }
  } catch (err) {
    console.error("Error fetching runs:", err);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Runs</h1>
      <RunList runs={runs} />
    </div>
  );
}
