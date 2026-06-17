import { Panel } from "@/components/ui/Panel";
import { type AttentionItem } from "@/features/attention/getAttentionItems";
import { type TaskRun, type BeszelData } from "@/lib/api/types";

type PostureStripProps = {
  attentionItems: AttentionItem[];
  runs: TaskRun[];
  beszel: BeszelData | null;
};

export function PostureStrip({ attentionItems, runs, beszel }: PostureStripProps) {
  const criticalCount = attentionItems.filter(i => i.severity === "critical").length;
  const highCount = attentionItems.filter(i => i.severity === "high").length;
  const systemsUp = beszel ? beszel.systems.filter(s => s.status.toLowerCase() === "up").length : 0;
  const systemsTotal = beszel ? beszel.systems.length : 0;

  let message: string;
  let color: string;

  if (criticalCount > 0) {
    message = `On fire. ${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} need${criticalCount === 1 ? "s" : ""} immediate attention.`;
    color = "var(--critical)";
  } else if (highCount > 0) {
    message = `Mildly concerning. ${highCount} high-priority item${highCount > 1 ? "s" : ""} await${highCount === 1 ? "s" : ""} review.`;
    color = "var(--warning)";
  } else if (attentionItems.length > 0) {
    message = `Nothing is on fire. ${attentionItems.length} item${attentionItems.length > 1 ? "s" : ""} need${attentionItems.length === 1 ? "s" : ""} attention.`;
    color = "var(--accent)";
  } else {
    message = `Nothing is on fire. ${systemsTotal} system${systemsTotal !== 1 ? "s" : ""} checked. ${runs.length} recent task${runs.length !== 1 ? "s" : ""}.`;
    color = "var(--healthy)";
  }

  return (
    <Panel style={{ background: "var(--surface-2)" }}>
      <p style={{ fontSize: "0.9rem", color, fontWeight: 500 }}>
        {message}
      </p>
    </Panel>
  );
}
