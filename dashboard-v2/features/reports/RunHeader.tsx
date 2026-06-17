import { Panel } from "@/components/ui/Panel";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataList } from "@/components/ui/DataList";
import { formatDateTime } from "@/lib/time";
import { normalizeRisk } from "@/lib/risk";
import { normalizeStatus } from "@/lib/status";
import type { TaskRunDetail } from "@/lib/api/types";

type RunHeaderProps = {
  run: TaskRunDetail;
};

export function RunHeader({ run }: RunHeaderProps) {
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--spacing)" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, fontFamily: "var(--font-mono)", marginBottom: "var(--spacing-xs)" }}>
            {run.task_name}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Run #{run.id}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--spacing-sm)", alignItems: "center" }}>
          <RiskBadge risk={normalizeRisk(run.risk_level)} />
          <StatusBadge status={normalizeStatus(run.status)} />
        </div>
      </div>

      <DataList
        items={[
          { label: "Observed", value: formatDateTime(run.observed_at) },
          { label: "Started", value: formatDateTime(run.started_at) },
          { label: "Finished", value: formatDateTime(run.finished_at) },
          { label: "Status", value: run.status }
        ]}
      />
    </Panel>
  );
}
