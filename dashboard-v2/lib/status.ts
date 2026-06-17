export type MarvinStatus =
  | "healthy"
  | "warning"
  | "critical"
  | "failed"
  | "pending"
  | "running"
  | "approved"
  | "rejected";

const statusLabels: Record<MarvinStatus, string> = {
  healthy: "Nothing is on fire",
  warning: "Mildly concerning",
  critical: "On fire",
  failed: "Predictably broken",
  pending: "Awaiting human ceremony",
  running: "Thinking, tragically",
  approved: "Human approved",
  rejected: "Human showed restraint"
};

export function getStatusLabel(status: MarvinStatus): string {
  return statusLabels[status] || status;
}

export function normalizeStatus(value: string | null | undefined): MarvinStatus {
  if (!value) return "pending";
  const normalized = value.toLowerCase();
  if (normalized in statusLabels) {
    return normalized as MarvinStatus;
  }
  if (normalized === "success" || normalized === "ok" || normalized === "up") {
    return "healthy";
  }
  if (normalized === "error" || normalized === "down") {
    return "failed";
  }
  return "pending";
}
