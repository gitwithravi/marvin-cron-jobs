import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { JsonBlock } from "@/components/ui/JsonBlock";
import { EmptyState } from "@/components/ui/EmptyState";

type RawPayloadPanelProps = {
  run: Record<string, unknown>;
};

export function RawPayloadPanel({ run }: RawPayloadPanelProps) {
  if (!run || Object.keys(run).length === 0) {
    return (
      <Panel>
        <SectionHeader eyebrow="Raw data" title="Raw payload" />
        <EmptyState
          title="No raw data"
          message="This run has no raw payload."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <SectionHeader eyebrow="Raw data" title="Raw payload" />
      <JsonBlock data={run} label="JSON" defaultExpanded={false} />
    </Panel>
  );
}
