/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { JsonViewer } from "@/components/JsonViewer";

type ReportDetailViewProps = {
  run: any;
};

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
        <div>
          <p className="eyebrow">Run #{run.id}</p>
          <h2>{run.task_name}</h2>
          <p className="muted">
            Status: <span className={`status-text ${run.status}`}>{run.status}</span>
          </p>
        </div>
        <div className="toolbar-actions">
          {summary ? (
            <span className="summary-badge">Cached Marvin Summary</span>
          ) : (
            <button
              className="button primary"
              type="button"
              disabled={loading}
              onClick={handleGenerateSummary}
            >
              {loading ? "Thinking..." : "Generate Marvin Summary"}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          <strong>Error summarizing:</strong> {error}
        </div>
      )}

      {run.error && (
        <details className="error-details">
          <summary>Traceback / Error Details</summary>
          <pre><code>{run.error}</code></pre>
        </details>
      )}

      <div className="detail-grid">
        <section className="analysis-section report-card">
          <h3>Deterministic Analysis</h3>
          <div className="analysis-card">
            <div className="risk-header">
              <span className={`risk risk-${run.risk_level}`}>
                Risk: {run.risk_level || "unknown"}
              </span>
            </div>
            <p className="summary-text">{detAnalysis.summary || "No deterministic summary available."}</p>
            
            {notableFacts.length > 0 && (
              <div className="facts-list">
                <h4>Notable Facts</h4>
                <ul>
                  {notableFacts.map((fact: string, idx: number) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}

            {recommendedActions.length > 0 && (
              <div className="actions-list">
                <h4>Recommended Actions</h4>
                <ul>
                  {recommendedActions.map((action: string, idx: number) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {summary && (
          <section className="marvin-section animate-fade-in report-card">
            <h3 className="marvin-title">Marvin&apos;s Analysis (LLM)</h3>
            <div className="marvin-card">
              <div className="risk-header">
                <span className={`risk risk-${summary.risk_level || run.risk_level}`}>
                  Risk: {summary.risk_level || run.risk_level || "unknown"}
                </span>
              </div>
              <p className="summary-text marvin-quote">
                &quot;{summary.summary || "No summary content returned."}&quot;
              </p>
              
              {summary.notable_facts && summary.notable_facts.length > 0 && (
                <div className="facts-list">
                  <h4>Notable Facts</h4>
                  <ul>
                    {summary.notable_facts.map((fact: string, idx: number) => (
                      <li key={idx}>{fact}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.recommended_actions && summary.recommended_actions.length > 0 && (
                <div className="actions-list">
                  <h4>Recommended Actions</h4>
                  <ul>
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
        <div className="factual-payload-section">
          <JsonViewer data={run.factual_payload} raw={JSON.stringify(run.factual_payload, null, 2)} />
        </div>
      )}
    </div>
  );
}
