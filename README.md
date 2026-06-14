# MARVIN Agent

MARVIN is a script-first AI agent. Each task runs as a normal script: it gathers factual data, persists it, sends a compact payload to an LLM, and writes a report.

## Setup

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with real values (no placeholders), then set the model slug in each task's `config.yaml` before live runs.

## Hermes Dashboard Chat

The dashboard chat includes a separate Hermes mode that talks to an OpenAI-compatible Hermes endpoint through the local MARVIN chat server. Configure these values in the root `.env`, then restart `marvin-chat-server`:

```text
HERMES_BASE_URL=http://<hermes-vm-or-tailnet-name>:<port>/v1
HERMES_MODEL=<model-name>
HERMES_API_KEY=<optional bearer token>
HERMES_TIMEOUT_SECONDS=60
```

The browser does not call Hermes directly. The dashboard authenticates the session, proxies to `127.0.0.1:${CHAT_SERVER_PORT}`, and the Python chat server calls `${HERMES_BASE_URL}/chat/completions`.

## Tasks

Each task lives in `tasks/<task_name>/` with its own config, prompts, runner, and tests. Run any task with `python -m tasks.<task_name>.run`. All tasks accept `--dry-run` to skip OpenRouter and use a deterministic analysis.

### Uptime Kuma Heartbeat

Polls Uptime Kuma for monitor status and recent heartbeats, persists them, and flags downtime and missing data.

**Env vars** (root `.env`):
- `UPTIME_KUMA_URL`
- `UPTIME_KUMA_USERNAME`
- `UPTIME_KUMA_PASSWORD`
- `OPENROUTER_API_KEY`

```bash
python -m tasks.uptime_kuma_heartbeat.run
python -m tasks.uptime_kuma_heartbeat.run --dry-run
```

```cron
*/15 * * * * cd /home/raviks/Development/MARVIN-Agent && . .venv/bin/activate && python -m tasks.uptime_kuma_heartbeat.run >> logs/uptime_kuma_heartbeat.log 2>&1
```

### Beszel Server Status

Polls Beszel for systems, containers, alerts, and recent alert history. Persists everything, then surfaces systems that are down, alerts that are triggered, and unresolved history.

**Env vars** (root `.env`):
- `BESZEL_URL`
- `BESZEL_EMAIL`
- `BESZEL_PASSWORD`
- `OPENROUTER_API_KEY`

```bash
python -m tasks.beszel_server_status.run
python -m tasks.beszel_server_status.run --dry-run
```

```cron
*/15 * * * * cd /home/raviks/Development/MARVIN-Agent && . .venv/bin/activate && python -m tasks.beszel_server_status.run >> logs/beszel_server_status.log 2>&1
```

### Team Status Today

Fetches today's task status for each member from the team status API (`X-API-Key` auth). 404/422 are treated as empty data; 401 (bad key) and 503 (server key not configured) are fatal. Transient timeouts and connection errors are retried with exponential backoff. The script refuses to run when env vars are missing or still set to placeholder values.

**Env vars** (root `.env`):
- `TEAM_STATUS_API_URL`
- `TEAM_STATUS_API_KEY`
- `OPENROUTER_API_KEY`

```bash
python -m tasks.team_status_today.run
python -m tasks.team_status_today.run --date 2026-06-12
python -m tasks.team_status_today.run --dry-run
```

```cron
*/30 * * * * cd /home/raviks/Development/MARVIN-Agent && . .venv/bin/activate && python -m tasks.team_status_today.run >> logs/team_status_today.log 2>&1
```

## Telegram Notifications

Set these values in `.env`:

```text
TELEGRAM_BOT_TOKEN=123456789:AA_REPLACE_WITH_BOTFATHER_TOKEN
TELEGRAM_CHAT_ID=123456789
```

`TELEGRAM_BOT_TOKEN` must be the BotFather API token (e.g. `123456789:AA...`), not the bot username.

Test delivery:

```bash
.venv/bin/python tools/telegram_notification.py --message "MARVIN test notification"
```

Each task's `config.yaml` controls whether notifications are enabled, the minimum risk threshold, and the destination channels.

## Task Pattern

Each task keeps its own config, prompts, runner, and tests in `tasks/<task_name>/`. Shared behavior belongs in `marvin_core/` only when multiple tasks need it. See `TASK_CREATION_GUIDELINE.md` for the full pattern.
