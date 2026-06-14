import Link from "next/link";
import { getOperationalPosture, marvinCopy } from "@/lib/marvin-copy";
import { getOpenRouterAccountUsage } from "@/lib/openrouter-usage";
import { getTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("en", {
  currency: "USD",
  maximumFractionDigits: 4,
  style: "currency"
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

export default async function DashboardPage() {
  const tasks = await getTasks();
  const openRouterUsage = await getOpenRouterAccountUsage();
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
      <section className="usage-panel" aria-label="OpenRouter account usage">
        <div className="usage-panel-header">
          <div>
            <p className="eyebrow">OpenRouter spend</p>
            <h2>Account usage</h2>
            <p className="muted">Account-level credits and usage for MARVIN.</p>
          </div>
          {openRouterUsage.ok ? (
            <span className="status-chip usage-chip">
              Updated{" "}
              {new Intl.DateTimeFormat("en", {
                timeStyle: "short"
              }).format(new Date(openRouterUsage.usage.fetchedAt))}
            </span>
          ) : null}
        </div>
        {openRouterUsage.ok ? (
          <div className="usage-layout">
            <div className="usage-donut-wrap">
              <div
                className="usage-donut"
                style={{
                  background: `conic-gradient(#477f68 ${openRouterUsage.usage.usagePercent}%, #d9dfdd 0)`
                }}
                aria-label={`${formatPercent(openRouterUsage.usage.usagePercent)} of OpenRouter credits used`}
              >
                <div>
                  <strong>{formatPercent(openRouterUsage.usage.usagePercent)}</strong>
                  <span>used</span>
                </div>
              </div>
            </div>
            <div className="usage-details">
              <div className="usage-stat-grid">
                <div>
                  <span>{formatCurrency(openRouterUsage.usage.totalUsage)}</span>
                  <p>Total usage</p>
                </div>
                <div>
                  <span>{formatCurrency(openRouterUsage.usage.remainingCredits)}</span>
                  <p>Remaining</p>
                </div>
                <div>
                  <span>{formatCurrency(openRouterUsage.usage.totalCredits)}</span>
                  <p>Total credits</p>
                </div>
              </div>
              <div className="usage-bar" aria-hidden="true">
                <span
                  className="usage-bar-used"
                  style={{ width: `${openRouterUsage.usage.usagePercent}%` }}
                />
              </div>
              <div className="usage-legend">
                <span>
                  <i className="legend-used" /> Used
                </span>
                <span>
                  <i className="legend-remaining" /> Available
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="usage-empty">
            <h3>Usage unavailable</h3>
            <p>{openRouterUsage.error}</p>
          </div>
        )}
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
