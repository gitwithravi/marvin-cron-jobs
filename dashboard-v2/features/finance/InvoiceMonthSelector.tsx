"use client";

import { Panel } from "@/components/ui/Panel";

type InvoiceMonthSelectorProps = {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
};

export function InvoiceMonthSelector({ selectedMonth, onMonthChange }: InvoiceMonthSelectorProps) {
  return (
    <Panel style={{ background: "var(--surface-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
        <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Month:</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "6px 10px",
            color: "var(--text)",
            fontSize: "0.85rem"
          }}
        />
      </div>
    </Panel>
  );
}
