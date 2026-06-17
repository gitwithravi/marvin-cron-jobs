import { Panel } from "@/components/ui/Panel";
import { type BeszelData } from "@/lib/api/types";
import { type OpenRouterAccountUsage } from "@/lib/openrouter-usage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatPercent } from "@/lib/format";

type SystemPostureProps = {
  beszel: BeszelData | null;
  openrouter: OpenRouterAccountUsage | null;
  apiAvailable: boolean;
};

export function SystemPosture({ beszel, openrouter, apiAvailable }: SystemPostureProps) {
  return (
    <Panel>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "var(--spacing)" }}>
        System Posture
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--spacing)" }}>
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "var(--spacing-xs)", fontFamily: "var(--font-mono)" }}>
            API STATUS
          </p>
          <StatusBadge status={apiAvailable ? "healthy" : "failed"} />
        </div>

        {beszel && (
          <>
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "var(--spacing-xs)", fontFamily: "var(--font-mono)" }}>
                BESZEL SYSTEMS
              </p>
              <p style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                {beszel.systems.filter(s => s.status.toLowerCase() === "up").length} / {beszel.systems.length} up
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "var(--spacing-xs)", fontFamily: "var(--font-mono)" }}>
                ACTIVE ALERTS
              </p>
              <p style={{ fontSize: "0.9rem", fontWeight: 500, color: beszel.alerts.filter(a => a.triggered).length > 0 ? "var(--warning)" : "var(--text)" }}>
                {beszel.alerts.filter(a => a.triggered).length}
              </p>
            </div>
          </>
        )}

        {openrouter && (
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "var(--spacing-xs)", fontFamily: "var(--font-mono)" }}>
              OPENROUTER CREDITS
            </p>
            <p style={{ fontSize: "0.9rem", fontWeight: 500 }}>
              {formatPercent(openrouter.usagePercent)} used
            </p>
            <div
              style={{
                marginTop: "4px",
                height: "4px",
                background: "var(--surface-3)",
                borderRadius: "2px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${openrouter.usagePercent}%`,
                  height: "100%",
                  background: openrouter.usagePercent > 80 ? "var(--warning)" : "var(--accent)",
                  transition: "width 0.3s"
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
