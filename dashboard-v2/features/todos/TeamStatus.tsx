"use client";

import { useState, useEffect, useCallback } from "react";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { apiFetch } from "@/lib/api/client";
import type { TeamStatusDay } from "@/lib/api/types";
import { formatDate } from "@/lib/time";
import { User, Calendar } from "lucide-react";

export function TeamStatus() {
  const [teamStatus, setTeamStatus] = useState<TeamStatusDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTeamStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ days: TeamStatusDay[] }>(`/api/team-status?date=${selectedDate}`);
      setTeamStatus(response.days || []);
    } catch {
      setError("Failed to load team status.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadTeamStatus();
  }, [loadTeamStatus]);

  if (loading) {
    return (
      <Panel>
        <LoadingState message="Loading team status..." />
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        <EmptyState title="Error" message={error} />
      </Panel>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing)" }}>
      <Panel style={{ background: "var(--surface-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
          <Calendar size={16} style={{ color: "var(--text-muted)" }} />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 10px",
              color: "var(--text)",
              fontSize: "0.85rem"
            }}
          />
        </div>
      </Panel>

      {teamStatus.length === 0 ? (
        <Panel>
          <EmptyState
            title="No team status for this date"
            message="No updates recorded for the selected date."
          />
        </Panel>
      ) : (
        teamStatus.map((day) => (
          <div key={day.date}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--spacing)" }}>
              {formatDate(day.date)}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--spacing)" }}>
              {day.members.map((member) => (
                <Panel key={member.name}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", marginBottom: "var(--spacing)" }}>
                    <User size={16} style={{ color: "var(--accent)" }} />
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 600 }}>{member.name}</h4>
                  </div>

                  {member.tasks.length === 0 ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-faint)" }}>No tasks reported</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-xs)" }}>
                      {member.tasks.map((task, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "var(--spacing-xs)",
                            background: "var(--surface-2)",
                            borderRadius: "var(--radius-sm)"
                          }}
                        >
                          <span style={{ fontSize: "0.85rem" }}>{task.title}</span>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              padding: "2px 6px",
                              background: "var(--surface-3)",
                              borderRadius: "var(--radius-sm)",
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-muted)"
                            }}
                          >
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
