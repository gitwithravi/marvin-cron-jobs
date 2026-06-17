import { type AttentionItem } from "@/features/attention/getAttentionItems";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { formatRelativeTime } from "@/lib/time";
import { AlertCircle, CheckSquare, Activity, Briefcase, Server } from "lucide-react";

type AttentionItemCardProps = {
  item: AttentionItem;
  selected: boolean;
  onClick: () => void;
};

const kindIcons = {
  alert: AlertCircle,
  approval: CheckSquare,
  run: Activity,
  todo: Briefcase,
  beszel: Server
};

const severityColors = {
  critical: "var(--critical)",
  high: "var(--warning)",
  medium: "var(--pending)",
  low: "var(--text-muted)"
};

export function AttentionItemCard({ item, selected, onClick }: AttentionItemCardProps) {
  const Icon = kindIcons[item.kind];

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        display: "flex",
        gap: "var(--spacing-sm)",
        padding: "var(--spacing-sm)",
        borderRadius: "var(--radius-sm)",
        background: selected ? "var(--surface-3)" : "var(--surface-2)",
        border: selected ? "1px solid var(--accent)" : "1px solid transparent",
        cursor: "pointer",
        transition: "background 0.15s, border 0.15s"
      }}
    >
      <Icon size={16} style={{ color: severityColors[item.severity], flexShrink: 0, marginTop: "2px" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--spacing-sm)", marginBottom: "4px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>
            {item.title}
          </span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
            {formatRelativeTime(item.updatedAt)}
          </span>
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "4px" }}>
          {item.summary}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
            {item.evidence}
          </span>
          {item.actionLabel && (
            <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>
              {item.actionLabel}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
