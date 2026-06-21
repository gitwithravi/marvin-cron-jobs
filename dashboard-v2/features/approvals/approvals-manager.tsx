"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

type RunSummary = {
  status: string;
};

type ApprovalSummary = {
  id: number;
  kind: string;
  target_label: string | null;
  summary_text: string | null;
  draft_content: Record<string, unknown>;
  edited_content: Record<string, unknown>;
  evidence: Record<string, unknown>;
  status: string;
  rejection_reason: string | null;
  updated_at: string;
  run: RunSummary;
};

type ApprovalDetail = ApprovalSummary & {
  steps: Array<{
    id: number;
    step_name: string;
    status: string;
    error: string | null;
  }>;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

export function ApprovalsManager() {
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [draftReply, setDraftReply] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [view, setView] = useState<"pending" | "history">("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function loadApprovals(nextView: "pending" | "history") {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetch(`/api/approvals?view=${nextView}`).then(readJson);
      const nextApprovals = (data.approvals || []) as ApprovalSummary[];
      setApprovals(nextApprovals);
      setSelectedId(nextApprovals[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setApprovals([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDetail(approvalId: number) {
    setIsDetailLoading(true);
    setError("");
    try {
      const data = await fetch(`/api/approvals/${approvalId}`).then(readJson);
      const approval = data.approval as ApprovalDetail;
      setDetail(approval);
      setDraftReply(asString(approval.edited_content.reply) || asString(approval.draft_content.reply));
      setRejectionReason(approval.rejection_reason || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals(view);
  }, [view]);

  useEffect(() => {
    if (selectedId !== null) {
      loadDetail(selectedId);
    }
  }, [selectedId]);

  const selectedApproval = useMemo(
    () => approvals.find((approval) => approval.id === selectedId) || null,
    [approvals, selectedId]
  );

  async function handleApprove() {
    if (!detail) {
      return;
    }
    setBusyAction("approve");
    setError("");
    try {
      await fetch(`/api/approvals/${detail.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final_reply: draftReply })
      }).then(readJson);
      await loadApprovals(view);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject() {
    if (!detail) {
      return;
    }
    setBusyAction("reject");
    setError("");
    try {
      await fetch(`/api/approvals/${detail.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim() || undefined })
      }).then(readJson);
      await loadApprovals(view);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="gap-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Approval queue</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={view === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("pending")}
              >
                Pending
              </Button>
              <Button
                variant={view === "history" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("history")}
              >
                History
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[70vh]">
            <div className="space-y-2 p-3">
              {isLoading ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">Loading approvals...</p>
              ) : approvals.length === 0 ? (
                <EmptyState
                  title="No approvals"
                  description="Nothing currently awaits human ceremony."
                />
              ) : (
                approvals.map((approval) => (
                  <button
                    key={approval.id}
                    type="button"
                    onClick={() => setSelectedId(approval.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      selectedId === approval.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/60 bg-black/10 hover:border-primary/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {approval.summary_text || approval.target_label || `Approval #${approval.id}`}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{approval.kind}</p>
                      </div>
                      <StatusBadge value={approval.status || approval.run?.status} />
                    </div>
                    <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {timeAgo(approval.updated_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedApproval?.summary_text || selectedApproval?.target_label || "Approval detail"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {isDetailLoading ? (
            <p className="text-sm text-muted-foreground">Loading approval detail...</p>
          ) : detail ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <StatusBadge value={detail.status} />
                <span>{detail.kind}</span>
                <span>{formatDateTime(detail.updated_at)}</span>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Draft response</h3>
                <Textarea
                  value={draftReply}
                  onChange={(event) => setDraftReply(event.target.value)}
                  className="min-h-56"
                />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Evidence</h3>
                <pre className="overflow-x-auto rounded-lg border border-border/60 bg-black/20 p-4 text-xs">
                  <code>{JSON.stringify(detail.evidence, null, 2)}</code>
                </pre>
              </div>
              {detail.steps.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-medium">Workflow steps</h3>
                  <div className="space-y-2">
                    {detail.steps.map((step) => (
                      <div key={step.id} className="rounded-lg border border-border/60 bg-black/10 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{step.step_name}</span>
                          <StatusBadge value={step.status} />
                        </div>
                        {step.error ? (
                          <p className="mt-2 text-sm text-red-200">{step.error}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <Button onClick={handleApprove} disabled={busyAction !== null}>
                  <Check className="size-4" />
                  {busyAction === "approve" ? "Approving..." : "Approve"}
                </Button>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Optional rejection reason"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    className="min-h-24"
                  />
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={busyAction !== null}
                    className="w-full"
                  >
                    <X className="size-4" />
                    {busyAction === "reject" ? "Rejecting..." : "Reject"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title="No approval selected"
              description="Choose a queue item to inspect the draft, evidence, and workflow steps."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
