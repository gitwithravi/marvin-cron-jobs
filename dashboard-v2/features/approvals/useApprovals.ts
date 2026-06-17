"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api/client";
import type { Approval, ApprovalDetail } from "@/lib/api/types";

type UseApprovalsReturn = {
  pendingApprovals: Approval[];
  historyApprovals: Approval[];
  selectedApproval: ApprovalDetail | null;
  loading: boolean;
  error: string | null;
  selectApproval: (id: number) => void;
  refresh: () => void;
  approve: (id: number, comment?: string) => Promise<void>;
  reject: (id: number, reason?: string) => Promise<void>;
};

export function useApprovals(): UseApprovalsReturn {
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [historyApprovals, setHistoryApprovals] = useState<Approval[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovals = useCallback(async (view: "pending" | "history") => {
    try {
      const response = await apiFetch<{ approvals: Approval[] }>(
        `/api/approvals?view=${view}`
      );
      return response.approvals || [];
    } catch (err) {
      console.error(`Error fetching ${view} approvals:`, err);
      return [];
    }
  }, []);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pending, history] = await Promise.all([
        fetchApprovals("pending"),
        fetchApprovals("history")
      ]);
      setPendingApprovals(pending);
      setHistoryApprovals(history);
    } catch {
      setError("Failed to load approvals.");
    } finally {
      setLoading(false);
    }
  }, [fetchApprovals]);

  const selectApproval = useCallback(async (id: number) => {
    try {
      const response = await apiFetch<{ approval: ApprovalDetail }>(
        `/api/approvals/${id}`
      );
      setSelectedApproval(response.approval);
    } catch {
      setError("Failed to load approval detail.");
    }
  }, []);

  const approve = useCallback(async (id: number, comment?: string) => {
    try {
      await apiFetch(`/api/approvals/${id}/approve`, {
        method: "POST",
        body: { comment }
      });
      await loadApprovals();
      setSelectedApproval(null);
    } catch (err) {
      setError("Failed to approve.");
      throw err;
    }
  }, [loadApprovals]);

  const reject = useCallback(async (id: number, reason?: string) => {
    try {
      await apiFetch(`/api/approvals/${id}/reject`, {
        method: "POST",
        body: { reason }
      });
      await loadApprovals();
      setSelectedApproval(null);
    } catch (err) {
      setError("Failed to reject.");
      throw err;
    }
  }, [loadApprovals]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  return {
    pendingApprovals,
    historyApprovals,
    selectedApproval,
    loading,
    error,
    selectApproval,
    refresh: loadApprovals,
    approve,
    reject
  };
}
