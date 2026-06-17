import { Panel } from "@/components/ui/Panel";
import { type TaskRun } from "@/lib/api/types";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { normalizeRisk } from "@/lib/risk";
import { formatRelativeTime } from "@/lib/time";

type LatestConclusionsProps = {
  runs: TaskRun[];
};

export function LatestConclusions({ runs }: LatestConclusionsProps) {
  if (runs.length === 0) {
    return (
      <Panel>
        <div style={{ textAlign: "center", padding: "var(--spacing-lg)", color: "var(--text-muted)" }}>
          <p style={{ fontSize: "0.9rem" }}>No recent task runs. Silence, but formatted.</p>
        </div>
      </Panel>
    );
  }

  const latest = runs.slice(0, 5);

  return (
    <Panel>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "var(--spacing)" }}>
        Latest Conclusions
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
        {latest.map((run) => (
          <a
            key={run.id}
            href={`/console/runs/${encodeURIComponent(run.task_name)}?run=${run.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "var(--spacing-sm)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-2)",
              textDecoration: "none",
              gap: "var(--spacing)"
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                  {run.task_name}
                </span>
                <RiskBadge risk={normalizeRisk(run.risk_level)} />
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Status: {run.status} • {run.has_summary ? "Summary available" : "No summary"}
              </p>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
              {formatRelativeTime(run.observed_at || run.started_at)}
            </span>
          </a>
        ))}
      </div>
    </Panel>
  );
}
