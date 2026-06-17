"use client";

import { useApprovals } from "@/features/approvals/useApprovals";
import { ApprovalList } from "@/features/approvals/ApprovalList";
import { ApprovalDetailPanel } from "@/features/approvals/ApprovalDetailPanel";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Panel } from "@/components/ui/Panel";
import { useState } from "react";

export function ApprovalsScreen() {
  const {
    pendingApprovals,
    historyApprovals,
    selectedApproval,
    loading,
    error,
    selectApproval,
    refresh,
    approve,
    reject
  } = useApprovals();

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    selectApproval(id);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Approvals</h1>
        <Panel>
          <LoadingState message="Loading approvals..." />
        </Panel>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Approvals</h1>
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Approvals</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing)", minHeight: "600px" }}>
        <ApprovalList
          pendingApprovals={pendingApprovals}
          historyApprovals={historyApprovals}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
        <ApprovalDetailPanel
          approval={selectedApproval}
          onApprove={approve}
          onReject={reject}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}
