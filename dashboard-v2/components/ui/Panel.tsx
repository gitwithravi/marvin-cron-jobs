import { type ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

export function Panel({ children, style, className }: PanelProps) {
  return (
    <div
      className={className}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "var(--spacing)",
        ...style
      }}
    >
      {children}
    </div>
  );
}
