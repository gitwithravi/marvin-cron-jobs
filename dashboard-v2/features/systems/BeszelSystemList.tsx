import { Panel } from "@/components/ui/Panel";
import { type BeszelSystem } from "@/lib/api/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { normalizeStatus } from "@/lib/status";
import { formatRelativeTime } from "@/lib/time";
import { formatPercent } from "@/lib/format";
import { Server, Cpu, HardDrive, MemoryStick } from "lucide-react";

type BeszelSystemListProps = {
  systems: BeszelSystem[];
};

export function BeszelSystemList({ systems }: BeszelSystemListProps) {
  if (systems.length === 0) {
    return (
      <Panel>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", textAlign: "center", padding: "var(--spacing)" }}>
          No Beszel systems configured.
        </p>
      </Panel>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--spacing)" }}>
      {systems.map((system) => (
        <Panel key={system.name}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--spacing)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
              <Server size={16} style={{ color: "var(--accent)" }} />
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                {system.name}
              </h3>
            </div>
            <StatusBadge status={normalizeStatus(system.status)} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-xs)" }}>
            {system.latest.cpu !== null && system.latest.cpu !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", fontSize: "0.85rem" }}>
                <Cpu size={14} style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-muted)", minWidth: "60px" }}>CPU</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{formatPercent(system.latest.cpu)}</span>
              </div>
            )}

            {system.latest.memory !== null && system.latest.memory !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", fontSize: "0.85rem" }}>
                <MemoryStick size={14} style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-muted)", minWidth: "60px" }}>Memory</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{formatPercent(system.latest.memory)}</span>
              </div>
            )}

            {system.latest.disk !== null && system.latest.disk !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", fontSize: "0.85rem" }}>
                <HardDrive size={14} style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-muted)", minWidth: "60px" }}>Disk</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{formatPercent(system.latest.disk)}</span>
              </div>
            )}
          </div>

          <div style={{ marginTop: "var(--spacing)", paddingTop: "var(--spacing-sm)", borderTop: "1px solid var(--border)", fontSize: "0.75rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
            Updated {formatRelativeTime(system.updated)}
          </div>
        </Panel>
      ))}
    </div>
  );
}
