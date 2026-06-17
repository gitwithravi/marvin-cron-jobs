"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { Timeline } from "@/components/ui/Timeline";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { type ApprovalDetail } from "@/lib/api/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { normalizeStatus } from "@/lib/status";
import { formatDateTime } from "@/lib/time";
import { Check, X, RefreshCw } from "lucide-react";

type ApprovalDetailPanelProps = {
  approval: ApprovalDetail | null;
  onApprove: (id: number, comment?: string) => Promise<void>;
  onReject: (id: number, reason?: string) => Promise<void>;
  onRefresh: () => void;
};

export function ApprovalDetailPanel({ approval, onApprove, onReject, onRefresh }: ApprovalDetailPanelProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  if (!approval) {
    return (
      <Panel style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <EmptyState
          title="No approval selected"
          message="Select an approval from the list to review."
        />
      </Panel>
    );
  }

  const handleApprove = async () => {
    try {
      await onApprove(approval.id, approveComment || undefined);
      setShowApproveDialog(false);
      setApproveComment("");
    } catch (err) {
      console.error("Approve failed:", err);
    }
  };

  const handleReject = async () => {
    try {
      await onReject(approval.id, rejectReason || undefined);
      setShowRejectDialog(false);
      setRejectReason("");
    } catch (err) {
      console.error("Reject failed:", err);
    }
  };

  const isPending = approval.status.toLowerCase() === "pending";

  return (
    <Panel style={{ overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing)" }}>
        <SectionHeader
          eyebrow="Approval"
          title={approval.target_label}
          action={
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={onRefresh}>
              Refresh
            </Button>
          }
        />

        <div style={{ display: "flex", gap: "var(--spacing-sm)", alignItems: "center" }}>
          <StatusBadge status={normalizeStatus(approval.status)} />
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Created {formatDateTime(approval.created_at)}
          </span>
        </div>

        <div>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
            What MARVIN wants to do
          </h3>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>{approval.summary}</p>
        </div>

        {approval.draft_content && (
          <div>
            <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
              Draft content
            </h3>
            <pre style={{ background: "var(--surface-2)", padding: "var(--spacing)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontFamily: "var(--font-mono)", overflow: "auto", whiteSpace: "pre-wrap" }}>
              {approval.draft_content}
            </pre>
          </div>
        )}

        {approval.evidence_json && Object.keys(approval.evidence_json).length > 0 && (
          <EvidenceBlock label="Evidence">
            <pre style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)", overflow: "auto", margin: 0 }}>
              {JSON.stringify(approval.evidence_json, null, 2)}
            </pre>
          </EvidenceBlock>
        )}

        {approval.policy_flags && approval.policy_flags.length > 0 && (
          <div>
            <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
              Policy flags
            </h3>
            <ul style={{ paddingLeft: "20px", fontSize: "0.9rem" }}>
              {approval.policy_flags.map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          </div>
        )}

        {approval.workflow_steps && approval.workflow_steps.length > 0 && (
          <div>
            <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
              Workflow steps
            </h3>
            <Timeline
              events={approval.workflow_steps.map((step) => ({
                timestamp: formatDateTime(step.timestamp),
                label: step.step,
                detail: step.details || undefined,
                status: step.status.toLowerCase() === "success" ? "success" : step.status.toLowerCase() === "error" ? "error" : "info"
              }))}
            />
          </div>
        )}

        {isPending && (
          <div style={{ display: "flex", gap: "var(--spacing-sm)", paddingTop: "var(--spacing)", borderTop: "1px solid var(--border)" }}>
            <Button variant="primary" icon={<Check size={16} />} onClick={() => setShowApproveDialog(true)}>
              Approve
            </Button>
            <Button variant="danger" icon={<X size={16} />} onClick={() => setShowRejectDialog(true)}>
              Reject
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showApproveDialog}
        title="Approve this action?"
        message={`You are approving: ${approval.target_label}. This action will proceed.`}
        confirmLabel="Approve"
        variant="primary"
        onConfirm={handleApprove}
        onCancel={() => setShowApproveDialog(false)}
      >
        <textarea
          value={approveComment}
          onChange={(e) => setApproveComment(e.target.value)}
          placeholder="Optional comment..."
          style={{
            width: "100%",
            minHeight: "80px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--spacing-sm)",
            color: "var(--text)",
            fontSize: "0.85rem",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={showRejectDialog}
        title="Reject this action?"
        message={`You are rejecting: ${approval.target_label}. Please provide a reason.`}
        confirmLabel="Reject"
        variant="danger"
        onConfirm={handleReject}
        onCancel={() => setShowRejectDialog(false)}
      >
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason for rejection..."
          style={{
            width: "100%",
            minHeight: "80px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--spacing-sm)",
            color: "var(--text)",
            fontSize: "0.85rem",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </ConfirmDialog>
    </Panel>
  );
}
