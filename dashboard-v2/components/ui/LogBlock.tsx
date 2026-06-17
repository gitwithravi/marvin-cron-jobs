type LogBlockProps = {
  content: string;
  maxHeight?: string;
};

export function LogBlock({ content, maxHeight = "300px" }: LogBlockProps) {
  return (
    <pre
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--spacing)",
        fontSize: "0.8rem",
        fontFamily: "var(--font-mono)",
        overflow: "auto",
        maxHeight,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        color: "var(--text-muted)"
      }}
    >
      {content}
    </pre>
  );
}
