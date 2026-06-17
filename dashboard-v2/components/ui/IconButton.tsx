import { type ButtonHTMLAttributes, type ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  size?: "sm" | "md";
};

export function IconButton({
  icon,
  label,
  size = "md",
  style,
  ...props
}: IconButtonProps) {
  const dim = size === "sm" ? "28px" : "32px";

  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      style={{
        width: dim,
        height: dim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        color: "var(--text-muted)",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        transition: "background 0.15s, color 0.15s",
        ...style
      }}
    >
      {icon}
    </button>
  );
}
