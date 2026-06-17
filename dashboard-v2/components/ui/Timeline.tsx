import { type ReactNode } from "react";

type TimelineEvent = {
  timestamp: string;
  label: string;
  detail?: string;
  status?: "success" | "warning" | "error" | "info";
};

type TimelineProps = {
  events: TimelineEvent[];
  empty?: ReactNode;
};

const statusDotColors: Record<string, string> = {
  success: "var(--healthy)",
  warning: "var(--warning)",
  error: "var(--critical)",
  info: "var(--pending)"
};

export function Timeline({ events, empty }: TimelineProps) {
  if (events.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
      {events.map((event, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            gap: "var(--spacing-sm)",
            alignItems: "flex-start"
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: statusDotColors[event.status || "info"],
              marginTop: "6px",
              flexShrink: 0
            }}
          />
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>{event.label}</div>
            {event.detail && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {event.detail}
              </div>
            )}
            <div
              style={{
                fontSize: "0.7rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-faint)",
                marginTop: "2px"
              }}
            >
              {event.timestamp}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
