"use client";

import React, { useState, useRef, useEffect } from "react";
import { marvinCopy } from "@/lib/marvin-copy";
import { MarkdownViewer } from "@/components/MarkdownViewer";

type Message = {
  id: string;
  sender: "user" | "marvin" | "hermes";
  text: string;
  isConfirm?: boolean;
  taskName?: string;
  params?: Record<string, string>;
  timestamp: Date;
};

type ChatMode = "marvin" | "hermes";

const initialConversations: Record<ChatMode, Message[]> = {
  marvin: [
    {
      id: "welcome-marvin",
      sender: "marvin",
      text: "I exist. What do you want? Don't make it complicated.",
      timestamp: new Date(),
    },
  ],
  hermes: [
    {
      id: "welcome-hermes",
      sender: "hermes",
      text: "Hermes is connected when the VM endpoint is configured. Ask your agent anything.",
      timestamp: new Date(),
    },
  ],
};

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<ChatMode>("marvin");
  const [conversations, setConversations] = useState<Record<ChatMode, Message[]>>(initialConversations);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(marvinCopy.chatThinking);
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const messages = conversations[activeMode];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        chatWindowRef.current &&
        !chatWindowRef.current.contains(event.target as Node)
      ) {
        // Only close if not clicking the toggle button
        const toggleBtn = document.getElementById("marvin-chat-toggle");
        if (toggleBtn && !toggleBtn.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const appendMessage = (mode: ChatMode, message: Message) => {
    setConversations((prev) => ({
      ...prev,
      [mode]: [...prev[mode], message],
    }));
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const mode = activeMode;
    const userText = inputValue;
    const previousMessages = conversations[mode];
    setInputValue("");

    // Add user message
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: userText,
      timestamp: new Date(),
    };
    appendMessage(mode, userMsg);
    setIsLoading(true);
    setLoadingText(mode === "hermes" ? marvinCopy.hermesChatThinking : marvinCopy.chatThinking);

    try {
      const body =
        mode === "hermes"
          ? {
              message: userText,
              history: previousMessages
                .filter((msg) => msg.id !== "welcome-hermes")
                .filter((msg) => msg.sender === "user" || msg.sender === "hermes")
                .map((msg) => ({
                  role: msg.sender === "user" ? "user" : "assistant",
                  content: msg.text,
                })),
            }
          : { message: userText };

      const response = await fetch(mode === "hermes" ? "/api/hermes-converse" : "/api/mrvn-converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to contact chat server");
      }

      const data = await response.json();

      if (mode === "marvin" && data.type === "confirm") {
        appendMessage(mode, {
          id: Math.random().toString(),
          sender: "marvin",
          text: data.message,
          isConfirm: true,
          taskName: data.task_name,
          params: data.params ?? {},
          timestamp: new Date(),
        });
      } else {
        appendMessage(mode, {
          id: Math.random().toString(),
          sender: mode === "hermes" ? "hermes" : "marvin",
          text: data.message || "Silence. That is my response.",
          timestamp: new Date(),
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      appendMessage(mode, {
        id: Math.random().toString(),
        sender: mode === "hermes" ? "hermes" : "marvin",
        text:
          mode === "hermes"
            ? `Error contacting Hermes: ${errMsg}.`
            : `Error contacting MARVIN: ${errMsg}. A typical breakdown of human systems.`,
        timestamp: new Date(),
      });
    } finally {
      setIsLoading(false);
      if (!isOpen) {
        setHasUnread(true);
      }
    }
  };

  const handleConfirmAction = async (
    taskName: string,
    confirmed: boolean,
    params: Record<string, string> = {}
  ) => {
    // Remove confirmation buttons from the message list
    setConversations((prev) => ({
      ...prev,
      marvin: prev.marvin.map((msg) =>
        msg.taskName === taskName && msg.isConfirm ? { ...msg, isConfirm: false } : msg
      ),
    }));

    // Add system-like user response to thread
    const actionLabel = confirmed ? "Confirmed execution." : "Cancelled execution.";
    appendMessage("marvin", {
      id: Math.random().toString(),
      sender: "user",
      text: actionLabel,
      timestamp: new Date(),
    });

    setIsLoading(true);
    setLoadingText(confirmed ? marvinCopy.chatRunning : marvinCopy.chatThinking);

    try {
      const response = await fetch("/api/mrvn-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_name: taskName, confirmed, params }),
      });

      if (!response.ok) {
        throw new Error("Failed to execute/confirm task");
      }

      const data = await response.json();
      appendMessage("marvin", {
        id: Math.random().toString(),
        sender: "marvin",
        text: data.message || "Task completed, or failed. I didn't verify details.",
        timestamp: new Date(),
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      appendMessage("marvin", {
        id: Math.random().toString(),
        sender: "marvin",
        text: `Error during task operation: ${errMsg}. Highly predictable failure.`,
        timestamp: new Date(),
      });
    } finally {
      setIsLoading(false);
      if (!isOpen) {
        setHasUnread(true);
      }
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasUnread(false);
    }
  };

  return (
    <>
      {/* Floating Chat Bubble */}
      <button
        id="marvin-chat-toggle"
        className={`marvin-chat-toggle ${isOpen ? "active" : ""} ${hasUnread ? "unread" : ""}`}
        onClick={handleToggle}
        title={marvinCopy.chatTooltip}
        aria-label="Toggle MARVIN Chat"
      >
        <span className="marvin-chat-toggle-icon">
          {isOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              {/* Terminal-like cursor/prompt icon */}
              <path d="M7 8l4 4-4 4" strokeWidth="2.5"></path>
              <line x1="12" y1="16" x2="17" y2="16" strokeWidth="2.5"></line>
            </svg>
          )}
        </span>
        {hasUnread && <span className="marvin-chat-unread-badge" />}
      </button>

      {/* Expandable Chat Window */}
      <div
        ref={chatWindowRef}
        className={`marvin-chat-window ${isOpen ? "open" : ""}`}
        aria-hidden={!isOpen}
      >
        {/* Chat Header */}
        <div className="marvin-chat-header">
          <div className="marvin-chat-header-info">
            <span className="marvin-chat-status-dot pulse" />
            <h3>{activeMode === "hermes" ? marvinCopy.hermesChatTitle : marvinCopy.chatTitle}</h3>
          </div>
          <button
            className="marvin-chat-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
          >
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="marvin-chat-mode-switch" role="tablist" aria-label="Chat mode">
          <button
            type="button"
            className={activeMode === "marvin" ? "active" : ""}
            onClick={() => setActiveMode("marvin")}
            disabled={isLoading}
            role="tab"
            aria-selected={activeMode === "marvin"}
          >
            MARVIN
          </button>
          <button
            type="button"
            className={activeMode === "hermes" ? "active" : ""}
            onClick={() => setActiveMode("hermes")}
            disabled={isLoading}
            role="tab"
            aria-selected={activeMode === "hermes"}
          >
            Hermes
          </button>
        </div>

        {/* Messages List */}
        <div className="marvin-chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`marvin-chat-message-row ${msg.sender === "user" ? "user-row" : "marvin-row"}`}
            >
              <div
                className={`marvin-chat-message ${msg.sender === "user" ? "user-message" : "marvin-message"}`}
              >
                {msg.sender === "user" ? (
                  <p className="user-message-text">{msg.text}</p>
                ) : (
                  <div className="marvin-markdown-content">
                    <MarkdownViewer markdown={msg.text} />
                  </div>
                )}

                {/* Task Execution Confirmation Card */}
                {msg.isConfirm && msg.taskName && (
                  <div className="marvin-confirm-card">
                    <p className="confirm-label">Execution authorization required</p>
                    <div className="marvin-confirm-actions">
                      <button
                        className="marvin-confirm-btn proceed"
                        onClick={() => handleConfirmAction(msg.taskName!, true, msg.params)}
                      >
                        {marvinCopy.chatConfirmBtn}
                      </button>
                      <button
                        className="marvin-confirm-btn cancel"
                        onClick={() => handleConfirmAction(msg.taskName!, false, msg.params)}
                      >
                        {marvinCopy.chatCancelBtn}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="marvin-chat-message-time">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}

          {/* Typing/Thinking/Running Indicator */}
          {isLoading && (
            <div className="marvin-chat-message-row marvin-row">
              <div className="marvin-chat-message marvin-message thinking">
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
                <small className="thinking-text">{loadingText}</small>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="marvin-chat-input-bar">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={activeMode === "hermes" ? marvinCopy.hermesChatPlaceholder : marvinCopy.chatPlaceholder}
            disabled={isLoading}
            aria-label={activeMode === "hermes" ? "Message Hermes" : "Message MARVIN"}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send Message"
            title="Send"
          >
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
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
