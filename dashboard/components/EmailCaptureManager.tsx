"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type EmailCaptureEvent = {
  eventName: string;
  event: Record<string, unknown>;
  createdAt: string;
};

type EmailCapture = {
  id: string;
  messageId: string | null;
  from: string;
  to: string;
  subject: string | null;
  receivedAt: string;
  rawEmailPath: string | null;
  textBody: string | null;
  htmlBody: string | null;
  status: string;
  errorMessage: string | null;
  createdTaskId: number | null;
  notificationStatus: string | null;
  notificationError: string | null;
  createdAt: string;
  updatedAt: string;
  events?: EmailCaptureEvent[];
};

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function previewText(capture: EmailCapture) {
  return (capture.textBody || capture.htmlBody || "").replace(/\s+/g, " ").trim();
}

export function EmailCaptureManager() {
  const [captures, setCaptures] = useState<EmailCapture[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCapture, setSelectedCapture] = useState<EmailCapture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async function refreshCaptures() {
    setError("");
    try {
      const data = await fetch("/api/email-captures?limit=75").then(readJson);
      setCaptures(data.captures || []);
      setSelectedId((current) => current || data.captures?.[0]?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    setIsDetailLoading(true);
    fetch(`/api/email-captures/${encodeURIComponent(selectedId)}`)
      .then(readJson)
      .then((data) => setSelectedCapture(data.capture || null))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setIsDetailLoading(false));
  }, [selectedId]);

  const selectedSummary = useMemo(
    () => captures.find((capture) => capture.id === selectedId) || null,
    [captures, selectedId]
  );
  const detail = selectedCapture?.id === selectedId ? selectedCapture : selectedSummary;

  return (
    <div className="email-capture-layout">
      <section className="email-capture-list-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inbound</p>
            <h2>{captures.length} captures</h2>
          </div>
          <button className="button" onClick={refresh} disabled={isLoading}>
            Refresh
          </button>
        </div>
        {error && <p className="error-banner">{error}</p>}
        {isLoading ? (
          <p className="muted">Loading email captures...</p>
        ) : captures.length === 0 ? (
          <div className="empty-state">
            <h2>No captured email</h2>
            <p className="muted">Forwarded emails will appear here after Cloudflare posts them.</p>
          </div>
        ) : (
          <div className="email-capture-list">
            {captures.map((capture) => (
              <button
                className={`email-capture-row ${capture.id === selectedId ? "selected" : ""}`}
                key={capture.id}
                onClick={() => setSelectedId(capture.id)}
                type="button"
              >
                <span className={`capture-status capture-status-${capture.status}`}>{capture.status}</span>
                <strong>{capture.subject || "No subject"}</strong>
                <span>{capture.from}</span>
                <small>{formatDate(capture.receivedAt)}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="email-capture-detail-panel">
        {detail ? (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Capture detail</p>
                <h2>{detail.subject || "No subject"}</h2>
              </div>
              {detail.createdTaskId && (
                <Link className="button primary" href="/dashboard/todos">
                  Open todos
                </Link>
              )}
            </div>
            {isDetailLoading && <p className="muted">Loading detail...</p>}
            <dl className="capture-detail-grid">
              <div>
                <dt>Received</dt>
                <dd>{formatDate(detail.receivedAt)}</dd>
              </div>
              <div>
                <dt>Forwarder</dt>
                <dd>{detail.from}</dd>
              </div>
              <div>
                <dt>Recipient</dt>
                <dd>{detail.to}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{detail.status}</dd>
              </div>
              <div>
                <dt>Todo</dt>
                <dd>{detail.createdTaskId ? `#${detail.createdTaskId}` : "None"}</dd>
              </div>
              <div>
                <dt>Notification</dt>
                <dd>{detail.notificationStatus || "not sent"}</dd>
              </div>
            </dl>
            {detail.errorMessage && <p className="error-banner">{detail.errorMessage}</p>}
            {detail.notificationError && <p className="error-banner">{detail.notificationError}</p>}
            <div className="capture-preview">
              <h3>Raw preview</h3>
              <pre>{previewText(detail).slice(0, 4000) || "No body captured."}</pre>
            </div>
            {detail.events && (
              <div className="capture-events">
                <h3>Events</h3>
                {detail.events.map((event) => (
                  <div key={`${event.createdAt}-${event.eventName}`}>
                    <span>{event.eventName}</span>
                    <small>{formatDate(event.createdAt)}</small>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h2>Select a capture</h2>
            <p className="muted">Capture metadata and raw previews appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
