import { type ReactNode, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type EvidenceBlockProps = {
  label?: string;
  children: ReactNode;
  rawDetail?: ReactNode;
};

export function EvidenceBlock({ label = "Evidence", children, rawDetail }: EvidenceBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--spacing-sm) var(--spacing)"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--spacing-sm)"
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            fontWeight: 600,
            letterSpacing: "0.5px"
          }}
        >
          {label}
        </span>
        {rawDetail && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.75rem"
            }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? "Hide" : "Raw"}
          </button>
        )}
      </div>
      <div style={{ fontSize: "0.85rem" }}>{children}</div>
      {expanded && rawDetail && (
        <div
          style={{
            marginTop: "var(--spacing-sm)",
            paddingTop: "var(--spacing-sm)",
            borderTop: "1px solid var(--border)"
          }}
        >
          {rawDetail}
        </div>
      )}
    </div>
  );
}
