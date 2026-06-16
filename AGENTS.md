# AGENTS.md

## Project Overview

MARVIN is a script-first operations agent with a private Next.js web dashboard. Tasks run as plain Python scripts, collect factual data, persist observations, ask an LLM (via OpenRouter) for analysis, and write Markdown reports. The dashboard exposes those reports, live operational views, todos, alerts, and chat access.

The project maintains a deliberate separation: **deterministic code gathers facts; the LLM only summarizes and explains them**. The LLM is never the source of truth and never makes irreversible decisions.

## Quick Reference

### Commands

**Python (run from project root)**

```bash
# Activate virtualenv
source .venv/bin/activate

# Run all tests
python -m pytest tests/ -v

# Run a specific test file
python -m pytest tests/test_beszel_server_status.py -v

# Run a single test
python -m pytest tests/test_beszel_server_status.py::test_compute_risk_critical_when_down_with_triggered_alerts -v

# Run a task (dry-run without LLM call)
python -m tasks.beszel_server_status.run --dry-run

# Run a task for real
python -m tasks.uptime_kuma_heartbeat.run

# Start the FastAPI server (also managed by PM2)
python -m marvin_core.marvin_api

# Test Telegram notification manually
.venv/bin/python tools/telegram_notification.py --message "MARVIN test notification"
```

**Dashboard (in `dashboard/`)**

```bash
npm run dev      # Next.js dev on 127.0.0.1:3030
npm run build    # Production build
npm start        # Production start (also managed by PM2)
npm run lint     # ESLint
```

**Production (PM2)**

```bash
pm2 start dashboard/ecosystem.config.cjs   # Starts marvin-dashboard + marvin-api
pm2 list
pm2 logs marvin-dashboard
pm2 logs marvin-api
pm2 restart marvin-dashboard marvin-api
```

**Cron scheduling** — tasks are designed to be cron-friendly. Example crontab entries are in README.md.

### Key Files

| Path | Purpose |
|------|---------|
| `marvin_core/marvin_api.py` | FastAPI server (entry point for dashboard proxy) |
| `marvin_core/agent.py` | MARVIN chat intent classification, task dispatch, response formatting |
| `marvin_core/db.py` | SQLite schema, migrations, and all persistence functions |
| `marvin_core/openrouter.py` | OpenRouter chat completions client (single `chat_json` method) |
| `marvin_core/hermes.py` | Hermes (separate AI endpoint) chat client |
| `marvin_core/report.py` | Markdown report writer; creates `latest.md` symlink |
| `marvin_core/risk.py` | Risk level normalization and threshold comparison |
| `marvin_core/task_registry.py` | Auto-discovers tasks from `tasks/*/config.yaml` |
| `marvin_core/todos.py` | Todo CRUD, tag management, LLM classification |
| `marvin_core/support_rag.py` | RAG engine for Vityarthi support ticket replies |
| `marvin_core/invoices.py` | Invoice PDF extraction via OpenRouter with structured output |
| `marvin_core/alerts.py` | Generates periodic alert digests from todos |
| `marvin_core/paths.py` | Defines `ROOT_DIR` and `project_path()` helper |
| `marvin_core/env.py` | `load_root_env()` and `require_env()` helpers |
| `marvin_core/communication_style.py` | Loads `communication_style.md` for LLM prompts |
| `marvin_core/soul.py` | Loads `SOUL.md` (MARVIN's personality definition) |
| `marvin_core/notifications/dispatcher.py` | Notification dispatch (Telegram + console) |
| `SOUL.md` | MARVIN's full personality and operating principles |
| `communication_style.md` | Shorter style guide actually injected into LLM prompts |
| `TASK_CREATION_GUIDELINE.md` | Definitive guide for adding new tasks |
| `dashboard/app/` | Next.js App Router pages and API routes |
| `dashboard/lib/` | Shared TypeScript utilities (auth, API proxy, task helpers) |
| `dashboard/components/` | React components for dashboard UI |
| `requirements.txt` | Python dependencies |
| `dashboard/package.json` | Node.js dependencies |

## Architecture

### Two-Tier Design

```
Browser → Next.js dashboard (127.0.0.1:3030)
            → authenticated /api/* routes
            → FastAPI MARVIN API (127.0.0.1:3031)
               → task scripts, SQLite, OpenRouter, Hermes, upstream APIs
```

The browser **never** calls OpenRouter, Hermes, task APIs, or SQLite directly. The dashboard authenticates the user, then proxies all privileged operations to the local Python MARVIN API or server-side dashboard helpers.

### Dashboard API Routes

All `/api/*` routes under `dashboard/app/api/` are Next.js server-side route handlers. The pattern is:

1. Check session auth (`requireApiSession()` from `lib/marvin-server.ts`)
2. Proxy to the FastAPI MARVIN backend (`proxyToMarvinApi()` from same file)

Some routes (like `mrvn-converse`) call the FastAPI directly with custom logic rather than using the generic proxy.

### MARVIN API (FastAPI)

The FastAPI server at `marvin_core/marvin_api.py` exposes endpoints for:
- `/chat` — MARVIN chat (classify intent → execute/read)
- `/chat/confirm` — confirm/reject task execution
- `/todos` — CRUD
- `/runs` — list task runs (reports)
- `/runs/{runId}` — get a specific run detail
- `/alerts/*` — generate and serve alerts
- `/beszel` — live Beszel system status
- `/team-status` — team status board
- `/hermes-converse` — chat with Hermes
- `/support-rag/*` — support RAG suggestions
- `/invoices/*` — invoice extraction and management
- `/openrouter-usage` — OpenRouter account usage
- `/todo-tags` — tag management

### Python Package Layout

```
marvin_core/          # Shared library (imported by tasks and API)
  marvin_api.py       # FastAPI server (PM2 runs this as a script)
  agent.py            # Chat intent classification + task orchestration
  db.py               # SQLite schema + all DB functions
  openrouter.py       # OpenRouterClient
  hermes.py           # HermesClient
  report.py           # write_markdown_report()
  risk.py             # Risk level helpers
  task_registry.py    # discover_tasks()
  todos.py            # Todo CRUD + LLM tag classification
  support_rag.py      # RAG engine (Qdrant + hash-embedding fallback)
  invoices.py         # Invoice PDF → structured extraction
  alerts.py           # Alert digest generation
  beszel_live.py      # Live Beszel status polling
  env.py, paths.py, config.py, soul.py, communication_style.py  # Small helpers
  notifications/      # Notification channel implementations

tasks/                # One directory per operational task
  <task_name>/
    __init__.py
    config.yaml       # Task-specific config (model, DB path, report dir, notifications)
    run.py            # Entry point (argparse, --dry-run)
    analysis.py       # build_factual_payload(), compute_risk_level(), build_messages()
    prompts/
      system.md       # LLM system prompt
      user.md         # LLM user prompt template (use {communication_style} and {payload})

tests/                # pytest test files (one per module/task)

dashboard/            # Next.js 15 + React 19 app
  app/                # App Router pages and API routes
  lib/                # Server-side TS utilities
  components/         # React components
```

## Task Architecture (Critical Pattern)

Every task follows this exact pattern. When creating a new task, copy an existing task directory and follow `TASK_CREATION_GUIDELINE.md` precisely.

### Task Flow

```
run.py:
  1. load_root_env() — read root .env for shared secrets
  2. load_yaml(TASK_DIR / "config.yaml") — task-specific config
  3. connect(config["database_path"]) + migrate() — open SQLite
  4. create_task_run() — begin run record
  5. Fetch data from upstream APIs (deterministic code)
  6. Insert raw observations into task-specific DB tables
  7. analysis.build_factual_payload() — shape structured facts
  8. analysis.compute_risk_level() — deterministic risk from facts (NOT from LLM)
  9. analysis.dry_run_analysis() — deterministic analysis (always run; LLM adds summary on top)
  10. insert_task_run_payload() — persist facts + analysis
  11. dispatch_notifications() — send if risk ≥ config threshold
  12. finish_task_run() — mark complete
```

### Key Design Rules

- **Risk is computed deterministically** from facts, never from the LLM. The `compute_risk_level()` function in each task's `analysis.py` must be pure logic. The LLM only explains the risk in its summary.
- **`dry_run_analysis()` is always called**, not just in dry-run mode. It provides the deterministic baseline. The LLM can optionally generate a richer summary which gets stored in `marvin_summaries`, but the `deterministic_analysis_json` in `task_run_payloads` is always the dry-run result.
- **`build_factual_payload()`** must produce a compact, structured JSON dict. This is what the LLM sees. Do not send raw API responses to the LLM.
- **Every task supports `--dry-run`** which skips OpenRouter calls and uses only deterministic analysis.
- **Task configs (`config.yaml`)** must include: `task_name`, `model`, `database_path`, `report_dir`, `openrouter` settings, and `notifications` block.
- **The `model` field** is always an OpenRouter model slug (e.g., `deepseek/deepseek-v4-flash`). Do not hard-code models in shared code.

### Notification System

- Controlled per-task via `config.yaml → notifications`
- Dispatched through `marvin_core.notifications.dispatcher.dispatch_notifications()`
- Risk threshold determines dispatch: if threshold is `medium`, dispatch for medium, high, critical — not low
- Channels: `telegram` (uses `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from root `.env`), `console`

## Database

- **Single SQLite database** at `data/marvin.sqlite3` (configurable via `MARVIN_DATABASE_PATH` or per-task `config.yaml`)
- Schema is in `marvin_core/db.py:SCHEMA` (a multi-statement SQL string)
- `migrate(conn)` runs `SCHEMA` (all `CREATE TABLE IF NOT EXISTS`) then applies `MIGRATIONS` list
- Key tables: `task_runs`, `task_run_payloads`, `reports`, `marvin_summaries`, and task-specific observation tables (`beszel_system_snapshots`, `heartbeat_observations`, `team_status_member_snapshots`, `vityarthi_support_ticket_observations`, etc.)
- Also: `todos`, `todo_tags`, `todo_tag_links`, `reimbursement_invoices`, `support_rag_suggestions`
- `connect(database_path)` enables `row_factory = sqlite3.Row` and `PRAGMA foreign_keys = ON`
- Append-only for observations. Use `INSERT OR IGNORE` with `UNIQUE` constraints to prevent duplicates from overlapping cron runs.

## Authentication

- The dashboard uses **HMAC-SHA256 signed HTTP-only session cookies** (`marvin_dashboard_session`)
- Password is hashed with **SHA-1** (not for security — for simple matching against env var)
- Session TTL: 12 hours
- The FastAPI backend does **no authentication of its own** — it listens on `127.0.0.1` only and trusts the dashboard proxy

## Environment Variables

**Root `.env`** (shared by all Python code):
- `OPENROUTER_API_KEY`, `OPENROUTER_MANAGEMENT_KEY` — OpenRouter credentials
- `MARVIN_CHAT_MODEL`, `TODO_CLASSIFIER_MODEL`, `TODO_REMINDER_MODEL`, `INVOICE_EXTRACTOR_MODEL` — model selections
- `INVOICE_PDF_ENGINE` — `cloudflare-ai` or `mistral-ocr`
- `UPTIME_KUMA_*` — Uptime Kuma credentials
- `BESZEL_*` — Beszel credentials
- `TEAM_STATUS_*` — Team status API
- `VITYARTHI_SYSTEM_API_TOKEN` — Vityarthi support system token
- `SUPPORT_RAG_*` — RAG configuration
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Telegram notifications
- `MARVIN_API_PORT` — FastAPI port (default 3031)
- `HERMES_*` — Hermes AI endpoint configuration

**Dashboard `.env.local`**:
- `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD_HASH` — login credentials
- `SESSION_SECRET` — HMAC signing key (≥24 chars)
- `DASHBOARD_COOKIE_SECURE` — set `true` only for HTTPS
- `MARVIN_API_PORT` — must match root `.env`

## OpenRouter Usage

All LLM calls go through `marvin_core.openrouter.OpenRouterClient.chat_json()`. Key behaviors:
- Always uses `X-OpenRouter-Title: MARVIN Agent` header
- Requests JSON response format (`json_object` or `json_schema` with structured output)
- Handles both inline JSON objects and string-encoded JSON in the response content
- Supports `plugins` parameter for PDF extraction (Cloudflare AI)

## Important Gotchas

1. **`INSERT OR IGNORE` with `UNIQUE` constraints**: Observation tables use this pattern to make cron runs idempotent. Be aware when changing UNIQUE constraints — existing data may have duplicates that `INSERT OR IGNORE` was masking.

2. **`latest.md` is a symlink**: `write_markdown_report()` creates a symlink `latest.md → {timestamp}.md`. When reading reports from the filesystem, make sure to handle symlinks (the dashboard handles this via the API, not filesystem reads).

3. **Dashboard reads reports through the API, not filesystem**: The dashboard's `lib/tasks.ts` fetches runs from `GET /runs?task_name=...` and run details from `GET /runs/{runId}?task_name=...`. It does NOT read markdown files directly.

4. **`PYTHONPATH` must include the project root**: The PM2 config sets `PYTHONPATH` explicitly. When running Python scripts directly, run from the project root so that `marvin_core` and `tasks` are importable.

5. **Task model must not be the placeholder**: `config.yaml` models default to `REPLACE_WITH_OPENROUTER_MODEL_SLUG`. `run.py` validates this and refuses to run live. Set a real model slug before production use.

6. **`factual_json` in `task_run_payloads` can be large**: The full factual payload is stored as JSON text. Be mindful when querying or displaying this — the dashboard only shows summaries.

7. **Telegram `TELEGRAM_BOT_TOKEN` must be the BotFather API token**: A bot username like `ravi_marvin_notify_bot` will fail with a 404.

8. **No `.env` files committed**: `.gitignore` blocks all `.env` files except `.env.example`. Never add real credentials to example files.

9. **The `kb/` directory** in git status contains exported CSV data. It's not tracked in `.gitignore` (git status shows `??`). It's operational data, not source code.

10. **LangGraph migration is planned but not yet implemented**: `LANGGRAPH_PLAN.md` describes an incremental migration plan. `marvin_core/chat_graph.py` does not exist yet. The current chat orchestration is in `marvin_core/agent.py`.

## Naming & Style Conventions

- **Python**: Standard snake_case for functions/variables, PascalCase for classes
- **TypeScript/React**: PascalCase for components, camelCase for functions/variables
- **Task names**: snake_case (e.g., `beszel_server_status`, `uptime_kuma_heartbeat`)
- **Display names**: Title Case derived by splitting on `_` and `-` (e.g., "Beszel Server Status")
- **Database tables**: snake_case, task-specific tables prefixed with task context (e.g., `beszel_system_snapshots`, `team_status_member_snapshots`)
- **No comments**: The codebase avoids inline comments. Use function names and type annotations for clarity.
- **No formatters configured**: No Black, Ruff, or Prettier configs exist. Match existing indentation style (4 spaces for Python, 2 spaces for TypeScript).

## Testing

- **Framework**: pytest (Python only, no frontend tests)
- **DB tests**: Tests that need SQLite pass a database path string; `connect()` auto-creates the file
- **No mocks**: Tests use real `analysis.py` functions with synthetic data; they don't mock OpenRouter
- **Test files**: One per module under `tests/` (e.g., `test_beszel_server_status.py`, `test_todos.py`)
- **Run**: `python -m pytest tests/ -v` from project root

## Adding a New Task

1. Read `TASK_CREATION_GUIDELINE.md` in full
2. Copy an existing task directory (e.g., `tasks/beszel_server_status/`)
3. Update `config.yaml` with real model slug and settings
4. Implement data-fetching in `run.py` (or a separate client module)
5. Add DB tables in `marvin_core/db.py:SCHEMA` if needed
6. Add insert functions in `marvin_core/db.py`
7. Implement `analysis.py` with `build_factual_payload()`, `compute_risk_level()`, `dry_run_analysis()`, `build_messages()`
8. Write prompts in `prompts/system.md` and `prompts/user.md`
9. Add tests in `tests/`
