"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  updated_at: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [project, setProject] = useState<TodoProject>("unknown");
  const [deadline, setDeadline] = useState("");

  async function refresh() {
    setError("");
    try {
      const data = await fetch("/api/todos?include_done=true").then(readJson);
      setTodos(data.todos || []);
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
                          <span className="text-xs text-muted-foreground">{todo.priority}</span>
                        </div>
                        {todo.notes ? (
                          <p className="text-sm text-muted-foreground">{todo.notes}</p>
                        ) : null}
                        <div className="grid gap-2 text-xs text-muted-foreground">
                          <span>Project: {todo.project}</span>
                          <span>Due: {todo.due_date || "none"}</span>
                        </div>
                        <StatusSelect
                          value={todo.status}
                          onChange={(event) => updateTodo(todo.id, { status: event.target.value as TodoStatus })}
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
    </div>
  );
}
