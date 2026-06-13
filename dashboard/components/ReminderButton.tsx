"use client";

import { useState } from "react";
import { MarkdownViewer } from "@/components/MarkdownViewer";

export function ReminderButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAlert() {
    setIsOpen(true);
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/alerts/latest");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.error || "Alert failed");
      }
      setMessage(data.message || "Generating your alert. Please check back in sometime.");
      setFileName(data.file_name || "");
      setCreatedAt(data.created_at || "");
      setIsGenerating(!data.exists);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshAlert() {
    setError("");
    setIsGenerating(true);
    try {
      const response = await fetch("/api/alerts/refresh", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.error || "Alert refresh failed");
      }
      setMessage(data.message || "Generating your alert. Please check back in sometime.");
      window.setTimeout(loadAlert, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsGenerating(false);
    }
  }

  return (
    <>
      <button className="icon-button reminder-trigger" onClick={loadAlert} title="Remind me" aria-label="Remind me">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8a6 6 0 0 0-12 0c0 4.499-1.411 5.956-2.738 7.326" />
        </svg>
      </button>
      {isOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
          <section className="reminder-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Alert</p>
                <h2>What needs attention</h2>
              </div>
              <button className="icon-button" onClick={() => setIsOpen(false)} aria-label="Close reminder">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {isLoading ? (
              <p className="muted">Checking latest alert...</p>
            ) : error ? (
              <p className="error-banner">{error}</p>
            ) : (
              <>
                <div className="alert-actions">
                  {fileName && <span className="status-chip">{fileName}</span>}
                  {createdAt && <span className="todo-date">{new Date(createdAt).toLocaleString()}</span>}
                  <button className="button" onClick={refreshAlert} disabled={isGenerating}>
                    {isGenerating ? "Generating..." : "Refresh"}
                  </button>
                </div>
                <div className="compact-markdown">
                  <MarkdownViewer markdown={message} />
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
