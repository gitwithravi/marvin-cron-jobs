import Link from "next/link";
import { getTasks } from "@/lib/tasks";

export default async function DashboardPage() {
  const tasks = await getTasks();
  const tasksWithReports = tasks.filter((task) => task.reportCount > 0).length;
  const latestReports = tasks
    .map((task) => task.latestReport?.modifiedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Agent Dashboard</h1>
          <p className="muted">
            Operational surface for MARVIN tasks, reports, and future controls.
          </p>
        </div>
      </header>
      <section className="metric-grid" aria-label="Dashboard summary">
        <div className="metric">
          <span>{tasks.length}</span>
          <p>Discovered tasks</p>
        </div>
        <div className="metric">
          <span>{tasksWithReports}</span>
          <p>Tasks with reports</p>
        </div>
        <div className="metric">
          <span>
            {latestReports
              ? new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short"
                }).format(new Date(latestReports))
              : "None"}
          </span>
          <p>Latest report update</p>
        </div>
      </section>
      <section className="section-band">
        <div>
          <h2>Reports</h2>
          <p className="muted">
            Browse generated Markdown reports for every configured task.
          </p>
        </div>
        <Link className="button primary" href="/dashboard/reports">
          Open reports
        </Link>
      </section>
    </div>
  );
}
