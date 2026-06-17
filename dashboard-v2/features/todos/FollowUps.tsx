"use client";

import { Panel } from "@/components/ui/Panel";
import { type Todo, type TodoPerson } from "@/lib/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/time";
import { User } from "lucide-react";

type FollowUpsProps = {
  todos: Todo[];
  people: TodoPerson[];
  onUpdate: (id: number, updates: Partial<Todo>) => Promise<void>;
};

export function FollowUps({ todos, onUpdate }: FollowUpsProps) {
  const waitingTodos = todos.filter((t) => t.waiting_person && t.status.toLowerCase() !== "done");

  if (waitingTodos.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No one is blocking anything"
          message="Statistically suspicious."
        />
      </Panel>
    );
  }

  const groupedByPerson = waitingTodos.reduce((acc, todo) => {
    const person = todo.waiting_person || "Unknown";
    if (!acc[person]) acc[person] = [];
    acc[person].push(todo);
    return acc;
  }, {} as Record<string, Todo[]>);

  const moveTodo = async (id: number, newStatus: string) => {
    try {
      await onUpdate(id, { status: newStatus });
    } catch (err) {
      console.error("Failed to move todo:", err);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      {Object.entries(groupedByPerson).map(([person, personTodos]) => (
        <Panel key={person}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", marginBottom: "var(--spacing)" }}>
            <User size={16} style={{ color: "var(--pending)" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>{person}</h3>
            <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
              {personTodos.length} item{personTodos.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
            {personTodos.map((todo) => (
              <div
                key={todo.id}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--spacing-sm)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--spacing-xs)" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{todo.title}</span>
                  {todo.priority && (
                    <span style={{ fontSize: "0.7rem", color: "var(--warning)", fontFamily: "var(--font-mono)" }}>
                      {todo.priority}
                    </span>
                  )}
                </div>

                {todo.due_date && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Due: {formatRelativeTime(todo.due_date)}
                  </div>
                )}

                <div style={{ display: "flex", gap: "var(--spacing-xs)", marginTop: "var(--spacing-sm)" }}>
                  <button
                    onClick={() => moveTodo(todo.id, "update_needed")}
                    style={{
                      fontSize: "0.75rem",
                      padding: "4px 8px",
                      background: "var(--surface-3)",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-muted)",
                      cursor: "pointer"
                    }}
                  >
                    Need update
                  </button>
                  <button
                    onClick={() => moveTodo(todo.id, "wip")}
                    style={{
                      fontSize: "0.75rem",
                      padding: "4px 8px",
                      background: "var(--surface-3)",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-muted)",
                      cursor: "pointer"
                    }}
                  >
                    Back to WIP
                  </button>
                  <button
                    onClick={() => moveTodo(todo.id, "done")}
                    style={{
                      fontSize: "0.75rem",
                      padding: "4px 8px",
                      background: "var(--surface-3)",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--healthy)",
                      cursor: "pointer"
                    }}
                  >
                    ✓ Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
