"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api/client";
import type { HermesMessage } from "@/lib/api/types";

type UseChatSessionReturn = {
  messages: HermesMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
};

export function useChatSession(): UseChatSessionReturn {
  const [messages, setMessages] = useState<HermesMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: HermesMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ reply: string }>("/api/hermes-converse", {
        method: "POST",
        body: { message: content }
      });

      const assistantMessage: HermesMessage = {
        role: "assistant",
        content: response.reply,
        timestamp: new Date().toISOString()
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setError("Failed to get response from Hermes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages
  };
}
