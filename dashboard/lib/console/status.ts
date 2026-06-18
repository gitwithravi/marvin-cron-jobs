export type ConsoleStatusTone =
  | "healthy"
  | "warning"
  | "critical"
  | "failed"
  | "pending"
  | "running"
  | "approved"
  | "rejected"
  | "neutral";

export function normalizeConsoleTone(value: string | null | undefined): ConsoleStatusTone {
  switch ((value || "").toLowerCase()) {
    case "healthy":
    case "low":
    case "completed":
    case "done":
      return "healthy";
    case "warning":
    case "medium":
    case "degraded":
      return "warning";
    case "critical":
    case "high":
      return "critical";
    case "failed":
    case "error":
    case "cancelled":
      return "failed";
    case "pending":
    case "waiting_approval":
      return "pending";
    case "running":
    case "in_progress":
      return "running";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    default:
      return "neutral";
  }
}

export function statusDisplayLabel(value: string | null | undefined): string {
  switch (normalizeConsoleTone(value)) {
    case "healthy":
      return "Nothing is on fire";
    case "warning":
      return "Mildly concerning";
    case "critical":
      return "On fire";
    case "failed":
      return "Predictably broken";
    case "pending":
      return "Awaiting human ceremony";
    case "running":
      return "Thinking, tragically";
    case "approved":
      return "Human approved";
    case "rejected":
      return "Human showed restraint";
    default:
      return value || "Signal unclear";
  }
}
