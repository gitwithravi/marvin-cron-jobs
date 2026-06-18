import { MarkdownViewer } from "@/components/MarkdownViewer";
import { OperationalPanel } from "@/components/console/OperationalPanel";
import { PageIntro } from "@/components/console/PageIntro";
import { formatDateTime } from "@/lib/console/format";
import { consoleRoutes } from "@/lib/console/routes";
import type { ConsoleOverviewData } from "@/lib/console/overview";

export function OverviewPage({ data }: { data: ConsoleOverviewData }) {
  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Console"
        title="MARVIN Command Center"
        description={data.headline}
      />

      <section className="console-section-grid console-section-grid-primary">
        <section className="console-section console-section-alert">
          <div className="console-section-header">
            <div>
              <p className="console-eyebrow">Critical alerts</p>
              <h2>Latest attention digest</h2>
            </div>
            {data.alertUpdatedAt ? (
              <span className="console-meta-pill">{formatDateTime(data.alertUpdatedAt)}</span>
            ) : null}
          </div>
          <div className="console-markdown-surface">
            <MarkdownViewer markdown={data.alertMessage} />
          </div>
        </section>

        <section className="console-section">
          <div className="console-section-header">
            <div>
              <p className="console-eyebrow">Pending approvals</p>
              <h2>Human decisions still required</h2>
            </div>
          </div>
          <div className="console-list">
            {data.pendingApprovals.length > 0 ? (
              data.pendingApprovals.map((approval) => (
                <OperationalPanel
                  key={approval.id}
                  title={approval.summary_text || `Approval #${approval.id}`}
                  href={consoleRoutes.approvals}
                  status={approval.status || approval.run?.status}
                  conclusion="MARVIN paused for approval before taking an external action."
                  timestamp={approval.updated_at}
                  evidence={
                    <p>
                      Kind: <strong>{approval.kind || "unknown"}</strong>
                    </p>
                  }
                />
              ))
            ) : (
              <section className="console-empty-state">
                <h3>No pending approvals.</h3>
                <p>A rare moment of peace. Don&apos;t get attached.</p>
              </section>
            )}
          </div>
        </section>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <p className="console-eyebrow">Latest conclusions</p>
            <h2>Operational units that deserve attention</h2>
          </div>
        </div>
        <div className="console-operational-grid">
          {data.latestTasks.map((task) => (
            <OperationalPanel
              key={task.taskName}
              title={task.displayName}
              href={task.href}
              status={task.status}
              conclusion={task.conclusion}
              timestamp={task.lastRun}
              evidence={
                <p>
                  Reports recorded: <strong>{task.reportCount}</strong>
                </p>
              }
            />
          ))}
        </div>
      </section>

      <section className="console-section-grid">
        <section className="console-section">
          <div className="console-section-header">
            <div>
              <p className="console-eyebrow">Task posture</p>
              <h2>Everything else MARVIN checked</h2>
            </div>
          </div>
          <div className="console-compact-list">
            {data.secondaryTasks.map((task) => (
              <OperationalPanel
                key={task.taskName}
                title={task.displayName}
                href={task.href}
                status={task.status}
                conclusion={task.conclusion}
                timestamp={task.lastRun}
              />
            ))}
          </div>
        </section>

        <section className="console-section">
          <div className="console-section-header">
            <div>
              <p className="console-eyebrow">Secondary signal</p>
              <h2>Model spend</h2>
            </div>
          </div>
          {data.spend ? (
            <div className="console-secondary-metric">
              <strong>{data.spend.remainingCredits.toFixed(2)}</strong>
              <span>credits remaining</span>
              <p>{data.spend.usagePercent.toFixed(1)}% of OpenRouter credits used.</p>
            </div>
          ) : (
            <section className="console-empty-state">
              <h3>Spend unavailable.</h3>
              <p>The command center survives without decorative accounting.</p>
            </section>
          )}
        </section>
      </section>
    </div>
  );
}
