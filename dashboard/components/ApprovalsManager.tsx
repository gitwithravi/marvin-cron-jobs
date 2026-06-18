"use client";

import { useEffect, useMemo, useState } from "react";

type RunSummary = {
  id: number;
  workflow_name: string;
  subject_type: string;
  subject_id: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
};

type ApprovalSummary = {
  id: number;
  agent_run_id: number;
  kind: string;
  target_label: string | null;
  summary_text: string | null;
  draft_content: Record<string, unknown>;
  edited_content: Record<string, unknown>;
  evidence: Record<string, unknown>;
  status: string;
  rejection_reason: string | null;
  reviewer: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  run: RunSummary;
};

type ApprovalDetail = ApprovalSummary & {
  steps: Array<{
    id: number;
    step_name: string;
    status: string;
    input: Record<string, unknown> | null;
    output: Record<string, unknown> | null;
    error: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

type ApprovalsPayload = {
  approvals: ApprovalSummary[];
};

type ApprovalPayload = {
  approval: ApprovalDetail;
};

type ViewMode = "pending" | "history";

function readJson(response: Response) {
  return response.json().then((data) => {
    if (!response.ok) {
      const detail = data?.detail || data?.error || "Request failed";
      throw new Error(detail);
    }
    return data;
  });
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function truncateText(text: string, maxLines: number) {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + "\n…";
}

export function ApprovalsManager() {
  const [view, setView] = useState<ViewMode>("pending");
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [draftReply, setDraftReply] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedEvidence, setExpandedEvidence] = useState<Set<number>>(new Set());
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);

  async function loadApprovals(nextView: ViewMode, preferredId?: number | null) {
    setIsLoading(true);
    setError("");
    try {
      const data: ApprovalsPayload = await fetch(`/api/approvals?view=${nextView}`).then(readJson);
      const nextApprovals = data.approvals || [];
      setApprovals(nextApprovals);
      const nextSelectedId = preferredId && nextApprovals.some((item) => item.id === preferredId)
        ? preferredId
        : nextApprovals[0]?.id ?? null;
      setSelectedId(nextSelectedId);
    } catch (err) {
      setApprovals([]);
      setSelectedId(null);
      setDetail(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDetail(approvalId: number) {
    setIsLoadingDetail(true);
    setError("");
    setExpandedEvidence(new Set());
    try {
      const data: ApprovalPayload = await fetch(`/api/approvals/${approvalId}`).then(readJson);
      setDetail(data.approval);
      setDraftReply(asString(data.approval.edited_content.reply) || asString(data.approval.draft_content.reply));
      setRejectionReason(data.approval.rejection_reason || "");
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingDetail(false);
    }
  }

  useEffect(() => {
    loadApprovals(view);
  }, [view]);

  useEffect(() => {
    if (selectedId !== null) {
      loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId]);

  const selectedApproval = useMemo(
    () => approvals.find((item) => item.id === selectedId) || null,
    [approvals, selectedId]
  );

  async function approveCurrent() {
    if (!detail) return;
    setBusyAction("approve");
    setError("");
    setNotice("");
    setShowConfirmApprove(false);
    try {
      await fetch(`/api/approvals/${detail.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final_reply: draftReply })
      }).then(readJson);
      setNotice(`Approved ${detail.target_label || `approval ${detail.id}`}.`);
      const nextView = view === "pending" ? "pending" : view;
      await loadApprovals(nextView, detail.id);
      if (view === "history") {
        await loadDetail(detail.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  }

  async function rejectCurrent() {
    if (!detail) return;
    setBusyAction("reject");
    setError("");
    setNotice("");
    try {
      await fetch(`/api/approvals/${detail.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim() || undefined })
      }).then(readJson);
      setNotice(`Rejected ${detail.target_label || `approval ${detail.id}`}.`);
      const nextView = view === "pending" ? "pending" : view;
      await loadApprovals(nextView, detail.id);
      if (view === "history") {
        await loadDetail(detail.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  }

  const evidenceItems = useMemo(() => {
    if (!detail || !Array.isArray(detail.evidence.matched_examples)) return [];
    return detail.evidence.matched_examples as Array<Record<string, unknown>>;
  }, [detail]);

  const policyFlags = useMemo(() => {
    if (!detail || !Array.isArray(detail.evidence.policy_flags)) return [];
    return detail.evidence.policy_flags as string[];
  }, [detail]);

  function toggleEvidence(index: number) {
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="approvals-layout">
      <div className="status-tabs" role="tablist" aria-label="Approvals view">
        <button
          aria-selected={view === "pending"}
          className={`tab ${view === "pending" ? "active" : ""}`}
          onClick={() => setView("pending")}
          role="tab"
          type="button"
        >
          Pending
        </button>
        <button
          aria-selected={view === "history"}
          className={`tab ${view === "history" ? "active" : ""}`}
          onClick={() => setView("history")}
          role="tab"
          type="button"
        >
          History
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {notice ? <div className="support-rag-alert">{notice}</div> : null}

      <div className="approvals-shell">
        <section className="approvals-list-panel">
          <div className="approvals-panel-header">
            <h2>{view === "pending" ? "Pending approvals" : "Approval history"}</h2>
            <button className="button" type="button" onClick={() => loadApprovals(view, selectedId)} disabled={isLoading}>
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="invoice-empty">Loading approvals...</div>
          ) : approvals.length === 0 ? (
            <div className="invoice-empty">
              {view === "pending" ? "No pending approvals found." : "No approval history found."}
            </div>
          ) : (
            <div className="approvals-list">
              {approvals.map((approval) => {
                return (
                  <button
                    className={`approval-list-item ${approval.id === selectedId ? "active" : ""}`}
                    key={approval.id}
                    onClick={() => setSelectedId(approval.id)}
                    type="button"
                  >
                    <div className="approval-list-topline">
                      <span className="eyebrow">{approval.kind.replace(/_/g, " ")}</span>
                      <span className={`approval-status approval-status-${approval.status}`}>{approval.status}</span>
                    </div>
                    <h3>{approval.target_label || approval.summary_text || `Approval ${approval.id}`}</h3>
                    <p>{approval.summary_text || "No summary available."}</p>
                    <div className="approval-list-meta">
                      <span>{approval.run.workflow_name}</span>
                      <span>{new Date(approval.updated_at).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="approvals-detail-panel">
          {!selectedApproval ? (
            <div className="empty-state">
              <h2>No approval selected</h2>
              <p className="muted">Choose an item from the queue to inspect its evidence and draft.</p>
            </div>
          ) : isLoadingDetail || !detail ? (
            <div className="invoice-empty">Loading approval detail...</div>
          ) : (
            <div className="approval-detail">
              <div className="approval-detail-header">
                <div className="approval-detail-header-left">
                  <p className="eyebrow">{detail.kind.replace(/_/g, " ")}</p>
                  <h2>{detail.target_label || detail.summary_text || `Approval ${detail.id}`}</h2>
                  <div className="approval-detail-badges">
                    <span className="badge">{detail.run.workflow_name}</span>
                    <span className="badge">{detail.run.subject_type}</span>
                    <span className="badge">{detail.run.subject_id}</span>
                    {detail.reviewer ? <span className="badge">Reviewed by {detail.reviewer}</span> : null}
                  </div>
                </div>
                <span className={`approval-status approval-status-${detail.status}`}>{detail.status}</span>
              </div>

              <section className="approval-section">
                <h3 className="section-title">Facts</h3>
                <div className="facts-card">
                  <div className="fact-row">
                    <span className="fact-label">Summary</span>
                    <span>{detail.summary_text || "No summary available."}</span>
                  </div>
                  {"ticket" in detail.evidence ? (
                    <>
                      <div className="fact-row">
                        <span className="fact-label">Customer message</span>
                        <span>{asString((detail.evidence.ticket as Record<string, unknown>)?.message) || "Not provided"}</span>
                      </div>
                      <div className="fact-row">
                        <span className="fact-label">Subject</span>
                        <span>{asString((detail.evidence.ticket as Record<string, unknown>)?.subject) || "Untitled ticket"}</span>
                      </div>
                    </>
                  ) : null}
                  {policyFlags.length > 0 ? (
                    <div className="policy-flags-list">
                      {policyFlags.map((flag) => (
                        <span className="policy-flag" key={String(flag)}>{String(flag)}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="approval-section">
                <h3 className="section-title">
                  Evidence
                  <span className="section-count">{evidenceItems.length}</span>
                </h3>
                {evidenceItems.length > 0 ? (
                  <div className="evidence-list">
                    {evidenceItems.map((item, index) => {
                      const isExpanded = expandedEvidence.has(index);
                      const staffReply = asString(item.staff_reply);
                      const customerMsg = asString(item.customer_message);
                      const subject = asString(item.subject) || `Example ${index + 1}`;
                      return (
                        <div className="evidence-card" key={`${item.doc_id || "example"}-${index}`}>
                          <button
                            className="evidence-card-header"
                            onClick={() => toggleEvidence(index)}
                            type="button"
                          >
                            <h4>{subject}</h4>
                            <span className="evidence-toggle">{isExpanded ? "−" : "+"}</span>
                          </button>
                          {isExpanded ? (
                            <div className="evidence-card-body">
                              {customerMsg ? (
                                <div className="evidence-message evidence-customer">
                                  <span className="evidence-message-label">Customer</span>
                                  <p>{customerMsg}</p>
                                </div>
                              ) : null}
                              {staffReply ? (
                                <div className="evidence-message evidence-staff">
                                  <span className="evidence-message-label">Staff reply</span>
                                  <p>{staffReply}</p>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <p className="evidence-preview">{truncateText(staffReply || customerMsg, 2)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="invoice-empty">No matched examples stored for this approval.</div>
                )}
              </section>

              <section className="approval-section">
                <h3 className="section-title">Draft reply</h3>
                <textarea
                  className="draft-textarea"
                  disabled={detail.status !== "pending"}
                  rows={18}
                  value={draftReply}
                  onChange={(event) => setDraftReply(event.target.value)}
                  placeholder="Edit the draft reply before approving..."
                />
              </section>

              {detail.status === "pending" ? (
                <section className="approval-section approval-actions-section">
                  <div className="approval-actions-bar">
                    <button
                      className="button approve-btn"
                      type="button"
                      onClick={() => setShowConfirmApprove(true)}
                      disabled={busyAction !== null || !draftReply.trim()}
                    >
                      {busyAction === "approve" ? "Approving..." : "Approve and send"}
                    </button>
                    <button
                      className="button reject-btn"
                      type="button"
                      onClick={rejectCurrent}
                      disabled={busyAction !== null}
                    >
                      {busyAction === "reject" ? "Rejecting..." : "Reject"}
                    </button>
                  </div>

                  <div className="rejection-block">
                    <label className="rejection-label">Rejection reason</label>
                    <textarea
                      rows={4}
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      placeholder="Optional: explain why this draft is being rejected..."
                    />
                  </div>
                </section>
              ) : (
                <section className="approval-section">
                  <div className="review-meta-card">
                    <div className="review-meta-row">
                      <span className="fact-label">Reviewed at</span>
                      <span>{detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : "Unknown"}</span>
                    </div>
                    {detail.rejection_reason ? (
                      <div className="review-meta-row">
                        <span className="fact-label">Reason</span>
                        <span>{detail.rejection_reason}</span>
                      </div>
                    ) : null}
                  </div>
                </section>
              )}

              <section className="approval-section">
                <h3 className="section-title">Workflow steps</h3>
                <div className="workflow-steps">
                  {detail.steps.map((step, index) => (
                    <div className="workflow-step" key={step.id}>
                      <div className="workflow-step-indicator">
                        <span className="workflow-step-number">{index + 1}</span>
                        {index < detail.steps.length - 1 ? <span className="workflow-step-line" /> : null}
                      </div>
                      <div className="workflow-step-content">
                        <strong>{step.step_name}</strong>
                        <span className={`workflow-step-status workflow-step-status-${step.status}`}>{step.status}</span>
                        {step.error ? <p className="workflow-step-error">{step.error}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      </div>

      {showConfirmApprove ? (
        <div className="modal-backdrop" onClick={() => setShowConfirmApprove(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm approval</h3>
            <p>Are you sure you want to approve and send this reply{detail?.target_label ? ` for "${detail.target_label}"` : ""}?</p>
            <div className="confirm-modal-actions">
              <button className="button" type="button" onClick={() => setShowConfirmApprove(false)}>Cancel</button>
              <button className="button primary approve-btn" type="button" onClick={approveCurrent} disabled={busyAction !== null}>
                {busyAction === "approve" ? "Approving..." : "Yes, approve and send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
