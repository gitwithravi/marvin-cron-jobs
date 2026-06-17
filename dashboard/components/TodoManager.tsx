"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TodoTag = {
  id: number;
  name: string;
  description: string | null;
  is_protected: boolean;
};

type TodoPerson = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

type Todo = {
  id: number;
  title: string;
  notes: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string | null;
  source: string;
  source_ref_id: string | null;
  project: TodoProject;
  reviewed: boolean;
  raw_context: string | null;
  completed_at: string | null;
  waiting_on_person_id: number | null;
  waiting_on_person: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
  tags: TodoTag[];
};

type TodoStatus = "inbox" | "idea" | "need_to_plan" | "wip" | "update_needed" | "pending_on_others" | "done";
type TodoPriority = "low" | "medium" | "high" | "urgent";
type TodoProject = "vitbhopal" | "vityarthi" | "recruitment" | "personal" | "unknown";
type TodoView = "board" | "followups" | "history";
type BoardColumnKey = "triage" | "wip" | "update_needed" | "pending_on_others";
type PendingPromptState = {
  todo: Todo;
  targetStatus: TodoStatus;
};

const triageStatuses: TodoStatus[] = ["inbox", "idea", "need_to_plan"];
const boardColumns: { key: BoardColumnKey; title: string; statuses: TodoStatus[] }[] = [
  { key: "triage", title: "Triage", statuses: triageStatuses },
  { key: "wip", title: "WIP", statuses: ["wip"] },
  { key: "update_needed", title: "Update Needed", statuses: ["update_needed"] },
  { key: "pending_on_others", title: "Pending on Others", statuses: ["pending_on_others"] }
];
const statuses: TodoStatus[] = ["inbox", "idea", "need_to_plan", "wip", "update_needed", "pending_on_others", "done"];
const priorities: TodoPriority[] = ["low", "medium", "high", "urgent"];
const projects: TodoProject[] = ["unknown", "vitbhopal", "vityarthi", "recruitment", "personal"];
const doneVisibilityDays = 7;

function label(value: string) {
  return value.replace(/_/g, " ");
}

function isOthers(tag: TodoTag) {
  return tag.name.toLowerCase() === "others";
}

function textHasDate(value: string) {
  return /\b(\d{4}-\d{2}-\d{2}|today|tomorrow|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*|(early|mid|late)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)\b/i.test(value);
}

function toMillis(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isCompletedWithinWindow(todo: Todo, days: number) {
  if (!todo.completed_at) return false;
  const ageMs = Date.now() - toMillis(todo.completed_at);
  return ageMs <= days * 24 * 60 * 60 * 1000;
}

function priorityRank(priority: TodoPriority) {
  return priorities.indexOf(priority);
}

function sortTodos(items: Todo[]) {
  return [...items].sort((left, right) => {
    const priorityDiff = priorityRank(left.priority) - priorityRank(right.priority);
    if (priorityDiff !== 0) return priorityDiff;
    const dueDiff = toMillis(left.due_date) - toMillis(right.due_date);
    if (left.due_date && right.due_date && dueDiff !== 0) return dueDiff;
    if (left.due_date && !right.due_date) return -1;
    if (!left.due_date && right.due_date) return 1;
    return toMillis(right.updated_at) - toMillis(left.updated_at);
  });
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

export function TodoManager() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<TodoTag[]>([]);
  const [people, setPeople] = useState<TodoPerson[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [projectFilter, setProjectFilter] = useState<TodoProject | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "email" | "manual">("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | "unreviewed" | "reviewed">("all");
  const [view, setView] = useState<TodoView>("board");
  const [showOlderDone, setShowOlderDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [todoText, setTodoText] = useState("");
  const [pendingTodoText, setPendingTodoText] = useState("");
  const [deadlineText, setDeadlineText] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagDescription, setTagDescription] = useState("");
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<number | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<PendingPromptState | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [newPersonName, setNewPersonName] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  async function refresh() {
    setError("");
    try {
      const [todoData, tagData, peopleData] = await Promise.all([
        fetch("/api/todos?include_done=true").then(readJson),
        fetch("/api/todo-tags").then(readJson),
        fetch("/api/todo-people").then(readJson)
      ]);
      setTodos(todoData.todos || []);
      setTags(tagData.tags || []);
      setPeople(peopleData.people || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const visibleOpenTodos = useMemo(() => {
    return sortTodos(
      todos.filter((todo) => {
        if (todo.status === "done") return false;
        if (sourceFilter !== "all" && todo.source !== sourceFilter) return false;
        if (projectFilter !== "all" && todo.project !== projectFilter) return false;
        if (reviewFilter === "unreviewed" && todo.reviewed) return false;
        if (reviewFilter === "reviewed" && !todo.reviewed) return false;
        if (selectedTagIds.length > 0) {
          const todoTagIds = new Set(todo.tags.map((tag) => tag.id));
          return selectedTagIds.every((tagId) => todoTagIds.has(tagId));
        }
        return true;
      })
    );
  }, [projectFilter, reviewFilter, selectedTagIds, sourceFilter, todos]);

  const historyTodos = useMemo(() => {
    return sortTodos(
      todos.filter((todo) => {
        if (todo.status !== "done") return false;
        if (!showOlderDone && !isCompletedWithinWindow(todo, doneVisibilityDays)) return false;
        return true;
      })
    );
  }, [showOlderDone, todos]);

  const followupGroups = useMemo(() => {
    const grouped = new Map<number, { person: TodoPerson | { id: number; name: string }; todos: Todo[] }>();
    visibleOpenTodos
      .filter((todo) => todo.status === "pending_on_others" && todo.waiting_on_person)
      .forEach((todo) => {
        const person = todo.waiting_on_person;
        if (!person) return;
        const group = grouped.get(person.id) || { person, todos: [] };
        group.todos.push(todo);
        grouped.set(person.id, group);
      });
    return [...grouped.values()]
      .map((group) => ({ ...group, todos: sortTodos(group.todos) }))
      .sort((left, right) => {
        const leftTop = left.todos[0];
        const rightTop = right.todos[0];
        return sortTodos([leftTop, rightTop])[0].id === leftTop.id ? -1 : 1;
      });
  }, [visibleOpenTodos]);

  const boardTodoCount = visibleOpenTodos.length;
  const recentDoneCount = todos.filter((todo) => todo.status === "done" && isCompletedWithinWindow(todo, doneVisibilityDays)).length;
  const olderDoneCount = todos.filter((todo) => todo.status === "done" && !isCompletedWithinWindow(todo, doneVisibilityDays)).length;
  const selectedFilterCount = selectedTagIds.length
    + (sourceFilter === "all" ? 0 : 1)
    + (projectFilter === "all" ? 0 : 1)
    + (reviewFilter === "all" ? 0 : 1);

  async function createPerson(name: string) {
    const cleanName = name.trim();
    if (!cleanName) throw new Error("Person name is required.");
    const data = await readJson(
      await fetch("/api/todo-people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName })
      })
    );
    const person = data.person as TodoPerson;
    setPeople((current) => {
      const next = [...current.filter((item) => item.id !== person.id), person];
      return next.sort((left, right) => left.name.localeCompare(right.name));
    });
    return person;
  }

  async function persistTodoUpdate(todoId: number, updates: Partial<Todo> & { tag_ids?: number[]; waiting_on_person_id?: number | null }) {
    const data = await readJson(
      await fetch(`/api/todos/${todoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      })
    );
    const updated = data.todo as Todo;
    setTodos((current) => [updated, ...current.filter((todo) => todo.id !== updated.id)]);
    return updated;
  }

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
            deadline_text: deadline || null,
            status: "inbox"
          })
        })
      );
      setTodos((current) => [data.todo, ...current.filter((todo) => todo.id !== data.todo.id)]);
      setTodoText("");
      setPendingTodoText("");
      setDeadlineText("");
      await refresh();
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
      setIsTagModalOpen(false);
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
      await persistTodoUpdate(editingTodo.id, {
        title: editingTodo.title,
        notes: editingTodo.notes || "",
        status: editingTodo.status,
        priority: editingTodo.priority,
        due_date: editingTodo.due_date || null,
        project: editingTodo.project,
        reviewed: editingTodo.reviewed,
        tag_ids: editingTodo.tags.map((tag) => tag.id),
        waiting_on_person_id: editingTodo.status === "pending_on_others" ? editingTodo.waiting_on_person_id : null
      });
      setEditingTodo(null);
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

  function updateEditWaitingPerson(personId: string) {
    if (!editingTodo) return;
    const normalizedId = personId ? Number(personId) : null;
    const person = people.find((item) => item.id === normalizedId) || null;
    setEditingTodo({
      ...editingTodo,
      waiting_on_person_id: normalizedId,
      waiting_on_person: person ? { id: person.id, name: person.name } : null
    });
  }

  async function moveTodo(todo: Todo, targetStatus: TodoStatus) {
    if (targetStatus === "pending_on_others") {
      setPendingPrompt({ todo, targetStatus });
      setSelectedPersonId(todo.waiting_on_person_id ? String(todo.waiting_on_person_id) : "");
      setNewPersonName("");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await persistTodoUpdate(todo.id, {
        status: targetStatus,
        waiting_on_person_id: null
      });
      if (editingTodo?.id === todo.id) {
        setEditingTodo(null);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmPendingPerson(event: FormEvent) {
    event.preventDefault();
    if (!pendingPrompt) return;
    setIsSaving(true);
    setError("");
    try {
      let personId = selectedPersonId ? Number(selectedPersonId) : null;
      if (!personId && newPersonName.trim()) {
        const person = await createPerson(newPersonName);
        personId = person.id;
      }
      if (!personId) {
        throw new Error("Select a person or add a new one.");
      }
      await persistTodoUpdate(pendingPrompt.todo.id, {
        status: pendingPrompt.targetStatus,
        waiting_on_person_id: personId
      });
      setPendingPrompt(null);
      setSelectedPersonId("");
      setNewPersonName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  function handleDragStart(todoId: number) {
    setDraggingTodoId(todoId);
  }

  function handleDrop(column: BoardColumnKey) {
    if (!draggingTodoId) return;
    const todo = todos.find((item) => item.id === draggingTodoId);
    setDraggingTodoId(null);
    if (!todo) return;
    const targetStatus = column === "triage" ? "inbox" : column;
    if (todo.status === targetStatus || (column === "triage" && triageStatuses.includes(todo.status))) {
      return;
    }
    void moveTodo(todo, targetStatus);
  }

  return (
    <div className="todo-layout">
      <form className="todo-capture" onSubmit={createTodo}>
        <div className="todo-capture-header">
          <div>
            <p className="eyebrow">Capture</p>
            <h2>Add todo</h2>
          </div>
        </div>
        <label className="todo-capture-label">
          <textarea
            value={todoText}
            onChange={(event) => setTodoText(event.target.value)}
            placeholder="Take followup from Aditya on VITyarthi data analysis by 16th June"
            rows={3}
          />
        </label>
        <button className="button primary todo-capture-btn" disabled={isSaving || !todoText.trim()} type="submit">
          Add to triage
        </button>
      </form>

      {error && <p className="error-banner">{error}</p>}

      <section className="todo-list-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workflow</p>
            <h2>{boardTodoCount} active</h2>
          </div>
          <div className="todo-view-switcher" role="tablist" aria-label="Todo views">
            <button aria-selected={view === "board"} className={`tab ${view === "board" ? "active" : ""}`} onClick={() => setView("board")} role="tab" type="button">
              Board
            </button>
            <button aria-selected={view === "followups"} className={`tab ${view === "followups" ? "active" : ""}`} onClick={() => setView("followups")} role="tab" type="button">
              Follow-Ups
            </button>
            <button aria-selected={view === "history"} className={`tab ${view === "history" ? "active" : ""}`} onClick={() => setView("history")} role="tab" type="button">
              Done History
            </button>
          </div>
        </div>

        <div className="todo-toolbar">
          <button
            className={`filter-toggle-btn ${showFilters || selectedFilterCount > 0 ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filters
            {selectedFilterCount > 0 && <span className="filter-count">{selectedFilterCount}</span>}
          </button>
          <button className="button" type="button" onClick={() => setIsTagModalOpen(true)}>
            Create tag
          </button>
        </div>

        {showFilters && (
          <div className="todo-filters-panel">
            <div className="todo-filters-row">
              <label>
                Source
                <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as "all" | "email" | "manual")}>
                  <option value="all">all</option>
                  <option value="email">email</option>
                  <option value="manual">manual</option>
                </select>
              </label>
              <label>
                Project
                <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value as TodoProject | "all")}>
                  <option value="all">all</option>
                  {projects.map((item) => (
                    <option key={item} value={item}>{label(item)}</option>
                  ))}
                </select>
              </label>
              <label>
                Review
                <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as "all" | "unreviewed" | "reviewed")}>
                  <option value="all">all</option>
                  <option value="unreviewed">unreviewed</option>
                  <option value="reviewed">reviewed</option>
                </select>
              </label>
              {selectedFilterCount > 0 && (
                <button
                  className="button clear-filters-btn"
                  type="button"
                  onClick={() => {
                    setSourceFilter("all");
                    setProjectFilter("all");
                    setReviewFilter("all");
                    setSelectedTagIds([]);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {tags.length > 0 && (
              <div className="filter-tags">
                {tags.map((tag) => (
                  <label key={tag.id} className="check-row">
                    <input type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => toggleFilterTag(tag.id)} />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <p className="muted">Loading todos...</p>
        ) : view === "board" ? (
          <div className="kanban-board">
            {boardColumns.map((column) => {
              const columnTodos = visibleOpenTodos.filter((todo) => column.statuses.includes(todo.status));
              return (
                <section
                  className="kanban-column"
                  key={column.key}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(column.key)}
                >
                  <div className="kanban-column-header">
                    <div>
                      <h3>{column.title}</h3>
                      <p className="muted">{columnTodos.length} item{columnTodos.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="kanban-column-body">
                    {columnTodos.length === 0 ? (
                      <div className="kanban-empty">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                        </svg>
                        <p>No items</p>
                      </div>
                    ) : (
                      columnTodos.map((todo) => (
                        <article
                          className="todo-card"
                          draggable
                          key={todo.id}
                          onDragStart={() => handleDragStart(todo.id)}
                          onDragEnd={() => setDraggingTodoId(null)}
                        >
                          <div className="todo-card-top">
                            <div className="todo-card-title">
                              <h3>{todo.title}</h3>
                            </div>
                            <button
                              className="todo-card-edit-btn"
                              onClick={() => setEditingTodo(todo)}
                              type="button"
                              aria-label={`Edit ${todo.title}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          </div>
                          {todo.notes && <p className="todo-card-notes">{truncateText(todo.notes, 120)}</p>}
                          <div className="todo-card-meta">
                            <span className={`todo-priority priority-${todo.priority}`}>{label(todo.priority)}</span>
                            {todo.due_date && <span className="todo-due">Due {todo.due_date}</span>}
                            {todo.waiting_on_person && <span className="todo-waiting">Waiting: {todo.waiting_on_person.name}</span>}
                          </div>
                          <div className="todo-card-tags">
                            {todo.tags.map((tag) => (
                              <span className={`tag-chip ${isOthers(tag) ? "tag-others" : ""}`} key={tag.id}>{tag.name}</span>
                            ))}
                          </div>
                          <div className="todo-card-actions">
                            <select
                              aria-label={`Move ${todo.title}`}
                              value={todo.status}
                              onChange={(event) => void moveTodo(todo, event.target.value as TodoStatus)}
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>{label(status)}</option>
                              ))}
                            </select>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : view === "followups" ? (
          <div className="followup-list">
            {followupGroups.length === 0 ? (
              <div className="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <h2>No follow-ups pending</h2>
                <p className="muted">Tasks waiting on other people will appear here.</p>
              </div>
            ) : (
              followupGroups.map((group) => (
                <section className="followup-person-card" key={group.person.id}>
                  <div className="followup-person-header">
                    <div>
                      <h3>{group.person.name}</h3>
                      <p className="muted">{group.todos.length} waiting task{group.todos.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="followup-task-list">
                    {group.todos.map((todo) => (
                      <article className="todo-item" key={todo.id}>
                        <div className="todo-item-content">
                          <h3>{todo.title}</h3>
                          {todo.notes && <p className="muted">{truncateText(todo.notes, 100)}</p>}
                          <div className="todo-item-meta">
                            <span className={`todo-priority priority-${todo.priority}`}>{label(todo.priority)}</span>
                            {todo.due_date && <span className="todo-due">Due {todo.due_date}</span>}
                          </div>
                        </div>
                        <div className="followup-actions">
                          <button className="button" onClick={() => void moveTodo(todo, "update_needed")} type="button">Need update</button>
                          <button className="button" onClick={() => void moveTodo(todo, "wip")} type="button">Back to WIP</button>
                          <button className="button primary" onClick={() => void moveTodo(todo, "done")} type="button">Mark done</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        ) : (
          <div className="history-panel">
            <div className="history-toolbar">
              <p className="muted">{recentDoneCount} completed in the last {doneVisibilityDays} days</p>
              <button className="button" onClick={() => setShowOlderDone((current) => !current)} type="button">
                {showOlderDone ? "Hide older done" : `Show older done (${olderDoneCount})`}
              </button>
            </div>
            {historyTodos.length === 0 ? (
              <div className="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <h2>No completed tasks in view</h2>
                <p className="muted">Recent completed work will appear here when you ask for it.</p>
              </div>
            ) : (
              <div className="todo-list">
                {historyTodos.map((todo) => (
                  <article className="todo-item" key={todo.id}>
                    <div className="todo-item-content">
                      <h3>{todo.title}</h3>
                      {todo.notes && <p className="muted">{truncateText(todo.notes, 100)}</p>}
                      <div className="todo-item-meta">
                        <span className={`todo-priority priority-${todo.priority}`}>{label(todo.priority)}</span>
                        <span className="todo-status-done">done</span>
                        {todo.completed_at && <span className="todo-due">Completed {new Date(todo.completed_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <button className="button" onClick={() => setEditingTodo(todo)} type="button">Open</button>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

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
              <button className="button" type="button" disabled={isSaving} onClick={() => void submitTodo(pendingTodoText)}>
                No deadline
              </button>
            </div>
          </form>
        </div>
      )}

      {isTagModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsTagModalOpen(false)}>
          <form className="todo-edit-panel" role="dialog" aria-modal="true" onSubmit={createTag} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Tags</p>
                <h2>Create tag</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsTagModalOpen(false)} aria-label="Close tag modal">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <label>
              Name
              <input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="VITyarthi" />
            </label>
            <label>
              Description
              <input value={tagDescription} onChange={(event) => setTagDescription(event.target.value)} placeholder="Optional matching hint" />
            </label>
            <button className="button primary" type="submit" disabled={isSaving || !tagName.trim()}>
              Create tag
            </button>
          </form>
        </div>
      )}

      {pendingPrompt && (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingPrompt(null)}>
          <form className="todo-edit-panel" role="dialog" aria-modal="true" onSubmit={confirmPendingPerson} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Waiting</p>
                <h2>Who are you waiting on?</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setPendingPrompt(null)} aria-label="Close waiting prompt">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="muted">{pendingPrompt.todo.title}</p>
            <label>
              Existing person
              <select value={selectedPersonId} onChange={(event) => setSelectedPersonId(event.target.value)}>
                <option value="">Select one</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>
            <label>
              Or add new person
              <input value={newPersonName} onChange={(event) => setNewPersonName(event.target.value)} placeholder="Name" />
            </label>
            <button className="button primary" type="submit" disabled={isSaving}>Save waiting owner</button>
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
            <div className="form-grid">
              <label>
                Project
                <select value={editingTodo.project} onChange={(event) => setEditingTodo({ ...editingTodo, project: event.target.value as TodoProject })}>
                  {projects.map((item) => (
                    <option key={item} value={item}>{label(item)}</option>
                  ))}
                </select>
              </label>
              <label className="check-row form-check-row">
                <input type="checkbox" checked={editingTodo.reviewed} onChange={(event) => setEditingTodo({ ...editingTodo, reviewed: event.target.checked })} />
                <span>reviewed</span>
              </label>
            </div>
            {editingTodo.status === "pending_on_others" && (
              <label>
                Waiting on
                <select value={editingTodo.waiting_on_person_id || ""} onChange={(event) => updateEditWaitingPerson(event.target.value)}>
                  <option value="">Select one</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
            )}
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
