import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CommandPage() {
  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "var(--spacing-lg)" }}>
        Command
      </h1>
      <Panel>
        <EmptyState
          title="Command Center"
          message="This is the foundation for the command center. Screens will be built incrementally."
        />
      </Panel>
    </div>
  );
}
