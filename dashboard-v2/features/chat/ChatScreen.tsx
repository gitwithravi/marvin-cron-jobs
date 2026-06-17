"use client";

import { useState, useRef, useEffect } from "react";
import { useChatSession } from "@/features/chat/useChatSession";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatTime } from "@/lib/time";
import { Send, Trash2, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ChatScreen() {
  const { messages, loading, error, sendMessage, clearMessages } = useChatSession();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      await sendMessage(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)", height: "calc(100vh - 180px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Chat</h1>
        {messages.length > 0 && (
          <Button variant="secondary" icon={<Trash2 size={16} />} onClick={clearMessages}>
            Clear
          </Button>
        )}
      </div>

      {error && <ErrorState message={error} />}

      <Panel style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <p style={{ fontSize: "0.9rem" }}>Ask Hermes. MARVIN will judge silently.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing)" }}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "var(--spacing-sm)",
                  padding: "var(--spacing-sm)",
                  background: message.role === "user" ? "var(--surface-2)" : "var(--surface-3)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)"
                }}
              >
                <div style={{ flexShrink: 0, marginTop: "2px" }}>
                  {message.role === "user" ? (
                    <User size={16} style={{ color: "var(--accent)" }} />
                  ) : (
                    <Bot size={16} style={{ color: "var(--healthy)" }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {message.role === "user" ? "YOU" : "HERMES"}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
                    {message.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", gap: "var(--spacing-sm)", padding: "var(--spacing-sm)", background: "var(--surface-3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <Bot size={16} style={{ color: "var(--healthy)", flexShrink: 0, marginTop: "2px" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>
                    HERMES
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                    Waiting for Hermes...
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </Panel>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "var(--spacing-sm)" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Hermes..."
          disabled={loading}
          style={{
            flex: 1,
            minHeight: "60px",
            maxHeight: "120px",
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
        <Button
          variant="primary"
          icon={<Send size={16} />}
          type="submit"
          disabled={!input.trim() || loading}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
