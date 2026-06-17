import type { TaskRun } from "@/lib/api/types";

export type RunFilters = {
  task: string;
  risk: string;
  status: string;
  hasSummary: string;
};

export function filterRuns(runs: TaskRun[], filters: RunFilters): TaskRun[] {
  return runs.filter((run) => {
    if (filters.task && run.task_name !== filters.task) return false;
    if (filters.risk && run.risk_level !== filters.risk) return false;
    if (filters.status && run.status !== filters.status) return false;
    if (filters.hasSummary === "yes" && !run.has_summary) return false;
    if (filters.hasSummary === "no" && run.has_summary) return false;
    return true;
  });
}

export function getUniqueValues(runs: TaskRun[], field: keyof TaskRun): string[] {
  const values = new Set<string>();
  runs.forEach((run) => {
    const value = run[field];
    if (value !== null && value !== undefined) {
      values.add(String(value));
    }
  });
  return Array.from(values).sort();
}
