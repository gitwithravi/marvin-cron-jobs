"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectHTMLAttributes } from "react";
import { consoleRoutes } from "@/lib/routes";

type TodoStatus =
  | "inbox"
  | "idea"
  | "need_to_plan"
  | "wip"
  | "update_needed"
  | "pending_on_others"
  | "done";

type TodoPriority = "low" | "medium" | "high" | "urgent";
type TodoProject = "vitbhopal" | "vityarthi" | "recruitment" | "personal" | "unknown";

type Todo = {
  id: number;
  title: string;
  notes: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string | null;
  project: TodoProject;
  waiting_on_person_id?: number | null;
  waiting_on_person?: { id: number; name: string } | null;
  updated_at: string;
};

type TodoPerson = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

type EditTodoForm = {
  id: number;
  title: string;
  notes: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string;
  project: TodoProject;
  waiting_on_person_id: string;
  new_person_name: string;
};

const statuses: TodoStatus[] = ["inbox", "idea", "need_to_plan", "wip", "update_needed", "pending_on_others", "done"];
const boardColumns: Array<{ title: string; statuses: TodoStatus[] }> = [
  { title: "Triage", statuses: ["inbox", "idea", "need_to_plan"] },
  { title: "WIP", statuses: ["wip"] },
  { title: "Update Needed", statuses: ["update_needed"] },
  { title: "Pending on Others", statuses: ["pending_on_others"] }
];

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

function titleize(value: string) {
  return value.replace(/_/g, " ");
}

function StatusSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-8 rounded-md border border-input bg-black/15 px-2 text-xs text-foreground"
    >
      {statuses.map((status) => (
        <option key={status} value={status}>
          {titleize(status)}
        </option>
      ))}
    </select>
  );
}

export function TodoManager() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [people, setPeople] = useState<TodoPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [project, setProject] = useState<TodoProject>("unknown");
  const [deadline, setDeadline] = useState("");
  const [pendingTodo, setPendingTodo] = useState<Todo | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [editingTodo, setEditingTodo] = useState<EditTodoForm | null>(null);

  async function refresh() {
    setError("");
    try {
      const [todoData, peopleData] = await Promise.all([
        fetch("/api/todos?include_done=true").then(readJson),
        fetch("/api/todo-people").then(readJson)
      ]);
      setTodos(todoData.todos || []);
      setPeople(peopleData.people || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createTodo(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          project,
          deadline_text: deadline || null,
          status: "inbox"
        })
      }).then(readJson);
      setTitle("");
      setProject("unknown");
      setDeadline("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSaving(false);
    }
  }

  async function updateTodo(todoId: number, updates: Partial<Todo>) {
    setError("");
    try {
      const data = await fetch(`/api/todos/${todoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      }).then(readJson);
      const updated = data.todo as Todo;
      setTodos((current) => [updated, ...current.filter((todo) => todo.id !== updated.id)]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function createPerson(name: string) {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error("Person name is required.");
    }
    const data = await fetch("/api/todo-people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cleanName })
    }).then(readJson);
    const person = data.person as TodoPerson;
    setPeople((current) => {
      const next = [...current.filter((item) => item.id !== person.id), person];
      return next.sort((left, right) => left.name.localeCompare(right.name));
    });
    return person;
  }

  async function moveTodo(todo: Todo, nextStatus: TodoStatus) {
    if (nextStatus === "pending_on_others") {
      setPendingTodo(todo);
      setSelectedPersonId(todo.waiting_on_person_id ? String(todo.waiting_on_person_id) : "");
      setNewPersonName("");
      return;
    }
    await updateTodo(todo.id, {
      status: nextStatus,
      waiting_on_person_id: null,
      waiting_on_person: null
    });
  }

  function openEditModal(todo: Todo) {
    setEditingTodo({
      id: todo.id,
      title: todo.title,
      notes: todo.notes || "",
      status: todo.status,
      priority: todo.priority,
      due_date: todo.due_date || "",
      project: todo.project,
      waiting_on_person_id: todo.waiting_on_person_id ? String(todo.waiting_on_person_id) : "",
      new_person_name: ""
    });
  }

  async function confirmPendingOnOthers(event: FormEvent) {
    event.preventDefault();
    if (!pendingTodo) {
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      let personId = selectedPersonId ? Number(selectedPersonId) : null;
      if (!personId && newPersonName.trim()) {
        const person = await createPerson(newPersonName);
        personId = person.id;
      }
      if (!personId) {
        throw new Error("Select an existing teammate or add a new one.");
      }
      await updateTodo(pendingTodo.id, {
        status: "pending_on_others",
        waiting_on_person_id: personId
      });
      setPendingTodo(null);
      setSelectedPersonId("");
      setNewPersonName("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEditedTodo(event: FormEvent) {
    event.preventDefault();
    if (!editingTodo) {
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      let waitingOnPersonId: number | null = editingTodo.waiting_on_person_id
        ? Number(editingTodo.waiting_on_person_id)
        : null;

      if (editingTodo.status === "pending_on_others") {
        if (!waitingOnPersonId && editingTodo.new_person_name.trim()) {
          const person = await createPerson(editingTodo.new_person_name);
          waitingOnPersonId = person.id;
        }
        if (!waitingOnPersonId) {
          throw new Error("Select an existing teammate or add a new one before saving.");
        }
      } else {
        waitingOnPersonId = null;
      }

      await updateTodo(editingTodo.id, {
        title: editingTodo.title.trim(),
        notes: editingTodo.notes.trim() || null,
        status: editingTodo.status,
        priority: editingTodo.priority,
        due_date: editingTodo.due_date || null,
        project: editingTodo.project,
        waiting_on_person_id: waitingOnPersonId,
        waiting_on_person: null
      });
      setEditingTodo(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSaving(false);
    }
  }

  const grouped = useMemo(() => {
    return boardColumns.map((column) => ({
      ...column,
      todos: todos.filter((todo) => column.statuses.includes(todo.status))
    }));
  }, [todos]);

  const completedCount = useMemo(
    () => todos.filter((todo) => todo.status === "done").length,
    [todos]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Create todo</CardTitle>
          </div>
          <Button asChild variant="outline">
            <Link href={consoleRoutes.completedTodos}>
              Completed tasks
              {completedCount > 0 ? ` (${completedCount})` : ""}
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={createTodo} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_180px_auto]">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="todo-title">Title</Label>
              <Input id="todo-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="todo-deadline">Deadline text</Label>
              <Input id="todo-deadline" value={deadline} onChange={(event) => setDeadline(event.target.value)} placeholder="today / 2026-06-21" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="todo-project">Project</Label>
              <select
                id="todo-project"
                value={project}
                onChange={(event) => setProject(event.target.value as TodoProject)}
                className="h-10 rounded-md border border-input bg-black/15 px-3 text-sm"
              >
                {["unknown", "vitbhopal", "vityarthi", "recruitment", "personal"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading todos...</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {grouped.map((column) => (
            <Card key={column.title} className="h-full">
              <CardHeader>
                <CardTitle className="text-base">{column.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {column.todos.length > 0 ? (
                  column.todos.map((todo) => (
                    <div key={todo.id} className="rounded-xl border border-border/60 bg-black/10 p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium">{todo.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{todo.priority}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              onClick={() => openEditModal(todo)}
                            >
                              <Pencil className="size-3.5" />
                              <span className="sr-only">Edit task</span>
                            </Button>
                          </div>
                        </div>
                        {todo.notes ? (
                          <p className="text-sm text-muted-foreground">{todo.notes}</p>
                        ) : null}
                        <div className="grid gap-2 text-xs text-muted-foreground">
                          <span>Project: {todo.project}</span>
                          <span>Due: {todo.due_date || "none"}</span>
                          {todo.waiting_on_person ? (
                            <span>Waiting: {todo.waiting_on_person.name}</span>
                          ) : null}
                        </div>
                        <StatusSelect
                          value={todo.status}
                          onChange={(event) => void moveTodo(todo, event.target.value as TodoStatus)}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No todos in this column.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={pendingTodo !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTodo(null);
            setSelectedPersonId("");
            setNewPersonName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who are you waiting on?</DialogTitle>
            <DialogDescription>
              Select an existing teammate or add a new one before moving this task into pending-on-others.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmPendingOnOthers} className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-black/10 p-3 text-sm text-foreground/90">
              {pendingTodo?.title}
            </div>
            <div className="space-y-2">
              <Label htmlFor="existing-person">Existing teammate</Label>
              <select
                id="existing-person"
                value={selectedPersonId}
                onChange={(event) => setSelectedPersonId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-black/15 px-3 text-sm"
              >
                <option value="">Select one</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-person">Or add new teammate</Label>
              <Input
                id="new-person"
                value={newPersonName}
                onChange={(event) => setNewPersonName(event.target.value)}
                placeholder="Name"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPendingTodo(null);
                  setSelectedPersonId("");
                  setNewPersonName("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Move to pending"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingTodo !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTodo(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Update task details without leaving the board.
            </DialogDescription>
          </DialogHeader>
          {editingTodo ? (
            <form onSubmit={saveEditedTodo} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editingTodo.title}
                  onChange={(event) =>
                    setEditingTodo({ ...editingTodo, title: event.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <select
                    id="edit-status"
                    value={editingTodo.status}
                    onChange={(event) =>
                      setEditingTodo({
                        ...editingTodo,
                        status: event.target.value as TodoStatus,
                        waiting_on_person_id:
                          event.target.value === "pending_on_others"
                            ? editingTodo.waiting_on_person_id
                            : "",
                        new_person_name:
                          event.target.value === "pending_on_others"
                            ? editingTodo.new_person_name
                            : ""
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-black/15 px-3 text-sm"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {titleize(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-priority">Priority</Label>
                  <select
                    id="edit-priority"
                    value={editingTodo.priority}
                    onChange={(event) =>
                      setEditingTodo({
                        ...editingTodo,
                        priority: event.target.value as TodoPriority
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-black/15 px-3 text-sm"
                  >
                    {["low", "medium", "high", "urgent"].map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-project">Project</Label>
                  <select
                    id="edit-project"
                    value={editingTodo.project}
                    onChange={(event) =>
                      setEditingTodo({
                        ...editingTodo,
                        project: event.target.value as TodoProject
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-black/15 px-3 text-sm"
                  >
                    {["unknown", "vitbhopal", "vityarthi", "recruitment", "personal"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-due-date">Due date</Label>
                  <Input
                    id="edit-due-date"
                    type="date"
                    value={editingTodo.due_date}
                    onChange={(event) =>
                      setEditingTodo({ ...editingTodo, due_date: event.target.value })
                    }
                  />
                </div>
              </div>
              {editingTodo.status === "pending_on_others" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-existing-person">Existing teammate</Label>
                    <select
                      id="edit-existing-person"
                      value={editingTodo.waiting_on_person_id}
                      onChange={(event) =>
                        setEditingTodo({
                          ...editingTodo,
                          waiting_on_person_id: event.target.value
                        })
                      }
                      className="h-10 w-full rounded-md border border-input bg-black/15 px-3 text-sm"
                    >
                      <option value="">Select one</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-new-person">Or add new teammate</Label>
                    <Input
                      id="edit-new-person"
                      value={editingTodo.new_person_name}
                      onChange={(event) =>
                        setEditingTodo({
                          ...editingTodo,
                          new_person_name: event.target.value
                        })
                      }
                      placeholder="Name"
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editingTodo.notes}
                  onChange={(event) =>
                    setEditingTodo({ ...editingTodo, notes: event.target.value })
                  }
                  rows={5}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingTodo(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || !editingTodo.title.trim()}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
