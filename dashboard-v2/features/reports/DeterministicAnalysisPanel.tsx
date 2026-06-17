import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type DeterministicAnalysis = {
  summary?: string;
  notable_facts?: string[];
  recommended_actions?: string[];
};

type DeterministicAnalysisPanelProps = {
  analysis: DeterministicAnalysis | null;
};

export function DeterministicAnalysisPanel({ analysis }: DeterministicAnalysisPanelProps) {
  if (!analysis) {
    return (
      <Panel>
        <SectionHeader eyebrow="Analysis" title="Deterministic analysis" />
        <EmptyState
          title="No deterministic analysis"
          message="This run did not produce a deterministic analysis."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <SectionHeader eyebrow="Analysis" title="Deterministic analysis" />

      {analysis.summary && (
        <div style={{ marginBottom: "var(--spacing)" }}>
          <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
            Summary
          </h4>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>{analysis.summary}</p>
        </div>
      )}

      {analysis.notable_facts && analysis.notable_facts.length > 0 && (
        <div style={{ marginBottom: "var(--spacing)" }}>
          <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
            Notable facts
          </h4>
          <ul style={{ paddingLeft: "20px", fontSize: "0.9rem", lineHeight: 1.6 }}>
            {analysis.notable_facts.map((fact, i) => (
              <li key={i} style={{ marginBottom: "4px" }}>{fact}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.recommended_actions && analysis.recommended_actions.length > 0 && (
        <div>
          <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
            Recommended actions
          </h4>
          <ul style={{ paddingLeft: "20px", fontSize: "0.9rem", lineHeight: 1.6 }}>
            {analysis.recommended_actions.map((action, i) => (
              <li key={i} style={{ marginBottom: "4px" }}>{action}</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
