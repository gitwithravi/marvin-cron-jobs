"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { truncateText } from "@/lib/utils/format";

type TeamTask = {
  id: number | string | null;
  title: string | null;
  status: string | null;
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

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data as TeamStatusPayload;
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
      setPayload(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPayload(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh(selectedDate);
  }, [selectedDate]);

  const summary = useMemo(() => {
    const members = payload?.members ?? [];
    return {
      memberCount: members.length,
      taskCount: members.reduce((total, member) => total + member.task_count, 0),
      blockedCount: members.reduce((total, member) => total + (member.status_counts.blocked ?? 0), 0)
    };
  }, [payload]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <Card>
          <CardContent className="p-5">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Date</span>
              <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Members" value={summary.memberCount} />
          <MetricCard label="Tasks" value={summary.taskCount} />
          <MetricCard label="Blocked" value={summary.blockedCount} />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading team status...</p>
      ) : payload && payload.members.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {payload.members.map((member) => (
            <Card key={`${member.id ?? member.name}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{member.name}</CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {member.task_count} task{member.task_count === 1 ? "" : "s"} on {payload.date}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(member.status_counts).map(([status, count]) =>
                      count > 0 ? (
                        <span key={status} className="text-xs text-muted-foreground">
                          {count} {status.replace(/_/g, " ")}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {member.tasks.map((task, index) => (
                  <div key={`${task.id ?? task.title}-${index}`} className="rounded-xl border border-border/60 bg-black/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{task.title || "Untitled task"}</p>
                        {task.project_name ? (
                          <p className="mt-1 text-sm text-muted-foreground">{task.project_name}</p>
                        ) : null}
                      </div>
                      <StatusBadge value={task.status} />
                    </div>
                    {task.notes ? (
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {truncateText(task.notes, 160)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No team data"
          description={`No tasks were returned for ${selectedDate}.`}
        />
      )}
    </div>
  );
}
