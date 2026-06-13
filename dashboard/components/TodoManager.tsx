"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TodoTag = {
  id: number;
  name: string;
  description: string | null;
  is_protected: boolean;
};

type Todo = {
  id: number;
  title: string;
  notes: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  tags: TodoTag[];
};

type TodoStatus = "idea" | "need_to_plan" | "wip" | "update_needed" | "pending_on_others" | "done";
type TodoPriority = "low" | "medium" | "high";

const statuses: TodoStatus[] = ["idea", "need_to_plan", "wip", "update_needed", "pending_on_others", "done"];
const priorities: TodoPriority[] = ["low", "medium", "high"];

function label(value: string) {
  return value.replace(/_/g, " ");
}

function isOthers(tag: TodoTag) {
  return tag.name.toLowerCase() === "others";
}

function textHasDate(value: string) {
  return /\b(\d{4}-\d{2}-\d{2}|today|tomorrow|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*|(early|mid|late)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)\b/i.test(value);
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

export function TodoManager() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<TodoTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<TodoStatus | "open" | "all">("open");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [todoText, setTodoText] = useState("");
  const [pendingTodoText, setPendingTodoText] = useState("");
  const [deadlineText, setDeadlineText] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagDescription, setTagDescription] = useState("");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [quickTagTodoId, setQuickTagTodoId] = useState<number | null>(null);
  const [quickTagName, setQuickTagName] = useState("");

  async function refresh() {
    setError("");
    try {
      const [todoData, tagData] = await Promise.all([
        fetch("/api/todos?include_done=true").then(readJson),
        fetch("/api/todo-tags").then(readJson)
      ]);
      setTodos(todoData.todos || []);
      setTags(tagData.tags || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      if (statusFilter === "open" && todo.status === "done") return false;
      if (statusFilter !== "open" && statusFilter !== "all" && todo.status !== statusFilter) return false;
      if (selectedTagIds.length > 0) {
        const todoTagIds = new Set(todo.tags.map((tag) => tag.id));
        return selectedTagIds.every((tagId) => todoTagIds.has(tagId));
      }
      return true;
    });
  }, [todos, selectedTagIds, statusFilter]);

  async function submitTodo(text: string, deadline?: string) {
    setIsSaving(true);
    setError("");
    try {
      const data = await readJson(
        await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: text,
            deadline_text: deadline || null
          })
        })
      );
      setTodos((current) => [data.todo, ...current.filter((todo) => todo.id !== data.todo.id)]);
      setTodoText("");
      setPendingTodoText("");
      setDeadlineText("");
      await refresh();
      window.setTimeout(refresh, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function createTodo(event: FormEvent) {
    event.preventDefault();
    const cleanText = todoText.trim();
    if (!cleanText) return;
    if (!textHasDate(cleanText)) {
      setPendingTodoText(cleanText);
      setDeadlineText("");
      return;
    }
    await submitTodo(cleanText);
  }

  async function saveDeadlineChoice(event: FormEvent) {
    event.preventDefault();
    if (!pendingTodoText) return;
    await submitTodo(pendingTodoText, deadlineText);
  }

  async function createTag(event: FormEvent) {
    event.preventDefault();
    if (!tagName.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      await readJson(
        await fetch("/api/todo-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tagName, description: tagDescription })
        })
      );
      setTagName("");
      setTagDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveTodo(event: FormEvent) {
    event.preventDefault();
    if (!editingTodo) return;
    setIsSaving(true);
    setError("");
    try {
      await readJson(
        await fetch(`/api/todos/${editingTodo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editingTodo.title,
            notes: editingTodo.notes || "",
            status: editingTodo.status,
            priority: editingTodo.priority,
            due_date: editingTodo.due_date || null,
            tag_ids: editingTodo.tags.map((tag) => tag.id)
          })
        })
      );
      setEditingTodo(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function quickCreateTagAndAdd(todo: Todo) {
    if (!quickTagName.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      const tagData = await readJson(
        await fetch("/api/todo-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: quickTagName })
        })
      );
      const existingNonOthers = todo.tags.filter((tag) => !isOthers(tag)).map((tag) => tag.id);
      await readJson(
        await fetch(`/api/todos/${todo.id}/retag`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag_ids: [...existingNonOthers, tagData.tag.id] })
        })
      );
      setQuickTagTodoId(null);
      setQuickTagName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  function toggleFilterTag(tagId: number) {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  }

  function toggleEditTag(tag: TodoTag) {
    if (!editingTodo) return;
    const hasTag = editingTodo.tags.some((item) => item.id === tag.id);
    setEditingTodo({
      ...editingTodo,
      tags: hasTag ? editingTodo.tags.filter((item) => item.id !== tag.id) : [...editingTodo.tags, tag]
    });
  }

  return (
    <div className="todo-layout">
      <section className="todo-main">
        <form className="todo-capture" onSubmit={createTodo}>
          <div>
            <p className="eyebrow">Capture</p>
            <h2>Add todo</h2>
          </div>
          <label>
            Todo
            <textarea
              value={todoText}
              onChange={(event) => setTodoText(event.target.value)}
              placeholder="Take followup from Aditya on VITyarthi data analysis by 16th June"
              rows={5}
            />
          </label>
          <button className="button primary" disabled={isSaving || !todoText.trim()} type="submit">
            Add todo
          </button>
        </form>

        {error && <p className="error-banner">{error}</p>}

        <section className="todo-list-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Todos</p>
              <h2>{filteredTodos.length} visible</h2>
            </div>
          </div>
          {isLoading ? (
            <p className="muted">Loading todos...</p>
          ) : filteredTodos.length === 0 ? (
            <div className="empty-state">
              <h2>No todos match</h2>
              <p className="muted">Capture one or loosen the filters.</p>
            </div>
          ) : (
            <div className="todo-list">
              {filteredTodos.map((todo) => (
                <article className="todo-item" key={todo.id}>
                  <div className="todo-item-header">
                    <div>
                      <h3>{todo.title}</h3>
                      {todo.notes && <p className="muted">{todo.notes}</p>}
                    </div>
                    <button className="button" onClick={() => setEditingTodo(todo)}>Update</button>
                  </div>
                  <div className="todo-meta-row">
                    <span className={`todo-priority priority-${todo.priority}`}>{label(todo.priority)}</span>
                    <span className="todo-status">{label(todo.status)}</span>
                    {todo.due_date && <span className="todo-date">Due {todo.due_date}</span>}
                  </div>
                  <div className="tag-row">
                    {todo.tags.map((tag) => (
                      <span className={`tag-chip ${isOthers(tag) ? "tag-others" : ""}`} key={tag.id}>{tag.name}</span>
                    ))}
                  </div>
                  {todo.tags.some(isOthers) && (
                    <div className="quick-retag">
                      {quickTagTodoId === todo.id ? (
                        <>
                          <input value={quickTagName} onChange={(event) => setQuickTagName(event.target.value)} placeholder="New tag name" />
                          <button className="button primary" onClick={() => quickCreateTagAndAdd(todo)} disabled={isSaving || !quickTagName.trim()}>
                            Create tag and add
                          </button>
                          <button className="text-button" onClick={() => setQuickTagTodoId(null)}>Cancel</button>
                        </>
                      ) : (
                        <button className="button" onClick={() => setQuickTagTodoId(todo.id)}>Create tag and add to it</button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <aside className="todo-side">
        <form className="side-panel" onSubmit={createTag}>
          <div>
            <p className="eyebrow">Tags</p>
            <h2>Create tag</h2>
          </div>
          <label>
            Name
            <input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="VITyarthi" />
          </label>
          <label>
            Description
            <input value={tagDescription} onChange={(event) => setTagDescription(event.target.value)} placeholder="Optional matching hint" />
          </label>
          <button className="button" type="submit" disabled={isSaving || !tagName.trim()}>Create tag</button>
        </form>

        <section className="side-panel">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Narrow list</h2>
          </div>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TodoStatus | "open" | "all")}>
              <option value="open">open</option>
              <option value="all">all</option>
              {statuses.map((item) => (
                <option key={item} value={item}>{label(item)}</option>
              ))}
            </select>
          </label>
          <div className="filter-tags">
            {tags.map((tag) => (
              <label key={tag.id} className="check-row">
                <input type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => toggleFilterTag(tag.id)} />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
        </section>
      </aside>

      {pendingTodoText && (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingTodoText("")}>
          <form className="deadline-panel" role="dialog" aria-modal="true" onSubmit={saveDeadlineChoice} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Deadline</p>
                <h2>Any deadline?</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setPendingTodoText("")} aria-label="Close deadline prompt">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="muted">{pendingTodoText}</p>
            <label>
              Deadline
              <input
                value={deadlineText}
                onChange={(event) => setDeadlineText(event.target.value)}
                placeholder="16th June, late July, tomorrow"
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button className="button primary" type="submit" disabled={isSaving}>Add todo</button>
              <button className="button" type="button" disabled={isSaving} onClick={() => submitTodo(pendingTodoText)}>
                No deadline
              </button>
            </div>
          </form>
        </div>
      )}

      {editingTodo && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditingTodo(null)}>
          <form className="todo-edit-panel" role="dialog" aria-modal="true" onSubmit={saveTodo} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Update</p>
                <h2>Edit todo</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditingTodo(null)} aria-label="Close editor">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <label>
              Todo
              <input value={editingTodo.title} onChange={(event) => setEditingTodo({ ...editingTodo, title: event.target.value })} />
            </label>
            <div className="form-grid">
              <label>
                Status
                <select value={editingTodo.status} onChange={(event) => setEditingTodo({ ...editingTodo, status: event.target.value as TodoStatus })}>
                  {statuses.map((item) => (
                    <option key={item} value={item}>{label(item)}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select value={editingTodo.priority} onChange={(event) => setEditingTodo({ ...editingTodo, priority: event.target.value as TodoPriority })}>
                  {priorities.map((item) => (
                    <option key={item} value={item}>{label(item)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Due date
              <input type="date" value={editingTodo.due_date || ""} onChange={(event) => setEditingTodo({ ...editingTodo, due_date: event.target.value || null })} />
            </label>
            <label>
              Notes
              <textarea rows={4} value={editingTodo.notes || ""} onChange={(event) => setEditingTodo({ ...editingTodo, notes: event.target.value })} />
            </label>
            <div className="filter-tags">
              {tags.map((tag) => (
                <label key={tag.id} className="check-row">
                  <input type="checkbox" checked={editingTodo.tags.some((item) => item.id === tag.id)} onChange={() => toggleEditTag(tag)} />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
            <button className="button primary" type="submit" disabled={isSaving || !editingTodo.title.trim()}>Save update</button>
          </form>
        </div>
      )}
    </div>
  );
}
