import type { RiskTone } from "@/lib/types/shared";

export function normalizeTone(value: string | null | undefined): RiskTone {
  const normalized = (value || "").toLowerCase();
  if (["healthy", "low", "ok", "success", "approved", "done", "up", "running"].includes(normalized)) {
    return normalized === "running" ? "running" : "healthy";
  }
  if (["medium", "warning", "degraded", "review", "pending_on_others"].includes(normalized)) {
    return "warning";
  }
  if (["high", "critical", "urgent"].includes(normalized)) {
    return "critical";
  }
  if (["failed", "error", "rejected", "down"].includes(normalized)) {
    return "failed";
  }
  if (["pending", "draft", "needs_review", "inbox"].includes(normalized)) {
    return "pending";
  }
  return "unknown";
}

export function toneLabel(tone: RiskTone): string {
  switch (tone) {
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
    default:
      return "Signal unclear";
  }
}
