import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExternalLink } from "lucide-react";

type StatusPagesPanelProps = {
  urls: string[];
};

export function StatusPagesPanel({ urls }: StatusPagesPanelProps) {
  if (urls.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No status pages configured"
          message="No public status pages are available."
        />
      </Panel>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing)" }}>
      {urls.map((url) => (
        <Panel key={url}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing)" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>Status Page</h3>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.8rem",
                color: "var(--accent)",
                textDecoration: "none"
              }}
            >
              <ExternalLink size={14} />
              Open
            </a>
          </div>
          <iframe
            src={url}
            style={{
              width: "100%",
              height: "400px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-2)"
            }}
            title="Status page"
          />
        </Panel>
      ))}
    </div>
  );
}
