# MARVIN Agent

MARVIN is a script-first operations agent with a private web dashboard. Tasks run as normal Python scripts, collect factual data, persist observations, ask an LLM for a compact analysis, and write Markdown reports. The dashboard exposes those reports, live operational views, todos, alerts, OpenRouter usage, and approval workflows for operator-reviewed actions.

## Features

- **Authenticated dashboard**: Next.js dashboard with signed HTTP-only session cookies.
- **Approval queue**: Central pending/history view for operator-reviewed actions such as support replies.
- **Report browser**: Lists generated Markdown reports by task and renders report details.
- **Todos and tags**: Create, update, retag, and list operational todos through the dashboard and MARVIN API.
- **Invoice reimbursement tracker**: Upload invoice PDFs, extract reimbursement fields with OpenRouter, confirm them, store records in SQLite, and archive PDFs locally.
- **Team status board**: Fetches member task status for a selected date and shows per-member summaries.
- **OpenRouter usage panel**: Displays account credits and usage from the OpenRouter management API.
- **Alerts**: Generates and serves latest operational alerts.
- **Notifications**: Optional Telegram notifications per task, controlled by each task's `config.yaml`.
- **Script-first tasks**: Uptime Kuma heartbeat, Beszel server status, team status, and VITyarthi support tickets.
- **Support reply drafting**: Open support tickets are synced into the approval queue automatically and grounded reply drafts are generated from the local support RAG index.

## Architecture

```text
browser
  -> Next.js dashboard on 127.0.0.1:3030
  -> authenticated /api/* routes
  -> FastAPI MARVIN API on 127.0.0.1:${MARVIN_API_PORT}
  -> task scripts, SQLite data, reports, OpenRouter, Hermes, and upstream service APIs
```

The browser never calls Hermes, OpenRouter, task APIs, or the SQLite database directly. The dashboard authenticates the user, then proxies privileged operations to the local Python MARVIN API or server-side dashboard helpers.

## Production Install

These instructions assume a Linux VM, a private network such as Tailscale, and nginx in front of the dashboard. The dashboard should not be exposed directly to the public internet without HTTPS and additional hardening.

### 1. Install system dependencies

```bash
sudo apt update
sudo apt install -y git python3 python3-venv nodejs npm nginx
sudo npm install -g pm2
```

Use Node.js 20+ for Next.js 15. If your distro ships an older Node.js, install a current LTS release from NodeSource or your preferred package source before running `npm install`.

### 2. Clone and install the app

```bash
git clone <repo-url> /opt/marvin-agent
cd /opt/marvin-agent

python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt

cd dashboard
npm install
cd ..
```

### 3. Configure root environment

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env` and replace all placeholders needed by the features you use:

```text
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_MANAGEMENT_KEY=sk-or-v1-your-management-key
MARVIN_CHAT_MODEL=google/gemini-2.5-flash
TODO_CLASSIFIER_MODEL=google/gemini-2.5-flash
TODO_REMINDER_MODEL=google/gemini-2.5-flash
INVOICE_EXTRACTOR_MODEL=google/gemini-2.5-flash
INVOICE_PDF_ENGINE=cloudflare-ai

UPTIME_KUMA_URL=http://localhost:3001
UPTIME_KUMA_USERNAME=admin
UPTIME_KUMA_PASSWORD=change-me

BESZEL_URL=http://localhost:8090
BESZEL_EMAIL=admin@example.com
BESZEL_PASSWORD=change-me

TEAM_STATUS_API_URL=https://tasks.vityarthi.com/api
TEAM_STATUS_API_KEY=your-api-key-here

VITYARTHI_SYSTEM_API_TOKEN=your-vityarthi-system-api-token-here

SUPPORT_RAG_MODEL=google/gemini-2.5-flash
SUPPORT_RAG_QDRANT_PATH=data/qdrant_support_rag
SUPPORT_RAG_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
SUPPORT_RAG_TEMPERATURE=0.2
SUPPORT_RAG_MAX_TOKENS=700

TELEGRAM_BOT_TOKEN=123456789:AA_REPLACE_WITH_BOTFATHER_TOKEN
TELEGRAM_CHAT_ID=123456789

MARVIN_API_PORT=3031

HERMES_BASE_URL=http://<hermes-vm-or-tailnet-name>:<port>/v1
HERMES_MODEL=<model-name>
HERMES_API_KEY=<optional bearer token>
HERMES_TIMEOUT_SECONDS=60
```

`HERMES_BASE_URL` must point to an OpenAI-compatible base URL. MARVIN calls `${HERMES_BASE_URL}/chat/completions`.

For invoice uploads, confirmed PDFs are archived under `data/invoices/`. `INVOICE_PDF_ENGINE=cloudflare-ai` is free and works for normal PDFs; use `mistral-ocr` for scanned invoices if needed.

### 4. Configure dashboard environment

```bash
cd dashboard
cp .env.example .env.local
chmod 600 .env.local
```

Create a password hash:

```bash
printf 'your-password' | sha1sum
```

Set dashboard values in `dashboard/.env.local`:

```text
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD_HASH=<sha1 hash from command above>
SESSION_SECRET=<long random secret>
DASHBOARD_COOKIE_SECURE=false
MARVIN_API_PORT=3031
```

`MARVIN_API_PORT` must match the root `.env`. Set `DASHBOARD_COOKIE_SECURE=true` only when the browser reaches the dashboard over HTTPS.

### 5. Build and start with PM2

```bash
cd /opt/marvin-agent/dashboard
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

The PM2 config starts:

- `marvin-dashboard`: Next.js on `127.0.0.1:3030`
- `marvin-api`: FastAPI MARVIN API using `.venv/bin/python3`

No PM2 or deployment topology change is required for the approval queue. It runs inside the existing `marvin-api` and `marvin-dashboard` processes.

Useful commands:

```bash
pm2 list
pm2 logs marvin-dashboard
pm2 logs marvin-api
pm2 restart marvin-dashboard marvin-api
```

### 6. Configure nginx

Point nginx at the local dashboard process:

```nginx
server {
    listen 80;
    server_name marvin.example.ts.net;

    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/marvin /etc/nginx/sites-enabled/marvin
sudo nginx -t
sudo systemctl reload nginx
```

For a Tailscale-only deployment, restrict access to the tailnet. If exposing beyond a private network, use HTTPS and set `DASHBOARD_COOKIE_SECURE=true`.

### 7. Schedule tasks

Each task can run manually or from cron. Example production cron entries:

```cron
*/15 * * * * cd /opt/marvin-agent && . .venv/bin/activate && python -m tasks.uptime_kuma_heartbeat.run >> logs/uptime_kuma_heartbeat.log 2>&1
*/15 * * * * cd /opt/marvin-agent && . .venv/bin/activate && python -m tasks.beszel_server_status.run >> logs/beszel_server_status.log 2>&1
*/30 * * * * cd /opt/marvin-agent && . .venv/bin/activate && python -m tasks.team_status_today.run >> logs/team_status_today.log 2>&1
*/30 * * * * cd /opt/marvin-agent && . .venv/bin/activate && python -m tasks.vityarthi_support_tickets.run >> logs/vityarthi_support_tickets.log 2>&1
```

Keep `logs/.gitkeep`, `data/.gitkeep`, and generated reports on disk. Back up `data/marvin.sqlite3`, `reports/`, `.env`, and `dashboard/.env.local`.

## Local Development

Run the Python MARVIN API:

```bash
. .venv/bin/activate
python marvin_core/marvin_api.py
```

Run the dashboard:

```bash
cd dashboard
npm run dev
```

Default local URLs:

- Dashboard: `http://127.0.0.1:3030`
- MARVIN API: `http://127.0.0.1:${MARVIN_API_PORT}`

## Tasks

Each task lives in `tasks/<task_name>/` with its own config, prompts, runner, analysis code, and tests. All tasks support `--dry-run` when available to skip live LLM calls and produce deterministic analysis.

### Uptime Kuma Heartbeat

Polls Uptime Kuma for monitor status and recent heartbeats, persists observations, and flags downtime or missing data.

```bash
python -m tasks.uptime_kuma_heartbeat.run
python -m tasks.uptime_kuma_heartbeat.run --dry-run
```

### Beszel Server Status

Polls Beszel for systems, containers, alerts, and recent alert history, then reports down systems and unresolved alert history.

```bash
python -m tasks.beszel_server_status.run
python -m tasks.beszel_server_status.run --dry-run
```

### Team Status Today

Fetches team members and date-specific tasks from the team status API. It treats 404/422 as empty data and fails on auth or server configuration problems.

```bash
python -m tasks.team_status_today.run
python -m tasks.team_status_today.run --date 2026-06-12
python -m tasks.team_status_today.run --dry-run
```

### VITyarthi Support Tickets

Fetches support ticket counts and open ticket details from the VITyarthi admin API, then writes a compact support status report.

```bash
python -m tasks.vityarthi_support_tickets.run
python -m tasks.vityarthi_support_tickets.run --dry-run
```

### VITyarthi Support RAG

Builds a local reply-suggestion index from CSV exports in `kb/`, then uses it to generate grounded reply drafts for open support tickets. The support dashboard syncs reviewable tickets into the central Approvals queue automatically. Operators review, edit, approve, or reject those drafts from the Approvals page.

```bash
python tools/index_support_rag.py
python tools/index_support_rag.py --no-qdrant
```

Qdrant/FastEmbed are the preferred local retrieval stack. If Qdrant is unavailable, MARVIN uses the JSONL fallback index at `data/support_rag_examples.jsonl`.

## MARVIN API And Dashboard APIs

The Python MARVIN API exposes local-only endpoints used by the dashboard:

- `POST /hermes/chat`: Hermes chat through OpenAI-compatible API.
- `GET /todos`, `POST /todos`, `PATCH /todos/{id}`: todo operations.
- `GET /todo-tags`, `POST /todo-tags`: tag operations.
- `GET /team-status?date=YYYY-MM-DD`: live team status board payload.
- `GET /alerts/latest`, `POST /alerts/refresh`: alert display and refresh.
- `GET /support-rag/tickets`, `POST /support-rag/index`: support intake and support RAG maintenance.
- `POST /agent-runs/support-reply/sync`: sync open support tickets into pending approvals without duplicating existing pending items.
- `GET /approvals`, `GET /approvals/{id}`, `POST /approvals/{id}/approve`, `POST /approvals/{id}/reject`: approval queue and approval actions.

The dashboard wraps these with authenticated `/api/*` routes. Unauthenticated requests return `401`.

## Notifications

Set Telegram credentials in `.env`:

```text
TELEGRAM_BOT_TOKEN=123456789:AA_REPLACE_WITH_BOTFATHER_TOKEN
TELEGRAM_CHAT_ID=123456789
```

Test delivery:

```bash
.venv/bin/python tools/telegram_notification.py --message "MARVIN test notification"
```

Each task's `config.yaml` controls whether notifications are enabled, the risk threshold, channels, and whether to include the report path.

## Verification

Run backend tests:

```bash
.venv/bin/python -m pytest
```

Run dashboard checks:

```bash
cd dashboard
npm run build
```

Basic production smoke checks:

```bash
curl -I http://127.0.0.1:3030/login
curl -s http://127.0.0.1:${MARVIN_API_PORT}/todo-tags
curl -i -s -X POST http://127.0.0.1:3030/api/hermes-converse \
  -H 'Content-Type: application/json' \
  -d '{"message":"ping","history":[]}'
```

The last command should return `401 Unauthorized` unless you include a valid dashboard session cookie.

## Security Notes

- Keep `.env` and `dashboard/.env.local` private; they contain password-equivalent and API credentials.
- Do not expose the FastAPI MARVIN API directly. It is intended to bind to `127.0.0.1`.
- Do not expose the dashboard outside a private network without HTTPS.
- Use a long random `SESSION_SECRET`.
- Rotate `DASHBOARD_PASSWORD_HASH`, OpenRouter keys, Hermes keys, and upstream service credentials if a VM snapshot or env file leaks.

## Task Pattern

Each task keeps its own config, prompts, runner, analysis, and tests under `tasks/<task_name>/`. Shared behavior belongs in `marvin_core/` only when multiple tasks need it. See `TASK_CREATION_GUIDELINE.md` for the full pattern.
