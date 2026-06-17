import { Panel } from "@/components/ui/Panel";
import { type AttentionItem } from "@/features/attention/getAttentionItems";
import { Button } from "@/components/ui/Button";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { DataList } from "@/components/ui/DataList";
import { formatDateTime } from "@/lib/time";
import { AlertCircle, CheckSquare, Activity, Briefcase, Server, ExternalLink } from "lucide-react";

type AttentionDetailProps = {
  item: AttentionItem | null;
};

const kindIcons = {
  alert: AlertCircle,
  approval: CheckSquare,
  run: Activity,
  todo: Briefcase,
  beszel: Server
};

const kindLabels = {
  alert: "Alert",
  approval: "Approval",
  run: "Task Run",
  todo: "Todo",
  beszel: "System"
};

const severityColors = {
  critical: "var(--critical)",
  high: "var(--warning)",
  medium: "var(--pending)",
  low: "var(--text-muted)"
};

export function AttentionDetail({ item }: AttentionDetailProps) {
  if (!item) {
    return (
      <Panel style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
        <p style={{ fontSize: "0.9rem" }}>Select an item to view details</p>
      </Panel>
    );
  }

  const Icon = kindIcons[item.kind];

  return (
    <Panel style={{ overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", marginBottom: "var(--spacing-sm)" }}>
            <Icon size={20} style={{ color: severityColors[item.severity] }} />
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{item.title}</h2>
          </div>
          <div style={{ display: "flex", gap: "var(--spacing-sm)", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            <span>{kindLabels[item.kind]}</span>
            <span>•</span>
            <span style={{ color: severityColors[item.severity], textTransform: "uppercase" }}>{item.severity}</span>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
            Conclusion
          </h3>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>{item.summary}</p>
        </div>

        <EvidenceBlock label="Evidence">
          <p style={{ fontSize: "0.85rem" }}>{item.evidence}</p>
        </EvidenceBlock>

        <DataList
          items={[
            { label: "Updated", value: formatDateTime(item.updatedAt) },
            { label: "Source", value: kindLabels[item.kind] }
          ]}
        />

        {item.actionLabel && (
          <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
            <Button variant="primary" icon={<ExternalLink size={16} />}>
              <a href={item.href} style={{ color: "inherit", textDecoration: "none" }}>
                {item.actionLabel}
              </a>
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
