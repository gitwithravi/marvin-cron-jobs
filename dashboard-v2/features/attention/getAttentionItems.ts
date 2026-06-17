import { marvinApiBaseUrl } from "@/lib/marvin-server";
import type { AlertDigest, Approval, TaskRun, Todo, BeszelData } from "@/lib/api/types";

export type AttentionItem = {
  id: string;
  kind: "alert" | "approval" | "run" | "todo" | "beszel";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  summary: string;
  evidence: string;
  updatedAt: string;
  href: string;
  actionLabel?: string;
};

function severityFromRisk(risk: string | null): AttentionItem["severity"] {
  if (!risk) return "low";
  const normalized = risk.toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

function severityFromStatus(status: string): AttentionItem["severity"] {
  const normalized = status.toLowerCase();
  if (normalized === "critical" || normalized === "failed") return "critical";
  if (normalized === "warning" || normalized === "error") return "high";
  if (normalized === "pending") return "medium";
  return "low";
}

export function alertToAttentionItem(alert: AlertDigest): AttentionItem {
  const hasCritical = alert.triggered_by.some(t => t.toLowerCase().includes("critical"));
  return {
    id: `alert-${alert.id}`,
    kind: "alert",
    severity: hasCritical ? "critical" : "high",
    title: "Alert Digest",
    summary: alert.digest_text.slice(0, 120),
    evidence: `${alert.triggered_by.length} trigger(s)`,
    updatedAt: alert.created_at,
    href: "/console/attention",
    actionLabel: "Review"
  };
}

export function approvalToAttentionItem(approval: Approval): AttentionItem {
  return {
    id: `approval-${approval.id}`,
    kind: "approval",
    severity: severityFromStatus(approval.status),
    title: approval.target_label,
    summary: approval.summary,
    evidence: `Status: ${approval.status}`,
    updatedAt: approval.updated_at,
    href: "/console/approvals",
    actionLabel: "Review"
  };
}

export function runToAttentionItem(run: TaskRun): AttentionItem {
  const isFailed = run.status.toLowerCase() === "failed";
  return {
    id: `run-${run.id}`,
    kind: "run",
    severity: isFailed ? "critical" : severityFromRisk(run.risk_level),
    title: run.task_name,
    summary: `Task ${isFailed ? "failed" : "completed"} with risk: ${run.risk_level || "unknown"}`,
    evidence: `Status: ${run.status}`,
    updatedAt: run.observed_at || run.started_at,
    href: `/console/runs/${encodeURIComponent(run.task_name)}?run=${run.id}`,
    actionLabel: "View run"
  };
}

export function todoToAttentionItem(todo: Todo): AttentionItem {
  const isUrgent = todo.priority?.toLowerCase() === "urgent" || todo.priority?.toLowerCase() === "high";
  return {
    id: `todo-${todo.id}`,
    kind: "todo",
    severity: isUrgent ? "high" : "medium",
    title: todo.title,
    summary: todo.waiting_person ? `Waiting on: ${todo.waiting_person}` : `Status: ${todo.status}`,
    evidence: todo.due_date ? `Due: ${todo.due_date}` : "No due date",
    updatedAt: todo.updated_at,
    href: "/console/work",
    actionLabel: "Open"
  };
}

export function beszelToAttentionItems(beszel: BeszelData): AttentionItem[] {
  const items: AttentionItem[] = [];

  beszel.alerts.filter(a => !a.resolved).forEach(alert => {
    items.push({
      id: `beszel-alert-${alert.id}`,
      kind: "beszel",
      severity: "high",
      title: `${alert.system_name}: ${alert.alert_type}`,
      summary: alert.message,
      evidence: `Triggered: ${alert.triggered_at}`,
      updatedAt: alert.triggered_at,
      href: "/console/systems",
      actionLabel: "View"
    });
  });

  beszel.systems.filter(s => s.status.toLowerCase() === "down").forEach(system => {
    items.push({
      id: `beszel-system-${system.name}`,
      kind: "beszel",
      severity: "critical",
      title: `${system.name} is down`,
      summary: "System status: down",
      evidence: `Last updated: ${system.last_updated}`,
      updatedAt: system.last_updated,
      href: "/console/systems",
      actionLabel: "View"
    });
  });

  return items;
}

const severityOrder: Record<AttentionItem["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

export async function getAttentionItems(): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  try {
    const [alertsRes, approvalsRes, runsRes, todosRes, beszelRes] = await Promise.allSettled([
      fetch(`${marvinApiBaseUrl()}/alerts/latest`, { cache: "no-store" }),
      fetch(`${marvinApiBaseUrl()}/approvals?view=pending`, { cache: "no-store" }),
      fetch(`${marvinApiBaseUrl()}/runs`, { cache: "no-store" }),
      fetch(`${marvinApiBaseUrl()}/todos?include_done=true`, { cache: "no-store" }),
      fetch(`${marvinApiBaseUrl()}/beszel`, { cache: "no-store" })
    ]);

    if (alertsRes.status === "fulfilled" && alertsRes.value.ok) {
      const alert = (await alertsRes.value.json()) as AlertDigest;
      if (alert?.id) {
        items.push(alertToAttentionItem(alert));
      }
    }

    if (approvalsRes.status === "fulfilled" && approvalsRes.value.ok) {
      const approvals = (await approvalsRes.value.json()) as Approval[];
      approvals.forEach(a => items.push(approvalToAttentionItem(a)));
    }

    if (runsRes.status === "fulfilled" && runsRes.value.ok) {
      const runs = (await runsRes.value.json()) as TaskRun[];
      runs.filter(r => r.status.toLowerCase() === "failed" || r.risk_level === "critical" || r.risk_level === "high")
        .forEach(r => items.push(runToAttentionItem(r)));
    }

    if (todosRes.status === "fulfilled" && todosRes.value.ok) {
      const todos = (await todosRes.value.json()) as Todo[];
      todos.filter(t => t.status.toLowerCase() !== "done" && (t.priority === "urgent" || t.priority === "high" || t.waiting_person))
        .forEach(t => items.push(todoToAttentionItem(t)));
    }

    if (beszelRes.status === "fulfilled" && beszelRes.value.ok) {
      const beszel = (await beszelRes.value.json()) as BeszelData;
      items.push(...beszelToAttentionItems(beszel));
    }
  } catch (err) {
    console.error("Error fetching attention items:", err);
  }

  return items.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
