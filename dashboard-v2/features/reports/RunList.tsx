"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/time";
import { normalizeRisk } from "@/lib/risk";
import { normalizeStatus } from "@/lib/status";
import { type TaskRun } from "@/lib/api/types";
import { type RunFilters, filterRuns, getUniqueValues } from "./runMappers";
import { Filter, CheckCircle, XCircle } from "lucide-react";

type RunListProps = {
  runs: TaskRun[];
};

export function RunList({ runs }: RunListProps) {
  const [filters, setFilters] = useState<RunFilters>({
    task: "",
    risk: "",
    status: "",
    hasSummary: ""
  });

  const filteredRuns = filterRuns(runs, filters);
  const tasks = getUniqueValues(runs, "task_name");
  const risks = getUniqueValues(runs, "risk_level");
  const statuses = getUniqueValues(runs, "status");

  const updateFilter = (key: keyof RunFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing)" }}>
      <Panel style={{ background: "var(--surface-2)" }}>
        <div style={{ display: "flex", gap: "var(--spacing)", flexWrap: "wrap", alignItems: "center" }}>
          <Filter size={16} style={{ color: "var(--text-muted)" }} />
          
          <select
            value={filters.task}
            onChange={(e) => updateFilter("task", e.target.value)}
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 10px",
              color: "var(--text)",
              fontSize: "0.85rem"
            }}
          >
            <option value="">All tasks</option>
            {tasks.map((task) => (
              <option key={task} value={task}>{task}</option>
            ))}
          </select>

          <select
            value={filters.risk}
            onChange={(e) => updateFilter("risk", e.target.value)}
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 10px",
              color: "var(--text)",
              fontSize: "0.85rem"
            }}
          >
            <option value="">All risks</option>
            {risks.map((risk) => (
              <option key={risk} value={risk}>{risk}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 10px",
              color: "var(--text)",
              fontSize: "0.85rem"
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select
            value={filters.hasSummary}
            onChange={(e) => updateFilter("hasSummary", e.target.value)}
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 10px",
              color: "var(--text)",
              fontSize: "0.85rem"
            }}
          >
            <option value="">Summary: any</option>
            <option value="yes">Has summary</option>
            <option value="no">No summary</option>
          </select>
        </div>
      </Panel>

      {filteredRuns.length === 0 ? (
        <Panel>
          <EmptyState
            title="No runs match filters"
            message="Try adjusting your filter criteria."
          />
        </Panel>
      ) : (
        <Panel style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Task
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Risk
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Status
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Summary
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Observed
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => (
                <tr
                  key={run.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: run.status.toLowerCase() === "failed" ? "rgba(239, 99, 81, 0.05)" : "transparent"
                  }}
                >
                  <td style={{ padding: "12px 16px", fontSize: "0.9rem", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
                    {run.task_name}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <RiskBadge risk={normalizeRisk(run.risk_level)} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge status={normalizeStatus(run.status)} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {run.has_summary ? (
                      <CheckCircle size={16} style={{ color: "var(--healthy)" }} />
                    ) : (
                      <XCircle size={16} style={{ color: "var(--text-faint)" }} />
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {formatDateTime(run.observed_at || run.started_at)}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <a
                      href={`/console/runs/${encodeURIComponent(run.task_name)}?run=${run.id}`}
                      style={{ fontSize: "0.85rem", color: "var(--accent)", textDecoration: "none" }}
                    >
                      View →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
