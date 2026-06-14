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
    return { memberCount: members.length, taskCount, blockedCount };
  }, [payload]);

  return (
    <div className="team-status-stack">
      <section className="team-status-toolbar">
        <div>
          <p className="eyebrow">Filter</p>
          <label>
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        </div>
        <div className="team-status-summary" aria-label="Team status summary">
          <span>
            <strong>{summary.memberCount}</strong>
            members
          </span>
          <span>
            <strong>{summary.taskCount}</strong>
            tasks
          </span>
          <span>
            <strong>{summary.blockedCount}</strong>
            blocked
          </span>
        </div>
        <button className="button" type="button" onClick={() => refresh(selectedDate)} disabled={isLoading}>
          Refresh
        </button>
      </section>

      {error && <p className="error-banner">{error}</p>}

      {isLoading ? (
        <section className="empty-state">
          <h2>Loading team status</h2>
          <p className="muted">Fetching live task data for {selectedDate}.</p>
        </section>
      ) : payload && payload.members.length > 0 ? (
        <section className="team-member-grid" aria-label="Team members">
          {payload.members.map((member) => (
            <article className="team-member-card" key={`${member.id ?? member.name}`}>
              <div className="team-member-header">
                <div>
                  <h2>{member.name}</h2>
                  <p>{member.task_count} tasks on {payload.date}</p>
                </div>
              </div>

              <div className="team-status-counts" aria-label={`${member.name} status counts`}>
                {statusOrder.map((status) => (
                  <span className={`team-status-pill status-${status}`} key={status}>
                    {label(status)} {member.status_counts[status] ?? 0}
                  </span>
                ))}
              </div>

              {member.tasks.length > 0 ? (
                <ul className="team-task-list">
                  {member.tasks.map((task, index) => (
                    <li className="team-task-item" key={`${task.id ?? "task"}-${index}`}>
                      <div className="team-task-header">
                        <h3>{task.title || "Untitled task"}</h3>
                        {task.status && (
                          <span className={`team-task-status status-${task.status}`}>
                            {label(task.status)}
                          </span>
                        )}
                      </div>
                      {task.project_name && <p className="team-task-project">{task.project_name}</p>}
                      {task.notes && <p className="muted">{task.notes}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="team-empty-member">
                  <h3>No tasks logged</h3>
                  <p className="muted">Nothing came back from the live API for this date.</p>
                </div>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No team members found</h2>
          <p className="muted">The live team status API returned an empty roster for {selectedDate}.</p>
        </section>
      )}
    </div>
  );
}
