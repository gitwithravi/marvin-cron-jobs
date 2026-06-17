import { Panel } from "@/components/ui/Panel";
import { type AttentionItem } from "@/features/attention/getAttentionItems";
import { formatRelativeTime } from "@/lib/time";
import { AlertCircle, CheckSquare, Activity, Briefcase, Server } from "lucide-react";

type AttentionPreviewProps = {
  items: AttentionItem[];
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

export function AttentionPreview({ items }: AttentionPreviewProps) {
  if (items.length === 0) {
    return (
      <Panel>
        <div style={{ textAlign: "center", padding: "var(--spacing-lg)", color: "var(--text-muted)" }}>
          <p style={{ fontSize: "0.9rem" }}>No pending decisions. A rare moment of peace. Don&apos;t get attached.</p>
        </div>
      </Panel>
    );
  }

  const preview = items.slice(0, 5);

  return (
    <Panel>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "var(--spacing)" }}>
        Attention Queue
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
        {preview.map((item) => {
          const Icon = kindIcons[item.kind];
          return (
            <a
              key={item.id}
              href={item.href}
              style={{
                display: "flex",
                gap: "var(--spacing-sm)",
                padding: "var(--spacing-sm)",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-2)",
                textDecoration: "none",
                transition: "background 0.15s"
              }}
            >
              <Icon size={16} style={{ color: severityColors[item.severity], flexShrink: 0, marginTop: "2px" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--spacing-sm)" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                    {formatRelativeTime(item.updatedAt)}
                  </span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.summary}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                    {item.evidence}
                  </span>
                  {item.actionLabel && (
                    <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>
                      {item.actionLabel} →
                    </span>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
      {items.length > 5 && (
        <a
          href="/console/attention"
          style={{
            display: "block",
            textAlign: "center",
            marginTop: "var(--spacing)",
            fontSize: "0.85rem",
            color: "var(--accent)"
          }}
        >
          View all {items.length} items →
        </a>
      )}
    </Panel>
  );
}
