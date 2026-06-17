import { type MarvinStatus, getStatusLabel } from "@/lib/status";

type StatusBadgeProps = {
  status: MarvinStatus;
  showLabel?: boolean;
};

const statusColors: Record<MarvinStatus, string> = {
  healthy: "var(--healthy)",
  warning: "var(--warning)",
  critical: "var(--critical)",
  failed: "var(--failed)",
  pending: "var(--pending)",
  running: "var(--running)",
  approved: "var(--healthy)",
  rejected: "var(--critical)"
};

export function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const color = statusColors[status];
  const label = getStatusLabel(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "0.75rem",
        fontFamily: "var(--font-mono)",
        color: color
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color
        }}
      />
      {showLabel && label}
    </span>
  );
}
