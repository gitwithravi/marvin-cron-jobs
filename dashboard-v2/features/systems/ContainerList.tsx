import { Panel } from "@/components/ui/Panel";
import { type BeszelContainer } from "@/lib/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { normalizeStatus } from "@/lib/status";
import { Box } from "lucide-react";

type ContainerListProps = {
  containers: BeszelContainer[];
};

export function ContainerList({ containers }: ContainerListProps) {
  if (containers.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No containers"
          message="No containers are being monitored."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "var(--spacing-sm)" }}>
        {containers.map((container) => (
          <div
            key={container.id || `${container.systemName}-${container.name}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "var(--spacing-sm)",
              background: "var(--surface-2)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
              <Box size={14} style={{ color: "var(--text-muted)" }} />
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
                  {container.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>
                  {container.systemName}
                </div>
              </div>
            </div>
            <StatusBadge status={normalizeStatus(container.status)} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
