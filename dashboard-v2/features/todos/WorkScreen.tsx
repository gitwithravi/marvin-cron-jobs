"use client";

import { useState } from "react";
import { useTodos } from "@/features/todos/useTodos";
import { TodoBoard } from "@/features/todos/TodoBoard";
import { FollowUps } from "@/features/todos/FollowUps";
import { EmailCaptures } from "@/features/todos/EmailCaptures";
import { TeamStatus } from "@/features/todos/TeamStatus";
import { TodoHistory } from "@/features/todos/TodoHistory";
import { Tabs } from "@/components/ui/Tabs";
import { Panel } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

export function WorkScreen() {
  const { todos, tags, people, loading, error, updateTodo } = useTodos();
  const [activeTab, setActiveTab] = useState("board");

  const inboxCount = todos.filter((t) => t.status.toLowerCase() === "inbox").length;
  const urgentCount = todos.filter((t) => (t.priority === "urgent" || t.priority === "high") && t.status.toLowerCase() !== "done").length;
  const waitingCount = todos.filter((t) => t.waiting_person && t.status.toLowerCase() !== "done").length;

  const tabs = [
    { id: "board", label: "Board" },
    { id: "followups", label: "Follow-ups", count: waitingCount },
    { id: "emails", label: "Email captures" },
    { id: "team", label: "Team" },
    { id: "history", label: "History" }
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Work</h1>
        <Panel>
          <LoadingState message="Loading work..." />
        </Panel>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Work</h1>
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Work</h1>

      <Panel style={{ background: "var(--surface-2)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--spacing)" }}>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
              INBOX
            </p>
            <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>{inboxCount}</p>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
              HIGH/URGENT
            </p>
            <p style={{ fontSize: "1.5rem", fontWeight: 600, color: urgentCount > 0 ? "var(--warning)" : "var(--text)" }}>
              {urgentCount}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
              WAITING ON OTHERS
            </p>
            <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>{waitingCount}</p>
          </div>
        </div>
      </Panel>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "board" && <TodoBoard todos={todos} tags={tags} onUpdate={updateTodo} />}
      {activeTab === "followups" && <FollowUps todos={todos} people={people} onUpdate={updateTodo} />}
      {activeTab === "emails" && <EmailCaptures />}
      {activeTab === "team" && <TeamStatus />}
      {activeTab === "history" && <TodoHistory todos={todos} />}
    </div>
  );
}
