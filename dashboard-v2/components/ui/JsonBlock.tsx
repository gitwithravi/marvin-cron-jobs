"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type JsonBlockProps = {
  data: unknown;
  label?: string;
  defaultExpanded?: boolean;
};

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null) {
    return <span style={{ color: "var(--text-faint)" }}>null</span>;
  }
  if (typeof value === "boolean") {
    return <span style={{ color: "var(--warning)" }}>{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span style={{ color: "var(--accent)" }}>{value}</span>;
  }
  if (typeof value === "string") {
    return <span>{`"${value}"`}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>[]</span>;
    return (
      <span>
        [
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: "16px" }}>
            <JsonValue value={item} depth={depth + 1} />
            {i < value.length - 1 && ","}
          </div>
        ))}
        ]
      </span>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span>{"{}"}</span>;
    return (
      <span>
        {"{"}
        {entries.map(([key, val], i) => (
          <div key={key} style={{ paddingLeft: "16px" }}>
            <span style={{ color: "var(--text-muted)" }}>{`"${key}"`}</span>: <JsonValue value={val} depth={depth + 1} />
            {i < entries.length - 1 && ","}
          </div>
        ))}
        {"}"}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}

export function JsonBlock({ data, label = "JSON", defaultExpanded = false }: JsonBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)"
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "var(--spacing-sm) var(--spacing)",
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "0.8rem",
          fontFamily: "var(--font-mono)"
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {label}
      </button>
      {expanded && (
        <pre
          style={{
            padding: "var(--spacing)",
            borderTop: "1px solid var(--border)",
            fontSize: "0.8rem",
            fontFamily: "var(--font-mono)",
            overflow: "auto",
            maxHeight: "400px",
            margin: 0
          }}
        >
          <JsonValue value={data} />
        </pre>
      )}
    </div>
  );
}
