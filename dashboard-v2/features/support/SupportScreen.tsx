"use client";

import { useSupport } from "@/features/support/useSupport";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDateTime } from "@/lib/time";
import { useState } from "react";
import { Sparkles, Send, RefreshCw, Database } from "lucide-react";

export function SupportScreen() {
  const {
    tickets,
    selectedTicket,
    suggestion,
    loading,
    generating,
    sending,
    error,
    selectTicket,
    generateSuggestion,
    sendReply,
    rebuildIndex,
    refresh
  } = useSupport();

  const [draft, setDraft] = useState("");
  const [showSendDialog, setShowSendDialog] = useState(false);

  const handleSelectTicket = (id: number) => {
    selectTicket(id);
    setDraft("");
  };

  const handleGenerate = async () => {
    if (selectedTicket) {
      await generateSuggestion(selectedTicket.id);
    }
  };

  const handleSend = async () => {
    if (selectedTicket && draft.trim()) {
      await sendReply(selectedTicket.id, draft);
      setShowSendDialog(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Support</h1>
        <Panel>
          <LoadingState message="Loading tickets..." />
        </Panel>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Support</h1>
        <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
          <Button variant="secondary" icon={<Database size={16} />} onClick={rebuildIndex}>
            Rebuild Index
          </Button>
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing)", minHeight: "600px" }}>
        <Panel style={{ overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
          {tickets.length === 0 ? (
            <EmptyState
              title="No tickets waiting"
              message="Someone may have fixed something. Alarming."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => handleSelectTicket(ticket.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--spacing-xs)",
                    padding: "var(--spacing-sm)",
                    borderRadius: "var(--radius-sm)",
                    background: ticket.id === selectedTicket?.id ? "var(--surface-3)" : "var(--surface-2)",
                    border: ticket.id === selectedTicket?.id ? "1px solid var(--accent)" : "1px solid transparent",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text)" }}>
                      {ticket.subject}
                    </span>
                    <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
                      #{ticket.id}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {ticket.status}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                    {formatDateTime(ticket.created_at)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel style={{ overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
          {selectedTicket ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing)" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "var(--spacing-xs)" }}>
                  {selectedTicket.subject}
                </h2>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Ticket #{selectedTicket.id} • {selectedTicket.status}
                </div>
              </div>

              {!suggestion && !generating && (
                <Button variant="primary" icon={<Sparkles size={16} />} onClick={handleGenerate}>
                  Generate suggestion
                </Button>
              )}

              {generating && <LoadingState message="Generating suggestion..." />}

              {suggestion && (
                <>
                  {suggestion.matched_examples && suggestion.matched_examples.length > 0 && (
                    <EvidenceBlock label="Matched examples">
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
                        {suggestion.matched_examples.map((example, i) => (
                          <div key={i} style={{ padding: "var(--spacing-xs)", background: "var(--surface-3)", borderRadius: "var(--radius-sm)" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 500, marginBottom: "4px" }}>
                              Q: {example.question}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              A: {example.answer}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                              Score: {example.score.toFixed(3)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </EvidenceBlock>
                  )}

                  <div>
                    <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "var(--spacing-xs)", color: "var(--text-muted)" }}>
                      Reply draft
                    </h3>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      style={{
                        width: "100%",
                        minHeight: "200px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--spacing)",
                        color: "var(--text)",
                        fontSize: "0.9rem",
                        fontFamily: "inherit",
                        resize: "vertical"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
                    <Button
                      variant="primary"
                      icon={<Send size={16} />}
                      onClick={() => setShowSendDialog(true)}
                      disabled={!draft.trim() || sending}
                    >
                      Send reply
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <EmptyState
              title="No ticket selected"
              message="Select a ticket from the queue to review and reply."
            />
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={showSendDialog}
        title="Send this reply?"
        message={`You are about to send a reply to ticket #${selectedTicket?.id}: ${selectedTicket?.subject}`}
        confirmLabel="Send"
        variant="primary"
        onConfirm={handleSend}
        onCancel={() => setShowSendDialog(false)}
      />
    </div>
  );
}
