"use client";

import { Panel } from "@/components/ui/Panel";
import { type Todo } from "@/lib/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/time";
import { CheckCircle } from "lucide-react";

type TodoHistoryProps = {
  todos: Todo[];
};

export function TodoHistory({ todos }: TodoHistoryProps) {
  const doneTodos = todos.filter((t) => t.status.toLowerCase() === "done");

  if (doneTodos.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No completed todos"
          message="Nothing has been marked done yet."
        />
      </Panel>
    );
  }

  return (
    <Panel style={{ overflow: "auto", maxHeight: "calc(100vh - 320px)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
        {doneTodos.map((todo) => (
          <div
            key={todo.id}
            style={{
              display: "flex",
              gap: "var(--spacing-sm)",
              padding: "var(--spacing-sm)",
              background: "var(--surface-2)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)"
            }}
          >
            <CheckCircle size={16} style={{ color: "var(--healthy)", flexShrink: 0, marginTop: "2px" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: "4px" }}>
                {todo.title}
              </div>
              {todo.project && (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                  {todo.project}
                </div>
              )}
              <div style={{ fontSize: "0.75rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                Updated {formatDateTime(todo.updated_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
