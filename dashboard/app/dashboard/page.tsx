import Link from "next/link";
import { getOperationalPosture, marvinCopy } from "@/lib/marvin-copy";
import { getTasks } from "@/lib/tasks";

export default async function DashboardPage() {
  const tasks = await getTasks();
  const tasksWithReports = tasks.filter((task) => task.reportCount > 0).length;
  const latestReports = tasks
    .map((task) => task.latestReport?.modifiedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const operationalPosture = getOperationalPosture(tasks);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>{marvinCopy.consoleName}</h1>
          <p className="muted">{marvinCopy.overviewSummary}</p>
        </div>
      </header>
      <section className="posture-band" aria-label="Operational posture">
        <div>
          <p className="eyebrow">System posture</p>
          <h2>{operationalPosture}</h2>
        </div>
        <span className="status-chip">All tasks discovered</span>
      </section>
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
          <p className="muted">{marvinCopy.reportsSummary}</p>
        </div>
        <Link className="button primary" href="/dashboard/reports">
          Open reports
        </Link>
      </section>
    </div>
  );
}
