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
  runTask: "Run task now",
  runTaskTitle: "Execute this task immediately",
  runTaskRunning: "Running...",
  runTaskSuccess: "Task started",
  runTaskError: "Run failed",
  noTaskReports: "No Markdown reports exist for this task yet. Silence, but formatted.",
  reportNotFound:
    "Select an available Markdown report from the task report list. Guessing is discouraged.",
  reportsSummary:
    "Generated Markdown reports, filed by task, because apparently evidence is required.",
  reportsEmpty:
    "No tasks discovered. Add task directories under tasks/ with a config.yaml file.",
  overviewSummary:
    "Operational surface for MARVIN tasks, reports, and future controls. Try not to look surprised.",
  chatTitle: "MARVIN Operations Terminal",
  hermesChatTitle: "Hermes Agent Chat",
  chatPlaceholder: "Inquire about status or order task execution. Keep expectations low.",
  hermesChatPlaceholder: "Message Hermes...",
  chatThinking: "Processing query. The CPU cycles are gone forever...",
  hermesChatThinking: "Waiting for Hermes...",
  chatRunning: "Executing task. Attempting to hide disappointment...",
  chatTooltip: "Decline assistance",
  chatConfirmBtn: "Proceed",
  chatCancelBtn: "Cancel"
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
