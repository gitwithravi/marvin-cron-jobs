"use client";

import { useEffect, useMemo, useState } from "react";

type Suggestion = {
  id: number;
  status: string;
  confidence: "low" | "medium" | "high";
  requires_human_attention: boolean;
  retrieval_backend: string | null;
  updated_at: string;
};

type Reply = {
  id?: number | string | null;
  role?: string | null;
  message?: string | null;
};

type Ticket = {
  id: number;
  ticket_number?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  category?: string | null;
  message?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  replies?: Reply[];
  latest_suggestion?: Suggestion | null;
};

type TicketsPayload = {
  tickets: Ticket[];
};

function readJson(response: Response) {
  return response.json().then((data) => {
    if (!response.ok) {
      const detail = data?.detail || data?.error || "Request failed";
      throw new Error(detail);
    }
    return data;
  });
}

function latestCustomerText(ticket: Ticket) {
  const customerReplies = (ticket.replies || [])
    .filter((reply) => ["customer", "student", "user"].includes(String(reply.role || "").toLowerCase()))
    .map((reply) => reply.message || "")
    .filter(Boolean);
  return customerReplies.at(-1) || ticket.message || "";
}

function confidenceLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SupportRagManager() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadTickets(options?: { syncFirst?: boolean }) {
    setIsLoading(true);
    setError(null);
    try {
      if (options?.syncFirst) {
        const sync = await fetch("/api/agent-runs/support-reply/sync?limit=25", {
          method: "POST"
        }).then(readJson);
        if (sync.created_count > 0) {
          setNotice(`Queued ${sync.created_count} new approval${sync.created_count === 1 ? "" : "s"}.`);
        }
      }
      const data: TicketsPayload = await fetch("/api/support-rag/tickets?statuses=open&limit=25").then(readJson);
      setTickets(data.tickets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTickets({ syncFirst: true });
  }, []);

  const queuedCount = useMemo(
    () => tickets.filter((ticket) => ticket.latest_suggestion?.status === "draft").length,
    [tickets]
  );

  async function rebuildIndex() {
    setBusyKey("index");
    setError(null);
    setNotice(null);
    try {
      const data = await fetch("/api/support-rag/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_qdrant: true })
      }).then(readJson);
      setNotice(`Indexed ${data.examples} examples${data.qdrant_error ? "; Qdrant fallback is active" : ""}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="support-rag-layout">
      <section className="support-rag-toolbar">
        <div>
          <h2>Support intake</h2>
          <p className="muted">Open tickets are synced into the shared approval workflow automatically.</p>
        </div>
        <div className="support-rag-actions">
          <a className="button" href="/console/approvals">
            Open approvals
          </a>
          <button className="button" type="button" onClick={() => loadTickets({ syncFirst: true })} disabled={isLoading || busyKey !== null}>
            Refresh
          </button>
          <button className="button primary" type="button" onClick={rebuildIndex} disabled={busyKey !== null}>
            {busyKey === "index" ? "Indexing..." : "Rebuild index"}
          </button>
        </div>
      </section>

      <div className="support-rag-alert">
        {queuedCount} tickets currently have a draft suggestion on record. New open tickets are queued for approval automatically.
      </div>

      {error ? <div className="support-rag-alert error">{error}</div> : null}
      {notice ? <div className="support-rag-alert">{notice}</div> : null}

      {isLoading ? (
        <div className="invoice-empty">Loading support tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="invoice-empty">No reviewable support tickets found.</div>
      ) : (
        <div className="support-ticket-list">
          {tickets.map((ticket) => {
            const suggestion = ticket.latest_suggestion;
            return (
              <article className="support-ticket-item" key={ticket.id}>
                <div className="support-ticket-header">
                  <div>
                    <p className="eyebrow">{ticket.ticket_number || `Ticket ${ticket.id}`}</p>
                    <h3>{ticket.subject || "Untitled ticket"}</h3>
                    <div className="support-ticket-meta">
                      <span>{ticket.status || "unknown"}</span>
                      <span>{ticket.priority || "priority unknown"}</span>
                        <span>{ticket.owner_name || ticket.owner_email || "owner unknown"}</span>
                        {suggestion ? (
                          <span className={`support-confidence confidence-${suggestion.confidence}`}>
                            {confidenceLabel(suggestion.confidence)}
                          </span>
                        ) : null}
                      </div>
                  </div>
                  <span className="approval-status approval-status-pending">Auto queued</span>
                </div>

                <div className="support-ticket-grid">
                  <section>
                    <h4>Latest customer message</h4>
                    <p>{latestCustomerText(ticket) || "No customer message in payload."}</p>
                  </section>

                  <section>
                    <h4>Current draft status</h4>
                    {suggestion ? (
                      <div className="support-ticket-state">
                        <div className="support-rag-badges">
                          <span>{suggestion.status}</span>
                          <span>{suggestion.retrieval_backend || "retrieval unknown"}</span>
                          {suggestion.requires_human_attention ? <span>Needs review</span> : null}
                        </div>
                        <p className="muted">Last updated {new Date(suggestion.updated_at).toLocaleString()}.</p>
                        <p className="muted">Queueing again creates a fresh approval item with a newly generated draft.</p>
                      </div>
                    ) : (
                      <p className="muted">No draft has been generated for this ticket yet.</p>
                    )}
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
