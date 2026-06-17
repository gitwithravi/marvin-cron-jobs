export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

export function normalizeRisk(value: string | null | undefined): RiskLevel {
  if (!value) return "unknown";
  const normalized = value.toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "critical") {
    return normalized;
  }
  return "unknown";
}

export function riskSeverity(risk: RiskLevel): number {
  const severity: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
    unknown: -1
  };
  return severity[risk];
}
