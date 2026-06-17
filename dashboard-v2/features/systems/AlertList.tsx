import { Panel } from "@/components/ui/Panel";
import { type BeszelAlert } from "@/lib/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/time";
import { AlertTriangle, CheckCircle } from "lucide-react";

type AlertListProps = {
  alerts: BeszelAlert[];
};

export function AlertList({ alerts }: AlertListProps) {
  const activeAlerts = alerts.filter((a) => !a.resolved);

  if (activeAlerts.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No active alerts"
          message="All systems nominal."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              display: "flex",
              gap: "var(--spacing-sm)",
              padding: "var(--spacing-sm)",
              background: "var(--surface-2)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)"
            }}
          >
            {alert.resolved ? (
              <CheckCircle size={16} style={{ color: "var(--healthy)", flexShrink: 0, marginTop: "2px" }} />
            ) : (
              <AlertTriangle size={16} style={{ color: "var(--warning)", flexShrink: 0, marginTop: "2px" }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                  {alert.system_name}: {alert.alert_type}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                  {formatRelativeTime(alert.triggered_at)}
                </span>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {alert.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
