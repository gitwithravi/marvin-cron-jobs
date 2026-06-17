import { Panel } from "@/components/ui/Panel";
import { type AttentionItem } from "@/features/attention/getAttentionItems";
import { type TaskRun, type BeszelData } from "@/lib/api/types";

type PostureStripProps = {
  attentionItems: AttentionItem[];
  runs: TaskRun[];
  beszel: BeszelData | null;
  apiAvailable: boolean;
};

export function PostureStrip({ attentionItems, runs, beszel, apiAvailable }: PostureStripProps) {
  const criticalCount = attentionItems.filter(i => i.severity === "critical").length;
  const highCount = attentionItems.filter(i => i.severity === "high").length;
  const systemsTotal = beszel ? beszel.systems.length : 0;
  const systemsDown = beszel ? beszel.systems.filter(s => s.status.toLowerCase() === "down").length : 0;

  const runRiskCritical = runs.filter(r => r.risk_level?.toLowerCase() === "critical").length;
  const runRiskHigh = runs.filter(r => r.risk_level?.toLowerCase() === "high").length;
  const runFailed = runs.filter(r => r.status?.toLowerCase() === "failed").length;
  const runCompleted = runs.filter(r => r.status?.toLowerCase() === "completed").length;

  let message: string;
  let color: string;

  if (systemsDown > 0) {
    message = `On fire. ${systemsDown} system${systemsDown > 1 ? "s" : ""} down. ${criticalCount > 0 ? `${criticalCount} critical issue${criticalCount > 1 ? "s" : ""}.` : ""}`;
    color = "var(--critical)";
  } else if (criticalCount > 0 || runRiskCritical > 0 || runFailed > 0) {
    message = `On fire. ${criticalCount > 0 ? `${criticalCount} critical attention item${criticalCount > 1 ? "s" : ""}. ` : ""}${runRiskCritical > 0 ? `${runRiskCritical} critical run${runRiskCritical > 1 ? "s" : ""}. ` : ""}${runFailed > 0 ? `${runFailed} failed run${runFailed > 1 ? "s" : ""}.` : ""}`;
    color = "var(--critical)";
  } else if (highCount > 0 || runRiskHigh > 0) {
    message = `Mildly concerning. ${highCount > 0 ? `${highCount} high-priority item${highCount > 1 ? "s" : ""}. ` : ""}${runRiskHigh > 0 ? `${runRiskHigh} high-risk run${runRiskHigh > 1 ? "s" : ""}.` : ""}`;
    color = "var(--warning)";
  } else if (attentionItems.length > 0) {
    message = `${attentionItems.length} item${attentionItems.length > 1 ? "s" : ""} need${attentionItems.length === 1 ? "s" : ""} attention. ${runCompleted} completed run${runCompleted !== 1 ? "s" : ""}.`;
    color = "var(--accent)";
  } else if (!apiAvailable && runs.length === 0) {
    message = "MARVIN API is unavailable. Posture unknown.";
    color = "var(--failed)";
  } else {
    message = `Nothing is on fire. ${systemsTotal} system${systemsTotal !== 1 ? "s" : ""} checked. ${runs.length} recent run${runs.length !== 1 ? "s" : ""}.`;
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
