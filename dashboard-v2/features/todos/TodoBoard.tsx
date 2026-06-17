"use client";

import { Panel } from "@/components/ui/Panel";
import { type Todo, type TodoTag } from "@/lib/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/time";
import { Calendar, User, Flag } from "lucide-react";

type TodoBoardProps = {
  todos: Todo[];
  tags: TodoTag[];
  onUpdate: (id: number, updates: Partial<Todo>) => Promise<void>;
};

const columns = [
  { id: "triage", label: "Triage", statuses: ["inbox", "idea", "need_to_plan"] },
  { id: "wip", label: "WIP", statuses: ["wip"] },
  { id: "update_needed", label: "Update needed", statuses: ["update_needed"] },
  { id: "pending_on_others", label: "Pending on others", statuses: ["pending_on_others"] }
];

export function TodoBoard({ todos, tags, onUpdate }: TodoBoardProps) {
  const activeTodos = todos.filter((t) => t.status.toLowerCase() !== "done");

  if (activeTodos.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No visible work"
          message="Either progress happened or the filters are lying."
        />
      </Panel>
    );
  }

  const getTagById = (tagId: number) => tags.find((t) => t.id === tagId);

  const moveTodo = async (id: number, newStatus: string) => {
    try {
      await onUpdate(id, { status: newStatus });
    } catch (err) {
      console.error("Failed to move todo:", err);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--spacing)", minHeight: "500px" }}>
      {columns.map((column) => {
        const columnTodos = activeTodos.filter((t) => column.statuses.includes(t.status.toLowerCase()));
        return (
          <div key={column.id} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-xs)" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
                {column.label}
              </h3>
              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
                {columnTodos.length}
              </span>
            </div>

            <Panel style={{ flex: 1, padding: "var(--spacing-sm)", overflow: "auto" }}>
              {columnTodos.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--text-faint)", textAlign: "center", padding: "var(--spacing)" }}>
                  No items
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
                  {columnTodos.map((todo) => (
                    <div
                      key={todo.id}
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--spacing-sm)"
                      }}
                    >
                      <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "var(--spacing-xs)" }}>
                        {todo.title}
                      </div>

                      {todo.priority && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: "var(--warning)", marginBottom: "4px" }}>
                          <Flag size={12} />
                          {todo.priority}
                        </div>
                      )}

                      {todo.due_date && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          <Calendar size={12} />
                          {formatRelativeTime(todo.due_date)}
                        </div>
                      )}

                      {todo.project && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          {todo.project}
                        </div>
                      )}

                      {todo.tags && todo.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "4px" }}>
                          {todo.tags.map((tagId) => {
                            const tag = getTagById(tagId);
                            return tag ? (
                              <span
                                key={tagId}
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "2px 6px",
                                  background: tag.color || "var(--surface-3)",
                                  borderRadius: "var(--radius-sm)",
                                  color: "var(--text)"
                                }}
                              >
                                {tag.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}

                      {todo.waiting_person && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: "var(--pending)", marginBottom: "4px" }}>
                          <User size={12} />
                          Waiting: {todo.waiting_person}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "4px", marginTop: "var(--spacing-xs)" }}>
                        {column.id !== "wip" && (
                          <button
                            onClick={() => moveTodo(todo.id, "wip")}
                            style={{
                              fontSize: "0.7rem",
                              padding: "2px 6px",
                              background: "var(--surface-3)",
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--text-muted)",
                              cursor: "pointer"
                            }}
                          >
                            → WIP
                          </button>
                        )}
                        {column.id !== "pending_on_others" && (
                          <button
                            onClick={() => moveTodo(todo.id, "pending_on_others")}
                            style={{
                              fontSize: "0.7rem",
                              padding: "2px 6px",
                              background: "var(--surface-3)",
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--text-muted)",
                              cursor: "pointer"
                            }}
                          >
                            → Pending
                          </button>
                        )}
                        <button
                          onClick={() => moveTodo(todo.id, "done")}
                          style={{
                            fontSize: "0.7rem",
                            padding: "2px 6px",
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
              )}
            </Panel>
          </div>
        );
      })}
    </div>
  );
}
