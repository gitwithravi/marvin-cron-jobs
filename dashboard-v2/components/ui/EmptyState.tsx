import { type ReactNode } from "react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function EmptyState({ title, message, action, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--spacing-xl)",
        textAlign: "center",
        color: "var(--text-muted)"
      }}
    >
      <div style={{ marginBottom: "var(--spacing)", opacity: 0.5 }}>
        {icon || <Inbox size={40} />}
      </div>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 500, marginBottom: "var(--spacing-xs)" }}>
        {title}
      </h3>
      {message && (
        <p style={{ fontSize: "0.85rem", maxWidth: "320px", marginBottom: "var(--spacing)" }}>
          {message}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
