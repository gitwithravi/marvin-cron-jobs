"use client";

import { useEffect, useMemo, useState } from "react";

type TeamTask = {
  id: number | string | null;
  title: string | null;
  status: string | null;
  work_date: string | null;
  project_name: string | null;
  notes: string | null;
};

type TeamMember = {
  id: number | string | null;
  name: string;
  task_count: number;
  status_counts: Record<string, number>;
  tasks: TeamTask[];
};

type TeamStatusPayload = {
  date: string;
  members: TeamMember[];
};

const statusOrder = ["blocked", "in_progress", "planned", "done"];

function todayLocal() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function label(value: string) {
  return value.replace(/_/g, " ");
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

async function readJson(response: Response) {
  const text = await response.text();
  let data: { detail?: string; error?: string } & Record<string, unknown> = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      const fallback = text.trim().slice(0, 180);
      throw new Error(
        response.ok
          ? "Team status API returned an invalid response."
          : fallback || `Team status API returned HTTP ${response.status}.`
      );
    }
  }

  if (!response.ok) {
    throw new Error(data.detail || data.error || `Team status API returned HTTP ${response.status}.`);
  }

  if (!text.trim()) {
    throw new Error("Team status API returned an empty response.");
  }

  return data;
}

export function TeamStatusBoard() {
  const [selectedDate, setSelectedDate] = useState(todayLocal);
  const [payload, setPayload] = useState<TeamStatusPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh(date: string) {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetch(`/api/team-status?date=${encodeURIComponent(date)}`).then(readJson);
      setPayload({
        date: typeof data.date === "string" ? data.date : date,
        members: Array.isArray(data.members) ? data.members : []
      });
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh(selectedDate);
  }, [selectedDate]);

  const summary = useMemo(() => {
    const members = payload?.members ?? [];
    const taskCount = members.reduce((total, member) => total + member.task_count, 0);
    const blockedCount = members.reduce(
      (total, member) => total + (member.status_counts.blocked ?? 0),
      0
    );
    const inProgressCount = members.reduce(
      (total, member) => total + (member.status_counts.in_progress ?? 0),
      0
    );
    return { memberCount: members.length, taskCount, blockedCount, inProgressCount };
  }, [payload]);

  return (
    <div className="team-status-stack">
      <section className="team-status-toolbar">
        <div className="team-toolbar-left">
          <div>
            <p className="eyebrow">Team Status</p>
            <h2>{summary.memberCount} members</h2>
          </div>
          <div className="team-toolbar-date">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="team-status-summary" aria-label="Team status summary">
          <div className="summary-stat">
            <span className="summary-stat-value">{summary.taskCount}</span>
            <span className="summary-stat-label">Tasks</span>
          </div>
          <div className="summary-stat summary-stat-active">
            <span className="summary-stat-value">{summary.inProgressCount}</span>
            <span className="summary-stat-label">In Progress</span>
          </div>
          <div className="summary-stat summary-stat-blocked">
            <span className="summary-stat-value">{summary.blockedCount}</span>
            <span className="summary-stat-label">Blocked</span>
          </div>
        </div>
        <button className="button team-refresh-btn" type="button" onClick={() => refresh(selectedDate)} disabled={isLoading}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </section>

      {error && <p className="error-banner">{error}</p>}

      {isLoading ? (
        <section className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h2>Loading team status</h2>
          <p className="muted">Fetching live task data for {selectedDate}.</p>
        </section>
      ) : payload && payload.members.length > 0 ? (
        <section className="team-member-grid" aria-label="Team members">
          {payload.members.map((member) => {
            const activeTasks = member.tasks.filter((t) => t.status !== "done");
            const doneTasks = member.tasks.filter((t) => t.status === "done");
            return (
              <article className="team-member-card" key={`${member.id ?? member.name}`}>
                <div className="team-member-header">
                  <div className="team-member-info">
                    <h2>{member.name}</h2>
                    <p>{member.task_count} task{member.task_count === 1 ? "" : "s"} on {payload.date}</p>
                  </div>
                </div>

                <div className="team-status-counts" aria-label={`${member.name} status counts`}>
                  {statusOrder.map((status) => {
                    const count = member.status_counts[status] ?? 0;
                    if (count === 0) return null;
                    return (
                      <span className={`team-status-pill status-${status}`} key={status}>
                        {count}
                      </span>
                    );
                  })}
                </div>

                {member.tasks.length > 0 ? (
                  <div className="team-task-section">
                    {activeTasks.length > 0 && (
                      <ul className="team-task-list">
                        {activeTasks.map((task, index) => (
                          <li className="team-task-item" key={`${task.id ?? "task"}-${index}`}>
                            <div className="team-task-top">
                              <h3>{task.title || "Untitled task"}</h3>
                              {task.status && (
                                <span className={`team-task-status status-${task.status}`}>
                                  {label(task.status)}
                                </span>
                              )}
                            </div>
                            {task.project_name && <p className="team-task-project">{task.project_name}</p>}
                            {task.notes && <p className="team-task-notes">{truncateText(task.notes, 140)}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {doneTasks.length > 0 && (
                      <details className="team-done-section">
                        <summary>
                          <span>{doneTasks.length} completed</span>
                        </summary>
                        <ul className="team-task-list team-done-list">
                          {doneTasks.map((task, index) => (
                            <li className="team-task-item team-task-done" key={`${task.id ?? "task"}-done-${index}`}>
                              <div className="team-task-top">
                                <h3>{task.title || "Untitled task"}</h3>
                                <span className="team-task-status status-done">Done</span>
                              </div>
                              {task.project_name && <p className="team-task-project">{task.project_name}</p>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ) : (
                  <div className="team-empty-member">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    <h3>No tasks logged</h3>
                    <p className="muted">Nothing came back from the live API for this date.</p>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        <section className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h2>No team members found</h2>
          <p className="muted">The live team status API returned an empty roster for {selectedDate}.</p>
        </section>
      )}
    </div>
  );
}
