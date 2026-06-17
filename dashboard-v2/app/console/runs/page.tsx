import { marvinApiBaseUrl } from "@/lib/marvin-server";
import type { TaskRun, TaskInfo } from "@/lib/api/types";
import { RunList } from "@/features/reports/RunList";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  let runs: TaskRun[] = [];
  let tasks: TaskInfo[] = [];

  try {
    const [runsRes, tasksRes] = await Promise.all([
      fetch(`${marvinApiBaseUrl()}/runs`, { cache: "no-store" }),
      fetch(`${marvinApiBaseUrl()}/tasks`, { cache: "no-store" })
    ]);
    if (runsRes.ok) {
      runs = await runsRes.json();
    }
    if (tasksRes.ok) {
      const data = await tasksRes.json();
      tasks = Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error("Error fetching runs data:", err);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Runs</h1>
      <RunList runs={runs} tasks={tasks} />
    </div>
  );
}
