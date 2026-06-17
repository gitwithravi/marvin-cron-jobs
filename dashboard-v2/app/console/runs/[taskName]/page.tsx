import { marvinApiBaseUrl } from "@/lib/marvin-server";
import type { TaskRunDetail } from "@/lib/api/types";
import Link from "next/link";
import { RunHeader } from "@/features/reports/RunHeader";
import { DeterministicAnalysisPanel } from "@/features/reports/DeterministicAnalysisPanel";
import { MarvinSummaryPanel } from "@/features/reports/MarvinSummaryPanel";
import { EvidencePanel } from "@/features/reports/EvidencePanel";
import { RawPayloadPanel } from "@/features/reports/RawPayloadPanel";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

type RunDetailPageProps = {
  params: Promise<{ taskName: string }>;
  searchParams: Promise<{ run?: string }>;
};

export default async function RunDetailPage({ params, searchParams }: RunDetailPageProps) {
  const { taskName } = await params;
  const { run: runId } = await searchParams;

  if (!runId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Run Detail</h1>
        <Panel>
          <EmptyState
            title="No run selected"
            message="Select a run from the runs list to view details."
          />
        </Panel>
      </div>
    );
  }

  let run: TaskRunDetail | null = null;

  try {
    const response = await fetch(
      `${marvinApiBaseUrl()}/runs/${runId}?task_name=${encodeURIComponent(taskName)}`,
      { cache: "no-store" }
    );
    if (response.ok) {
      run = await response.json();
    }
  } catch (err) {
    console.error("Error fetching run detail:", err);
  }

  if (!run) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Run Detail</h1>
        <Panel>
          <EmptyState
            title="Run not found"
            message="The requested run could not be loaded."
          />
        </Panel>
      </div>
    );
  }

  const deterministicAnalysis = run.deterministic_analysis_json as {
    summary?: string;
    notable_facts?: string[];
    recommended_actions?: string[];
  } | null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <div>
        <Link
          href="/console/runs"
          style={{ fontSize: "0.85rem", color: "var(--text-muted)", textDecoration: "none", marginBottom: "var(--spacing-sm)", display: "inline-block" }}
        >
          ← Back to runs
        </Link>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Run Detail</h1>
      </div>

      <RunHeader run={run} />

      <DeterministicAnalysisPanel analysis={deterministicAnalysis} />

      <MarvinSummaryPanel
        runId={run.id}
        taskName={taskName}
        initialSummary={run.summary_text}
      />

      <EvidencePanel factualPayload={run.factual_json} />

      <RawPayloadPanel run={run as unknown as Record<string, unknown>} />
    </div>
  );
}
