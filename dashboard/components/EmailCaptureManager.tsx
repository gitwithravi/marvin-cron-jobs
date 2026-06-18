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

function timeAgo(value: string): string {
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

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
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

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    captures.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return counts;
  }, [captures]);

  return (
    <div className="email-capture-layout">
      <section className="email-capture-list-panel">
        <div className="email-capture-panel-header">
          <div>
            <p className="eyebrow">Inbound</p>
            <h2>{captures.length} captures</h2>
          </div>
          <button className="button email-capture-refresh-btn" onClick={refresh} disabled={isLoading} type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>

        {Object.keys(statusCounts).length > 0 && (
          <div className="email-capture-status-bar">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status} className={`capture-status-pill capture-status-${status}`}>
                {count} {status.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {error && <p className="error-banner">{error}</p>}
        {isLoading ? (
          <div className="email-capture-loading">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <p>Loading email captures...</p>
          </div>
        ) : captures.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <h2>No captured emails</h2>
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
                <div className="email-capture-row-top">
                  <strong className="email-capture-subject">{capture.subject || "No subject"}</strong>
                  <span className={`capture-status capture-status-${capture.status}`}>{capture.status.replace(/_/g, " ")}</span>
                </div>
                <div className="email-capture-row-bottom">
                  <span className="email-capture-from">{capture.from}</span>
                  <small className="email-capture-date">{timeAgo(capture.receivedAt)}</small>
                </div>
                {previewText(capture) && (
                  <p className="email-capture-preview">{truncateText(previewText(capture), 100)}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="email-capture-detail-panel">
        {detail ? (
          <>
            <div className="email-capture-detail-header">
              <div className="email-capture-detail-title">
                <p className="eyebrow">Capture detail</p>
                <h2>{detail.subject || "No subject"}</h2>
                <div className="email-capture-detail-meta">
                  <span className={`capture-status capture-status-${detail.status}`}>{detail.status.replace(/_/g, " ")}</span>
                  <span className="email-capture-detail-time">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {timeAgo(detail.receivedAt)}
                  </span>
                </div>
              </div>
              {detail.createdTaskId && (
                <Link className="button primary email-capture-todo-btn" href="/console/todos">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Open todos
                </Link>
              )}
            </div>

            {isDetailLoading && (
              <div className="email-capture-detail-loading">
                <p className="muted">Loading detail...</p>
              </div>
            )}

            <div className="capture-detail-grid">
              <div className="capture-detail-item">
                <dt>From</dt>
                <dd>{detail.from}</dd>
              </div>
              <div className="capture-detail-item">
                <dt>To</dt>
                <dd>{detail.to}</dd>
              </div>
              <div className="capture-detail-item">
                <dt>Received</dt>
                <dd>{formatDate(detail.receivedAt)}</dd>
              </div>
              <div className="capture-detail-item">
                <dt>Todo</dt>
                <dd>{detail.createdTaskId ? `#${detail.createdTaskId}` : "None"}</dd>
              </div>
              <div className="capture-detail-item">
                <dt>Notification</dt>
                <dd>{detail.notificationStatus || "not sent"}</dd>
              </div>
              {detail.messageId && (
                <div className="capture-detail-item">
                  <dt>Message ID</dt>
                  <dd className="capture-detail-mono">{detail.messageId}</dd>
                </div>
              )}
            </div>

            {detail.errorMessage && (
              <div className="capture-error-banner">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span><strong>Error:</strong> {detail.errorMessage}</span>
              </div>
            )}
            {detail.notificationError && (
              <div className="capture-error-banner">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span><strong>Notification error:</strong> {detail.notificationError}</span>
              </div>
            )}

            <div className="capture-preview">
              <div className="capture-section-header">
                <h3>Raw preview</h3>
                <span className="capture-section-badge">{previewText(detail).length} chars</span>
              </div>
              <pre>{previewText(detail).slice(0, 4000) || "No body captured."}</pre>
            </div>

            {detail.events && detail.events.length > 0 && (
              <div className="capture-events">
                <div className="capture-section-header">
                  <h3>Events</h3>
                  <span className="capture-section-badge">{detail.events.length}</span>
                </div>
                <div className="capture-events-timeline">
                  {detail.events.map((event, index) => (
                    <div className="capture-event-item" key={`${event.createdAt}-${event.eventName}`}>
                      <div className="capture-event-indicator">
                        <span className="capture-event-number">{index + 1}</span>
                        {index < detail.events!.length - 1 && <span className="capture-event-line" />}
                      </div>
                      <div className="capture-event-content">
                        <strong>{event.eventName}</strong>
                        <small>{formatDate(event.createdAt)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <h2>Select a capture</h2>
            <p className="muted">Capture metadata and raw previews appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
