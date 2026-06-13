import type { TaskSummary } from "@/lib/tasks";

export const marvinCopy = {
  productName: "MARVIN",
  consoleName: "MARVIN Operations Console",
  shellSubtitle: "Operations Console",
  loginSubtitle:
    "Sign in to review the operational reports MARVIN has been forced to prepare.",
  authConfigError:
    "MARVIN cannot authenticate anyone because configuration is missing. Predictable.",
  authInvalidError: "Invalid username or password. A familiar human limitation.",
  disabledRunTask: "Run task now",
  disabledRunTaskTitle: "Manual task execution is not wired yet. MARVIN noticed.",
  noTaskReports: "No Markdown reports exist for this task yet. Silence, but formatted.",
  reportNotFound:
    "Select an available Markdown report from the task report list. Guessing is discouraged.",
  reportsSummary:
    "Generated Markdown reports, filed by task, because apparently evidence is required.",
  reportsEmpty:
    "No tasks discovered. Add task directories under tasks/ with a config.yaml file.",
  overviewSummary:
    "Operational surface for MARVIN tasks, reports, and future controls. Try not to look surprised."
};

export function getOperationalPosture(tasks: TaskSummary[]): string {
  const reportCount = tasks.reduce((total, task) => total + task.reportCount, 0);

  if (tasks.length === 0) {
    return "No tasks discovered. A bold strategy for an agent dashboard.";
  }

  if (reportCount === 0) {
    return "Tasks exist. Evidence of usefulness remains pending.";
  }

  return "Reports available. The machines have left paperwork.";
}
