# MARVIN Agent

MARVIN is a script-first AI agent. Each task runs as a normal script: it gathers factual data, persists it, sends a compact payload to an LLM, and writes a report.

## Setup

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`, then set the task model in `tasks/uptime_kuma_heartbeat/config.yaml`.

## Run Uptime Kuma Heartbeat Task

```bash
python -m tasks.uptime_kuma_heartbeat.run
```

Dry-run without calling OpenRouter:

```bash
python -m tasks.uptime_kuma_heartbeat.run --dry-run
```

Example cron entry:

```cron
*/15 * * * * cd /home/raviks/Development/MARVIN-Agent && . .venv/bin/activate && python -m tasks.uptime_kuma_heartbeat.run >> logs/uptime_kuma_heartbeat.log 2>&1
```

## Task Pattern

Each task should keep its own config, prompts, runner, and tests in `tasks/<task_name>/`. Shared behavior belongs in `marvin_core/` only when multiple tasks need it.

