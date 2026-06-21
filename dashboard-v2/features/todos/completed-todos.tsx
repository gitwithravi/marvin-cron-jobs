"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { consoleRoutes } from "@/lib/routes";
import { formatDateTime } from "@/lib/utils/format";

type Todo = {
  id: number;
  title: string;
  notes: string | null;
  status: "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  project: "vitbhopal" | "vityarthi" | "recruitment" | "personal" | "unknown";
  completed_at?: string | null;
  updated_at: string;
};

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

export function CompletedTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      const data = await fetch("/api/todos?include_done=true").then(readJson);
      setTodos((data.todos || []).filter((todo: Todo) => todo.status === "done"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(
    () =>
      [...todos].sort((left, right) => {
        const leftTime = Date.parse(left.completed_at || left.updated_at);
        const rightTime = Date.parse(right.completed_at || right.updated_at);
        return rightTime - leftTime;
      }),
    [todos]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-start">
        <Button asChild variant="outline">
          <Link href={consoleRoutes.todos}>Back to active board</Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading completed tasks...</p>
      ) : sorted.length > 0 ? (
        <div className="grid gap-4">
          {sorted.map((todo) => (
            <Card key={todo.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{todo.title}</CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Completed {formatDateTime(todo.completed_at || todo.updated_at)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{todo.priority}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-4">
                  <span>Project: {todo.project}</span>
                  <span>Due: {todo.due_date || "none"}</span>
                </div>
                {todo.notes ? <p>{todo.notes}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No completed tasks yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
