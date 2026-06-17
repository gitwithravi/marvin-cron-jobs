/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { JsonViewer } from "@/components/JsonViewer";

type ReportDetailViewProps = {
  run: any;
};

function timeAgo(value: string | null | undefined): string {
  if (!value) return "unknown";
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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function ReportDetailView({ run }: ReportDetailViewProps) {
  const [summary, setSummary] = useState<any>(run.summary?.summary_json || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/runs/${run.id}/summary?task_name=${encodeURIComponent(run.task_name)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to generate summary");
      }
      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const detAnalysis = run.deterministic_analysis || {};
  const notableFacts = detAnalysis.notable_facts || [];
  const recommendedActions = detAnalysis.recommended_actions || [];

  return (
    <div className="report-detail-view">
      <header className="report-toolbar">
        <div className="report-toolbar-info">
          <p className="eyebrow">Run #{run.id}</p>
          <h2>{run.task_name}</h2>
          <div className="report-toolbar-meta">
            <span className={`report-status report-status-${run.status}`}>{run.status}</span>
            {run.observed_at && (
              <span className="report-timestamp">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {timeAgo(run.observed_at)}
              </span>
            )}
            {run.observed_at && (
              <span className="report-timestamp-full">{formatDateTime(run.observed_at)}</span>
            )}
          </div>
        </div>
        <div className="report-toolbar-actions">
          {summary ? (
            <span className="summary-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Summary cached
            </span>
          ) : (
            <button
              className="button primary report-generate-btn"
              type="button"
              disabled={loading}
              onClick={handleGenerateSummary}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              {loading ? "Thinking..." : "Generate Summary"}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="report-error-banner">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span><strong>Error:</strong> {error}</span>
        </div>
      )}

      {run.error && (
        <details className="report-error-details">
          <summary>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Traceback / Error Details
          </summary>
          <pre><code>{run.error}</code></pre>
        </details>
      )}

      <div className="report-detail-grid">
        <section className="report-analysis-card">
          <div className="report-card-header">
            <h3>Deterministic Analysis</h3>
            <span className={`risk-badge risk-${run.risk_level}`}>
              {run.risk_level || "unknown"}
            </span>
          </div>
          <div className="report-card-body">
            <p className="report-summary-text">{detAnalysis.summary || "No deterministic summary available."}</p>

            {notableFacts.length > 0 && (
              <div className="report-facts-section">
                <h4>Notable Facts</h4>
                <ul className="report-facts-list">
                  {notableFacts.map((fact: string, idx: number) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}

            {recommendedActions.length > 0 && (
              <div className="report-actions-section">
                <h4>Recommended Actions</h4>
                <ul className="report-actions-list">
                  {recommendedActions.map((action: string, idx: number) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {summary && (
          <section className="report-analysis-card report-llm-card">
            <div className="report-card-header">
              <h3>Marvin&apos;s Analysis</h3>
              <span className={`risk-badge risk-${summary.risk_level || run.risk_level}`}>
                {summary.risk_level || run.risk_level || "unknown"}
              </span>
            </div>
            <div className="report-card-body">
              <p className="report-summary-text report-llm-quote">
                {summary.summary || "No summary content returned."}
              </p>

              {summary.notable_facts && summary.notable_facts.length > 0 && (
                <div className="report-facts-section">
                  <h4>Notable Facts</h4>
                  <ul className="report-facts-list">
                    {summary.notable_facts.map((fact: string, idx: number) => (
                      <li key={idx}>{fact}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.recommended_actions && summary.recommended_actions.length > 0 && (
                <div className="report-actions-section">
                  <h4>Recommended Actions</h4>
                  <ul className="report-actions-list">
                    {summary.recommended_actions.map((action: string, idx: number) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {run.factual_payload && (
        <div className="report-json-section">
          <JsonViewer data={run.factual_payload} raw={JSON.stringify(run.factual_payload, null, 2)} />
        </div>
      )}
    </div>
  );
}
