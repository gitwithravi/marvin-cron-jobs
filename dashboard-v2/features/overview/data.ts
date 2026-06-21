import { fetchMarvinApi } from "@/lib/server/fetchers";
import { getOpenRouterAccountUsage } from "@/lib/server/openrouter-usage";
import { getTasks, type TaskSummary } from "@/lib/server/tasks";
import { consoleRoutes } from "@/lib/routes";
import { normalizeTone } from "@/lib/utils/status";

type AlertSnapshot = {
  created_at?: string;
  message?: string;
};

type ApprovalSummary = {
  id: number;
  kind?: string;
  status?: string;
  summary_text?: string;
  updated_at?: string;
  run?: {
    status?: string;
  };
};

type ApprovalListResponse = {
  approvals?: ApprovalSummary[];
};

export type ConsoleOverviewTask = {
  taskName: string;
  displayName: string;
  href: string;
  status: string;
  conclusion: string;
  lastRun: string | null;
  reportCount: number;
};

export type ConsoleOverviewData = {
  headline: string;
  alertMessage: string;
  alertUpdatedAt: string | null;
  pendingApprovals: ApprovalSummary[];
  latestTasks: ConsoleOverviewTask[];
  secondaryTasks: ConsoleOverviewTask[];
  spend:
    | {
        remainingCredits: number;
        usagePercent: number;
      }
    | null;
};

function riskWeight(riskLevel: string | null): number {
  switch (normalizeTone(riskLevel)) {
    case "critical":
      return 5;
    case "failed":
      return 4;
    case "warning":
      return 3;
    case "pending":
      return 2;
    case "healthy":
      return 1;
    default:
      return 0;
  }
}

function sortTasksByUrgency(tasks: TaskSummary[]): TaskSummary[] {
  return [...tasks].sort((left, right) => {
    const byRisk = riskWeight(right.riskLevel) - riskWeight(left.riskLevel);
    if (byRisk !== 0) {
      return byRisk;
    }
    return (right.latestReport?.modifiedAt || "").localeCompare(left.latestReport?.modifiedAt || "");
  });
}

function taskConclusion(task: TaskSummary): string {
  if (!task.latestReport) {
    return "No runs yet. Evidence remains pending.";
  }

  switch (normalizeTone(task.riskLevel)) {
    case "critical":
      return "Latest run indicates a critical operational issue.";
    case "warning":
      return "Latest run indicates a degraded or worsening condition.";
    case "healthy":
      return "Latest run completed without notable risk.";
    default:
      return "Latest run is available for inspection.";
  }
}

function buildHeadline(tasks: TaskSummary[], pendingApprovals: ApprovalSummary[]): string {
  const criticalCount = tasks.filter((task) => normalizeTone(task.riskLevel) === "critical").length;
  const warningCount = tasks.filter((task) => normalizeTone(task.riskLevel) === "warning").length;

  if (criticalCount > 0) {
    return `${criticalCount} systems are on fire. ${pendingApprovals.length} approval${pendingApprovals.length === 1 ? "" : "s"} still require human ceremony.`;
  }
  if (pendingApprovals.length > 0) {
    return `Nothing is on fire. ${pendingApprovals.length} approval${pendingApprovals.length === 1 ? "" : "s"} still require human ceremony.`;
  }
  if (warningCount > 0) {
    return `${warningCount} task${warningCount === 1 ? "" : "s"} are mildly concerning. No immediate approvals are blocking automation.`;
  }
  return "Nothing is on fire. MARVIN has paperwork, not panic.";
}

export async function getConsoleOverviewData(): Promise<ConsoleOverviewData> {
  const tasks = await getTasks();
  const [pendingApprovalsResult, alertResult, usageResult] = await Promise.allSettled([
    fetchMarvinApi<ApprovalListResponse>("/approvals?view=pending"),
    fetchMarvinApi<AlertSnapshot>("/alerts/latest"),
    getOpenRouterAccountUsage()
  ]);

  const pendingApprovals =
    pendingApprovalsResult.status === "fulfilled" ? pendingApprovalsResult.value.approvals || [] : [];
  const alert =
    alertResult.status === "fulfilled"
      ? alertResult.value
      : { message: "Latest alert could not be loaded.", created_at: null };
  const usage =
    usageResult.status === "fulfilled" && usageResult.value.ok ? usageResult.value.usage : null;

  const prioritized = sortTasksByUrgency(tasks).map((task) => ({
    taskName: task.taskName,
    displayName: task.displayName,
    href: task.latestReport?.href || `${consoleRoutes.reports}/${encodeURIComponent(task.taskName)}`,
    status: task.riskLevel || "unknown",
    conclusion: taskConclusion(task),
    lastRun: task.latestReport?.modifiedAt || null,
    reportCount: task.reportCount
  }));

  return {
    headline: buildHeadline(tasks, pendingApprovals),
    alertMessage: alert.message || "Latest alert has not been generated yet. Tranquility may be temporary.",
    alertUpdatedAt: alert.created_at || null,
    pendingApprovals: pendingApprovals.slice(0, 5),
    latestTasks: prioritized.slice(0, 4),
    secondaryTasks: prioritized.slice(4),
    spend: usage
      ? {
          remainingCredits: usage.remainingCredits,
          usagePercent: usage.usagePercent
        }
      : null
  };
}
