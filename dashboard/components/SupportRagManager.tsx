"use client";

import { useEffect, useMemo, useState } from "react";

type Reply = {
  id?: number | string | null;
  role?: string | null;
  user_id?: number | string | null;
  user_name?: string | null;
  message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Match = {
  doc_id: string;
  score: number;
  ticket_id: string;
  subject: string;
  category: string;
  customer_message: string;
  staff_reply: string;
};

type Suggestion = {
  id: number;
  ticket_id: number;
  status: string;
  subject: string | null;
  suggested_reply: string;
  final_reply: string | null;
  confidence: "low" | "medium" | "high";
  requires_human_attention: boolean;
  retrieval_backend: string | null;
  matched_examples: Match[];
  policy_flags: string[];
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

type Ticket = {
  id: number;
  ticket_number?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  category?: string | null;
  message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  const [drafts, setDrafts] = useState<Record<number, Suggestion>>({});
  const [replyEdits, setReplyEdits] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeTickets = useMemo(
    () => tickets.filter((ticket) => {
      const suggestion = drafts[ticket.id] || ticket.latest_suggestion;
      return suggestion?.status !== "sent" && suggestion?.status !== "ignored";
    }),
    [drafts, tickets]
  );

  async function loadTickets() {
    setIsLoading(true);
    setError(null);
    try {
      const data: TicketsPayload = await fetch("/api/support-rag/tickets?statuses=open,replied&limit=25").then(readJson);
      setTickets(data.tickets || []);
      const initialDrafts: Record<number, Suggestion> = {};
      const initialEdits: Record<number, string> = {};
      for (const ticket of data.tickets || []) {
        if (ticket.latest_suggestion && ticket.latest_suggestion.status === "draft") {
          initialDrafts[ticket.id] = ticket.latest_suggestion;
          initialEdits[ticket.id] = ticket.latest_suggestion.suggested_reply;
        }
      }
      setDrafts(initialDrafts);
      setReplyEdits(initialEdits);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

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

  async function suggest(ticket: Ticket) {
    setBusyKey(`suggest-${ticket.id}`);
    setError(null);
    setNotice(null);
    try {
      const data = await fetch("/api/support-rag/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          message: ticket.message,
          owner_name: ticket.owner_name,
          owner_email: ticket.owner_email,
          replies: ticket.replies || []
        })
      }).then(readJson);
      const suggestion = data.suggestion as Suggestion;
      setDrafts((current) => ({ ...current, [ticket.id]: suggestion }));
      setReplyEdits((current) => ({ ...current, [ticket.id]: suggestion.suggested_reply }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function send(ticket: Ticket, suggestion: Suggestion) {
    const reply = (replyEdits[ticket.id] || suggestion.suggested_reply).trim();
    if (!reply) return;

    setBusyKey(`send-${ticket.id}`);
    setError(null);
    setNotice(null);
    try {
      const data = await fetch("/api/support-rag/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion_id: suggestion.id,
          ticket_id: ticket.id,
          reply
        })
      }).then(readJson);
      const updated = data.suggestion as Suggestion;
      setDrafts((current) => ({ ...current, [ticket.id]: updated }));
      setNotice(`Reply sent for ticket ${ticket.ticket_number || ticket.id}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function ignore(ticket: Ticket, suggestion: Suggestion) {
    setBusyKey(`ignore-${ticket.id}`);
    setError(null);
    setNotice(null);
    try {
      const data = await fetch("/api/support-rag/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion_id: suggestion.id, status: "ignored" })
      }).then(readJson);
      setDrafts((current) => ({ ...current, [ticket.id]: data.suggestion as Suggestion }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function copyReply(ticket: Ticket, suggestion: Suggestion) {
    const reply = (replyEdits[ticket.id] || suggestion.suggested_reply).trim();
    if (!reply) return;
    await navigator.clipboard.writeText(reply);
    setNotice(`Copied reply for ticket ${ticket.ticket_number || ticket.id}.`);
  }

  return (
    <div className="support-rag-layout">
      <section className="support-rag-toolbar">
        <div>
          <h2>Reply queue</h2>
          <p className="muted">Review generated drafts before sending them to Vityarthi.</p>
        </div>
        <div className="support-rag-actions">
          <button className="button" type="button" onClick={loadTickets} disabled={isLoading || busyKey !== null}>
            Refresh
          </button>
          <button className="button primary" type="button" onClick={rebuildIndex} disabled={busyKey !== null}>
            {busyKey === "index" ? "Indexing..." : "Rebuild index"}
          </button>
        </div>
      </section>

      {error ? <div className="support-rag-alert error">{error}</div> : null}
      {notice ? <div className="support-rag-alert">{notice}</div> : null}

      {isLoading ? (
        <div className="invoice-empty">Loading support tickets...</div>
      ) : activeTickets.length === 0 ? (
        <div className="invoice-empty">No reviewable support tickets found.</div>
      ) : (
        <div className="support-ticket-list">
          {activeTickets.map((ticket) => {
            const suggestion = drafts[ticket.id] || ticket.latest_suggestion || null;
            const busy = busyKey?.endsWith(`-${ticket.id}`);
            const editValue = suggestion ? replyEdits[ticket.id] ?? suggestion.suggested_reply : "";

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
                    </div>
                  </div>
                  <button className="button" type="button" onClick={() => suggest(ticket)} disabled={Boolean(busy)}>
                    {busyKey === `suggest-${ticket.id}` ? "Generating..." : suggestion ? "Regenerate" : "Generate"}
                  </button>
                </div>

                <div className="support-ticket-grid">
                  <section>
                    <h4>Latest customer message</h4>
                    <p>{latestCustomerText(ticket) || ticket.message || "No customer message in payload."}</p>
                  </section>

                  <section>
                    <h4>Draft reply</h4>
                    {suggestion ? (
                      <>
                        <div className="support-rag-badges">
                          <span className={`support-confidence confidence-${suggestion.confidence}`}>
                            {confidenceLabel(suggestion.confidence)}
                          </span>
                          <span>{suggestion.retrieval_backend || "retrieval unknown"}</span>
                          {suggestion.requires_human_attention ? <span>Needs review</span> : null}
                        </div>
                        <textarea
                          rows={7}
                          value={editValue}
                          onChange={(event) => setReplyEdits((current) => ({ ...current, [ticket.id]: event.target.value }))}
                        />
                        {suggestion.policy_flags.length > 0 ? (
                          <div className="support-policy-flags">
                            {suggestion.policy_flags.map((flag) => (
                              <p key={flag}>{flag}</p>
                            ))}
                          </div>
                        ) : null}
                        <div className="support-rag-actions">
                          <button className="button primary" type="button" onClick={() => send(ticket, suggestion)} disabled={Boolean(busy) || !editValue.trim()}>
                            {busyKey === `send-${ticket.id}` ? "Sending..." : "Send approved"}
                          </button>
                          <button className="button" type="button" onClick={() => copyReply(ticket, suggestion)} disabled={!editValue.trim()}>
                            Copy
                          </button>
                          <button className="text-button" type="button" onClick={() => ignore(ticket, suggestion)} disabled={Boolean(busy)}>
                            Ignore
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="muted">Generate a grounded draft from historical replies.</p>
                    )}
                  </section>
                </div>

                {suggestion && suggestion.matched_examples.length > 0 ? (
                  <details className="support-matches">
                    <summary>Matched examples</summary>
                    <div className="support-match-list">
                      {suggestion.matched_examples.slice(0, 3).map((match) => (
                        <div className="support-match" key={match.doc_id}>
                          <div>
                            <strong>{match.subject}</strong>
                            <span>{match.category} · score {match.score.toFixed(2)}</span>
                          </div>
                          <p>{match.staff_reply}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
