import { type RiskLevel } from "@/lib/risk";

type RiskBadgeProps = {
  risk: RiskLevel;
};

const riskColors: Record<RiskLevel, string> = {
  low: "var(--healthy)",
  medium: "var(--warning)",
  high: "var(--critical)",
  critical: "var(--critical)",
  unknown: "var(--text-faint)"
};

const riskLabels: Record<RiskLevel, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
  unknown: "—"
};

export function RiskBadge({ risk }: RiskBadgeProps) {
  const color = riskColors[risk];
  const label = riskLabels[risk];

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.7rem",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        letterSpacing: "0.5px",
        color: color,
        padding: "2px 6px",
        border: `1px solid ${color}`,
        borderRadius: "var(--radius-sm)"
      }}
    >
      {label}
    </span>
  );
}
