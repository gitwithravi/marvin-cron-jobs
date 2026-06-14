# Incremental LangGraph Migration For MARVIN Chat

## Summary

Use LangGraph as MARVIN's Python chat orchestration layer, while keeping the current dashboard and HTTP routes mostly compatible. The goal is better scaling as tasks grow: durable conversation threads, resumable confirmations, clearer graph nodes, and less brittle intent/action flow.

LangGraph is a fit because its core strengths are stateful, long-running orchestration, persistence, human-in-the-loop approval, and resumable workflows.

## Key Changes

- Add dependencies:
  - `langgraph`
  - `langgraph-checkpoint-sqlite`
- Keep using the existing `OpenRouterClient`; do not add LangChain model abstractions in v1.
- Add a new graph module, e.g. `marvin_core/chat_graph.py`, and keep `marvin_core/agent.py` functions as reusable node helpers where practical.
- Compile a `StateGraph` with SQLite checkpointing using `langgraph-checkpoint-sqlite`.
- Use a separate checkpoint DB path, e.g. `data/marvin_chat_checkpoints.sqlite3`, instead of mixing LangGraph tables into the operational `data/marvin.sqlite3`.
- Pass a `thread_id` on every graph call.
- Replace the current `process_message()` orchestration with graph execution:
  - classify intent
  - resolve task
  - read report or prepare execution
  - interrupt for confirmation before task execution
  - resume after confirmation
  - execute task
  - format compact response
  - normalize errors into chat responses
- Use LangGraph interrupts for confirmation:
  - `/chat` returns `type: "confirm"` when the graph pauses for approval.
  - `/chat/confirm` resumes the same `thread_id` with the user's approval/rejection.
- Keep report responses deterministic and compact; do not send full factual JSON into the chat widget.
- Add progress-state metadata without token streaming:
  - Responses may include `progress: ["classified", "read_report"]` or similar.
  - UI can show better loading copy based on request type, but no SSE/token streaming in v1.

## API And UI Contract

- Keep existing response shapes backward compatible:
  - `response`: `{ type: "response", message, thread_id?, progress? }`
  - `confirm`: `{ type: "confirm", message, task_name, params, thread_id, progress? }`
- Extend request bodies:
  - `/chat`: accept `{ message: string, thread_id?: string }`
  - `/chat/confirm`: accept `{ thread_id: string, confirmed: boolean, task_name?: string, params?: object }`
- In `ChatWidget`, create and retain a `threadId` for the browser session.
- Generate a thread ID once client-side if the server does not return one.
- Send the thread ID with all chat and confirm calls.
- Keep existing `/api/mrvn-converse` and `/api/mrvn-confirm` Next routes as proxies.

## Test Plan

- Unit tests for graph routing:
  - "are all servers healthy?" reads Beszel report.
  - "show uptime status" reads Uptime Kuma report.
  - "run team status for 2026-06-12" interrupts for confirmation with params preserved.
  - rejected confirmation resumes with cancellation response.
  - approved confirmation executes the task and reads the matching report.
- Persistence tests:
  - first `/chat` returns a confirmation with `thread_id`.
  - a fresh graph instance can resume confirmation using the same `thread_id`.
  - different `thread_id` values do not share pending confirmations.
- Regression tests:
  - OpenRouter classifier failure still falls back to deterministic task matching.
  - formatter failure still returns compact report digest or plain fallback.
  - unknown/general messages return a helpful chat response.
- Existing full suite should continue passing: `python -m pytest`.
- Dashboard checks: `npx tsc --noEmit`.

## Assumptions

- Migration approach: incremental, not a full agent rewrite.
- Memory: durable thread-scoped chat state using LangGraph SQLite checkpoints.
- Model access: keep direct OpenRouter calls.
- UX: add progress states, not token streaming.
- Production-grade Postgres checkpointing and LangSmith tracing are out of scope for v1; SQLite is enough for local MARVIN deployment.
