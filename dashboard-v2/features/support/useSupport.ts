"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api/client";
import type { SupportTicket, SupportSuggestion } from "@/lib/api/types";

type UseSupportReturn = {
  tickets: SupportTicket[];
  selectedTicket: SupportTicket | null;
  suggestion: SupportSuggestion | null;
  loading: boolean;
  generating: boolean;
  sending: boolean;
  error: string | null;
  selectTicket: (id: number) => void;
  generateSuggestion: (ticketId: number) => Promise<void>;
  updateDraft: (text: string) => void;
  sendReply: (ticketId: number, reply: string) => Promise<void>;
  rebuildIndex: () => Promise<void>;
  refresh: () => void;
};

export function useSupport(): UseSupportReturn {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [suggestion, setSuggestion] = useState<SupportSuggestion | null>(null);
  const [, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const response = await apiFetch<{ tickets: SupportTicket[] }>("/api/support-rag/tickets");
      setTickets(response.tickets || []);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchTickets();
    setLoading(false);
  }, [fetchTickets]);

  const selectTicket = useCallback((id: number) => {
    const ticket = tickets.find((t) => t.id === id) || null;
    setSelectedTicket(ticket);
    setSuggestion(null);
    setDraft("");
  }, [tickets]);

  const generateSuggestion = useCallback(async (ticketId: number) => {
    setGenerating(true);
    setError(null);
    try {
      const response = await apiFetch<SupportSuggestion>("/api/support-rag/suggest", {
        method: "POST",
        body: { ticket_id: ticketId }
      });
      setSuggestion(response);
      setDraft(response.suggestion_text || "");
    } catch {
      setError("Failed to generate suggestion.");
    } finally {
      setGenerating(false);
    }
  }, []);

  const sendReply = useCallback(async (ticketId: number, reply: string) => {
    setSending(true);
    setError(null);
    try {
      await apiFetch("/api/support-rag/send", {
        method: "POST",
        body: { ticket_id: ticketId, reply }
      });
      await fetchTickets();
      setSelectedTicket(null);
      setSuggestion(null);
      setDraft("");
    } catch (err) {
      setError("Failed to send reply.");
      throw err;
    } finally {
      setSending(false);
    }
  }, [fetchTickets]);

  const rebuildIndex = useCallback(async () => {
    try {
      await apiFetch("/api/support-rag/index", { method: "POST", body: {} });
    } catch {
      setError("Failed to rebuild index.");
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  return {
    tickets,
    selectedTicket,
    suggestion,
    loading,
    generating,
    sending,
    error,
    selectTicket,
    generateSuggestion,
    updateDraft: (text: string) => { setDraft(text); },
    sendReply,
    rebuildIndex,
    refresh: loadTickets
  };
}
