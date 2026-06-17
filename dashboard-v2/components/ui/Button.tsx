import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  size?: "sm" | "md";
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "var(--bg)",
    border: "none"
  },
  secondary: {
    background: "var(--surface-2)",
    color: "var(--text)",
    border: "1px solid var(--border)"
  },
  danger: {
    background: "var(--critical)",
    color: "#fff",
    border: "none"
  },
  ghost: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid transparent"
  }
};

export function Button({
  variant = "primary",
  icon,
  size = "md",
  children,
  style,
  ...props
}: ButtonProps) {
  const padding = size === "sm" ? "6px 12px" : "8px 16px";
  const fontSize = size === "sm" ? "0.8rem" : "0.9rem";

  return (
    <button
      {...props}
      style={{
        ...variantStyles[variant],
        padding,
        fontSize,
        borderRadius: "var(--radius)",
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        transition: "background 0.15s, opacity 0.15s",
        ...style
      }}
    >
      {icon}
      {children}
    </button>
  );
}
