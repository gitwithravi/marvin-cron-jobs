import Link from "next/link";
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

function timeAgo(value: string | null | undefined): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function TaskCard({ task }: { task: TaskSummary }) {
  const riskClass = task.riskLevel ? `risk-badge risk-${task.riskLevel}` : "risk-badge";

  return (
    <Link className="task-card" href={`/dashboard/reports/${task.taskName}`} aria-labelledby={`${task.taskName}-title`}>
      <div className="task-card-top">
        <div className="task-card-info">
          <h2 id={`${task.taskName}-title`}>{task.displayName}</h2>
          <p className="task-card-subtitle">{task.taskName}</p>
        </div>
        <span className={riskClass}>{task.riskLevel ?? "unknown"}</span>
      </div>
      <div className="task-card-meta">
        <div className="task-meta-item">
          <span className="task-meta-label">Latest</span>
          <span className="task-meta-value">{formatDate(task.latestReport?.modifiedAt)}</span>
          {task.latestReport?.modifiedAt && (
            <span className="task-meta-ago">{timeAgo(task.latestReport.modifiedAt)}</span>
          )}
        </div>
        <div className="task-meta-item">
          <span className="task-meta-label">Reports</span>
          <span className="task-meta-value">{task.reportCount}</span>
        </div>
      </div>
    </Link>
  );
}
