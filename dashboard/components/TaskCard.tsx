"use client";

import { useState } from "react";
import Link from "next/link";
import { marvinCopy } from "@/lib/marvin-copy";
import type { TaskSummary } from "@/lib/tasks";

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "No reports yet";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function TaskCard({ task }: { task: TaskSummary }) {
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<"idle" | "success" | "error">("idle");
  const riskClass = task.riskLevel ? `risk risk-${task.riskLevel}` : "risk";

  const handleRunTask = async () => {
    setIsRunning(true);
    setRunStatus("idle");
    try {
      const response = await fetch("/api/mrvn-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_name: task.taskName, confirmed: true, params: {} })
      });
      if (!response.ok) {
        throw new Error("Task execution failed");
      }
      setRunStatus("success");
    } catch {
      setRunStatus("error");
    } finally {
      setIsRunning(false);
    }
  };

  const buttonLabel = isRunning
    ? marvinCopy.runTaskRunning
    : runStatus === "success"
    ? marvinCopy.runTaskSuccess
    : runStatus === "error"
    ? marvinCopy.runTaskError
    : marvinCopy.runTask;

  return (
    <section className="task-card" aria-labelledby={`${task.taskName}-title`}>
      <div className="task-card-header">
        <div>
          <h2 id={`${task.taskName}-title`}>{task.displayName}</h2>
          <p>{task.taskName}</p>
        </div>
        <span className={riskClass}>{task.riskLevel ?? "unknown"}</span>
      </div>
      <dl className="task-meta">
        <div>
          <dt>Latest report</dt>
          <dd>{formatDate(task.latestReport?.modifiedAt)}</dd>
        </div>
        <div>
          <dt>Report files</dt>
          <dd>{task.reportCount}</dd>
        </div>
      </dl>
      <div className="task-actions">
        <Link className="button primary" href={`/dashboard/reports/${task.taskName}`}>
          View reports
        </Link>
        <button
          className="button"
          type="button"
          disabled={isRunning}
          title={marvinCopy.runTaskTitle}
          onClick={handleRunTask}
        >
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}
