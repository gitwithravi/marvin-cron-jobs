import { type ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  summary?: string;
  action?: ReactNode;
};

export function SectionHeader({ eyebrow, title, summary, action }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "var(--spacing)",
        gap: "var(--spacing)"
      }}
    >
      <div>
        {eyebrow && <p className="eyebrow" style={{ marginBottom: "4px" }}>{eyebrow}</p>}
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{title}</h2>
        {summary && <p className="muted" style={{ fontSize: "0.85rem", marginTop: "4px" }}>{summary}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
