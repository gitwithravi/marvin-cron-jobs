import { Panel } from "@/components/ui/Panel";
import { type OpenRouterAccountUsage } from "@/lib/openrouter-usage";
import { formatNumber, formatPercent } from "@/lib/format";
import { DataList } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";

type OpenRouterUsagePanelProps = {
  usage: OpenRouterAccountUsage | null;
};

export function OpenRouterUsagePanel({ usage }: OpenRouterUsagePanelProps) {
  if (!usage) {
    return (
      <Panel>
        <EmptyState
          title="OpenRouter usage unavailable"
          message="Could not load usage data."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "var(--spacing)" }}>
        OpenRouter Usage
      </h3>

      <DataList
        items={[
          { label: "Total credits", value: formatNumber(usage.totalCredits, 2) },
          { label: "Used", value: formatNumber(usage.totalUsage, 2) },
          { label: "Remaining", value: formatNumber(usage.remainingCredits, 2) },
          { label: "Usage", value: formatPercent(usage.usagePercent) }
        ]}
      />

      <div
        style={{
          marginTop: "var(--spacing)",
          height: "8px",
          background: "var(--surface-3)",
          borderRadius: "4px",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${usage.usagePercent}%`,
            height: "100%",
            background: usage.usagePercent > 80 ? "var(--warning)" : "var(--accent)",
            transition: "width 0.3s"
          }}
        />
      </div>
    </Panel>
  );
}
