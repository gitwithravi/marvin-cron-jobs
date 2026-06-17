"use client";

import { useState, useEffect } from "react";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { apiFetch } from "@/lib/api/client";
import type { EmailCapture, EmailCaptureDetail } from "@/lib/api/types";
import { formatDateTime } from "@/lib/time";
import { Link as LinkIcon, AlertCircle } from "lucide-react";

export function EmailCaptures() {
  const [captures, setCaptures] = useState<EmailCapture[]>([]);
  const [selectedCapture, setSelectedCapture] = useState<EmailCaptureDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCaptures();
  }, []);

  const loadCaptures = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ captures: EmailCapture[] }>("/api/email-captures");
      setCaptures(response.captures || []);
    } catch {
      setError("Failed to load email captures.");
    } finally {
      setLoading(false);
    }
  };

  const selectCapture = async (id: number) => {
    try {
      const response = await apiFetch<{ capture: EmailCaptureDetail }>(`/api/email-captures/${id}`);
      setSelectedCapture(response.capture);
    } catch {
      setError("Failed to load capture detail.");
    }
  };

  if (loading) {
    return (
      <Panel>
        <LoadingState message="Loading email captures..." />
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

  if (captures.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No captured emails"
          message="The inbox has chosen silence."
        />
      </Panel>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing)", minHeight: "500px" }}>
      <Panel style={{ overflow: "auto", maxHeight: "calc(100vh - 320px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
          {captures.map((capture) => (
            <button
              key={capture.id}
              onClick={() => selectCapture(capture.id)}
              style={{
                width: "100%",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-xs)",
                padding: "var(--spacing-sm)",
                borderRadius: "var(--radius-sm)",
                background: capture.id === selectedCapture?.id ? "var(--surface-3)" : "var(--surface-2)",
                border: capture.id === selectedCapture?.id ? "1px solid var(--accent)" : "1px solid transparent",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>
                  {capture.subject}
                </span>
                {capture.is_duplicate && <AlertCircle size={14} style={{ color: "var(--warning)" }} />}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {capture.from_address}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                {formatDateTime(capture.received_at)}
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel style={{ overflow: "auto", maxHeight: "calc(100vh - 320px)" }}>
        {selectedCapture ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing)" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "var(--spacing-xs)" }}>
                {selectedCapture.subject}
              </h3>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                From: {selectedCapture.from_address}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                {formatDateTime(selectedCapture.received_at)}
              </div>
            </div>

            {selectedCapture.created_todo_ids && selectedCapture.created_todo_ids.length > 0 && (
              <div>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
                  Created todos
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-xs)" }}>
                  {selectedCapture.created_todo_ids.map((id) => (
                    <a
                      key={id}
                      href={`/console/work?todo=${id}`}
                      style={{
                        fontSize: "0.8rem",
                        padding: "4px 8px",
                        background: "var(--surface-2)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--accent)",
                        textDecoration: "none"
                      }}
                    >
                      <LinkIcon size={12} style={{ display: "inline", marginRight: "4px" }} />
                      Todo #{id}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selectedCapture.events && selectedCapture.events.length > 0 && (
              <div>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
                  Events
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-xs)" }}>
                  {selectedCapture.events.map((event, i) => (
                    <div key={i} style={{ fontSize: "0.8rem", padding: "var(--spacing-xs)", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ fontWeight: 500 }}>{event.event_type}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {formatDateTime(event.timestamp)}
                      </div>
                      {event.details && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-faint)", marginTop: "2px" }}>
                          {event.details}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCapture.body_preview && (
              <div>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
                  Preview
                </h4>
                <pre style={{ background: "var(--surface-2)", padding: "var(--spacing)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", fontFamily: "var(--font-mono)", overflow: "auto", whiteSpace: "pre-wrap" }}>
                  {selectedCapture.body_preview}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="No capture selected"
            message="Select a capture from the list to view details."
          />
        )}
      </Panel>
    </div>
  );
}
