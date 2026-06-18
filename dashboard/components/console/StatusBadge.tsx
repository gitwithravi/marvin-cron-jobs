import { normalizeConsoleTone, statusDisplayLabel } from "@/lib/console/status";

export function StatusBadge({
  status,
  compact = false
}: {
  status: string | null | undefined;
  compact?: boolean;
}) {
  const tone = normalizeConsoleTone(status);

  return (
    <span className={compact ? `console-status-badge compact tone-${tone}` : `console-status-badge tone-${tone}`}>
      {statusDisplayLabel(status)}
    </span>
  );
}
