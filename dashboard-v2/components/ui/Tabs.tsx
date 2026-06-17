import { type ReactNode } from "react";

type Tab = {
  id: string;
  label: string;
  count?: number;
};

type TabsProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children?: ReactNode;
};

export function Tabs({ tabs, activeTab, onTabChange, children }: TabsProps) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "var(--spacing-xs)",
          borderBottom: "1px solid var(--border)",
          marginBottom: "var(--spacing)"
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-muted)",
              padding: "var(--spacing-sm) var(--spacing)",
              fontSize: "0.85rem",
              fontWeight: activeTab === tab.id ? 500 : 400,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "color 0.15s, border-color 0.15s"
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: "0.7rem",
                  background: "var(--surface-2)",
                  padding: "1px 6px",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "var(--font-mono)"
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
