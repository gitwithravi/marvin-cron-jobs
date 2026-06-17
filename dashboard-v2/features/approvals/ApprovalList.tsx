"use client";

import { Panel } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { type Approval } from "@/lib/api/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { normalizeStatus } from "@/lib/status";
import { formatRelativeTime } from "@/lib/time";
import { useState } from "react";

type ApprovalListProps = {
  pendingApprovals: Approval[];
  historyApprovals: Approval[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function ApprovalList({ pendingApprovals, historyApprovals, selectedId, onSelect }: ApprovalListProps) {
  const [activeTab, setActiveTab] = useState("pending");

  const approvals = activeTab === "pending" ? pendingApprovals : historyApprovals;

  const tabs = [
    { id: "pending", label: "Pending", count: pendingApprovals.length },
    { id: "history", label: "History", count: historyApprovals.length }
  ];

  return (
    <Panel style={{ overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {approvals.length === 0 ? (
        <EmptyState
          title={activeTab === "pending" ? "No pending approvals" : "No approval history"}
          message={activeTab === "pending" ? "A rare moment of peace. Don't get attached." : "No approvals have been processed yet."}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
          {approvals.map((approval) => (
            <button
              key={approval.id}
              onClick={() => onSelect(approval.id)}
              style={{
                width: "100%",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-xs)",
                padding: "var(--spacing-sm)",
                borderRadius: "var(--radius-sm)",
                background: approval.id === selectedId ? "var(--surface-3)" : "var(--surface-2)",
                border: approval.id === selectedId ? "1px solid var(--accent)" : "1px solid transparent",
                cursor: "pointer",
                transition: "background 0.15s, border 0.15s"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--spacing-sm)" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text)" }}>
                  {approval.target_label}
                </span>
                <StatusBadge status={normalizeStatus(approval.status)} />
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {approval.summary}
              </p>
              <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                {formatRelativeTime(approval.created_at)}
              </span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
