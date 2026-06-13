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
  const riskClass = task.riskLevel ? `risk risk-${task.riskLevel}` : "risk";

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
          disabled
          title={marvinCopy.disabledRunTaskTitle}
        >
          {marvinCopy.disabledRunTask}
        </button>
      </div>
    </section>
  );
}
