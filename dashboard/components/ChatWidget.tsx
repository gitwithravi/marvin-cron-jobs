"use client";

import React, { useState, useRef, useEffect } from "react";
import { marvinCopy } from "@/lib/marvin-copy";
import { MarkdownViewer } from "@/components/MarkdownViewer";

type Message = {
  id: string;
  sender: "user" | "hermes";
  text: string;
  timestamp: Date;
};

const initialMessages: Message[] = [
  {
    id: "welcome-hermes",
    sender: "hermes",
    text: "Hermes is connected when the VM endpoint is configured. Ask your agent anything.",
    timestamp: new Date(),
  },
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const formatMessageTime = (timestamp: Date) => {
    if (!hasMounted) {
      return "--:--";
    }
    return timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        chatWindowRef.current &&
        !chatWindowRef.current.contains(event.target as Node)
      ) {
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

  const appendMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    const previousMessages = messages;
    setInputValue("");

    appendMessage({
      id: Math.random().toString(),
      sender: "user",
      text: userText,
      timestamp: new Date(),
    });
    setIsLoading(true);

    try {
      const response = await fetch("/api/hermes-converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: previousMessages
            .filter((msg) => msg.id !== "welcome-hermes")
            .filter((msg) => msg.sender === "user" || msg.sender === "hermes")
            .map((msg) => ({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.text,
            })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to contact Hermes API");
      }

      const data = await response.json();
      appendMessage({
        id: Math.random().toString(),
        sender: "hermes",
        text: data.message || "Hermes returned silence.",
        timestamp: new Date(),
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      appendMessage({
        id: Math.random().toString(),
        sender: "hermes",
        text: `Error contacting Hermes: ${errMsg}.`,
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
      <button
        id="marvin-chat-toggle"
        className={`marvin-chat-toggle ${isOpen ? "active" : ""} ${hasUnread ? "unread" : ""}`}
        onClick={handleToggle}
        title={marvinCopy.chatTooltip}
        aria-label="Toggle Hermes Chat"
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
              <path d="M7 8l4 4-4 4" strokeWidth="2.5"></path>
              <line x1="12" y1="16" x2="17" y2="16" strokeWidth="2.5"></line>
            </svg>
          )}
        </span>
        {hasUnread && <span className="marvin-chat-unread-badge" />}
      </button>

      <div
        ref={chatWindowRef}
        className={`marvin-chat-window ${isOpen ? "open" : ""}`}
        aria-hidden={!isOpen}
      >
        <div className="marvin-chat-header">
          <div className="marvin-chat-header-info">
            <span className="marvin-chat-status-dot pulse" />
            <h3>{marvinCopy.hermesChatTitle}</h3>
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
              </div>
              <span className="marvin-chat-message-time">
                {formatMessageTime(msg.timestamp)}
              </span>
            </div>
          ))}

          {isLoading && (
            <div className="marvin-chat-message-row marvin-row">
              <div className="marvin-chat-message marvin-message thinking">
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
                <small className="thinking-text">{marvinCopy.hermesChatThinking}</small>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="marvin-chat-input-bar">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={marvinCopy.hermesChatPlaceholder}
            disabled={isLoading}
            aria-label="Message Hermes"
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
