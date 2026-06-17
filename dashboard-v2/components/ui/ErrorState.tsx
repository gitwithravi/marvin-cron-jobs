import { AlertTriangle } from "lucide-react";

type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({ title = "Error", message }: ErrorStateProps) {
  return (
    <div
      style={{
        background: "rgba(239, 99, 81, 0.08)",
        border: "1px solid var(--critical)",
        borderRadius: "var(--radius)",
        padding: "var(--spacing)",
        display: "flex",
        gap: "var(--spacing-sm)",
        alignItems: "flex-start"
      }}
    >
      <AlertTriangle size={18} style={{ color: "var(--critical)", flexShrink: 0, marginTop: "2px" }} />
      <div>
        <h3 style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--critical)", marginBottom: "4px" }}>
          {title}
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{message}</p>
      </div>
    </div>
  );
}
