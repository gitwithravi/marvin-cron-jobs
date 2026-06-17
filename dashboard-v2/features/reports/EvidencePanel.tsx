import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { EmptyState } from "@/components/ui/EmptyState";

type EvidencePanelProps = {
  factualPayload: Record<string, unknown> | null;
};

export function EvidencePanel({ factualPayload }: EvidencePanelProps) {
  if (!factualPayload || Object.keys(factualPayload).length === 0) {
    return (
      <Panel>
        <SectionHeader eyebrow="Evidence" title="Factual payload" />
        <EmptyState
          title="No evidence recorded"
          message="This run did not collect any factual payload."
        />
      </Panel>
    );
  }

  const entries = Object.entries(factualPayload);

  return (
    <Panel>
      <SectionHeader eyebrow="Evidence" title="Factual payload" />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
        {entries.map(([key, value]) => (
          <EvidenceBlock key={key} label={key}>
            <pre style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)", overflow: "auto", margin: 0 }}>
              {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
            </pre>
          </EvidenceBlock>
        ))}
      </div>
    </Panel>
  );
}
