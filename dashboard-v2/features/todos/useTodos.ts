"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api/client";
import type { Todo, TodoTag, TodoPerson } from "@/lib/api/types";

type UseTodosReturn = {
  todos: Todo[];
  tags: TodoTag[];
  people: TodoPerson[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  createTodo: (todo: Partial<Todo>) => Promise<void>;
  updateTodo: (id: number, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
};

export function useTodos(): UseTodosReturn {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<TodoTag[]>([]);
  const [people, setPeople] = useState<TodoPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    try {
      const response = await apiFetch<{ todos: Todo[] }>("/api/todos?include_done=true");
      setTodos(response.todos || []);
    } catch (err) {
      console.error("Error fetching todos:", err);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const response = await apiFetch<{ tags: TodoTag[] }>("/api/todo-tags");
      setTags(response.tags || []);
    } catch (err) {
      console.error("Error fetching tags:", err);
    }
  }, []);

  const fetchPeople = useCallback(async () => {
    try {
      const response = await apiFetch<{ people: TodoPerson[] }>("/api/todo-people");
      setPeople(response.people || []);
    } catch (err) {
      console.error("Error fetching people:", err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchTodos(), fetchTags(), fetchPeople()]);
    } catch (err) {
      setError("Failed to load todos.");
    } finally {
      setLoading(false);
    }
  }, [fetchTodos, fetchTags, fetchPeople]);

  const createTodo = useCallback(async (todo: Partial<Todo>) => {
    try {
      await apiFetch("/api/todos", { method: "POST", body: todo });
      await fetchTodos();
    } catch (err) {
      setError("Failed to create todo.");
      throw err;
    }
  }, [fetchTodos]);

  const updateTodo = useCallback(async (id: number, updates: Partial<Todo>) => {
    try {
      await apiFetch(`/api/todos/${id}`, { method: "PATCH", body: updates });
      await fetchTodos();
    } catch (err) {
      setError("Failed to update todo.");
      throw err;
    }
  }, [fetchTodos]);

  const deleteTodo = useCallback(async (id: number) => {
    try {
      await apiFetch(`/api/todos/${id}`, { method: "DELETE" });
      await fetchTodos();
    } catch (err) {
      setError("Failed to delete todo.");
      throw err;
    }
  }, [fetchTodos]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    todos,
    tags,
    people,
    loading,
    error,
    refresh: loadData,
    createTodo,
    updateTodo,
    deleteTodo
  };
}
