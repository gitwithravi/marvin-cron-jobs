# MARVIN Task Creation Guideline

This document defines how new MARVIN tasks should be added.

MARVIN is script-first. A task must gather facts deterministically, persist them, ask an LLM to analyze those facts, and produce a human-readable report. The LLM is for summarization, prioritization, and tone. It is not the source of truth, because hallucinations are a poor monitoring backend.

## Core Architecture

Use this flow for every task:

```text
deterministic script
-> structured facts
-> database persistence
-> OpenRouter LLM analysis
-> markdown report
-> optional future delivery channel
```

Tasks should be cron-friendly and runnable from the command line. A task must not require an interactive shell, a web server, or agent magic.

## Directory Pattern

Each task gets its own independent directory under `tasks/`.

Example:

```text
tasks/<task_name>/
  __init__.py
  config.yaml
  run.py
  analysis.py
  prompts/
    system.md
    user.md
```

Task directories should be self-contained. They may import shared helpers from `marvin_core/`, but should not depend on other task directories.

Shared helpers belong in `marvin_core/` only when more than one task needs the behavior.

## Required Task Behavior

Every task should:

- Load shared secrets from the root `.env`.
- Keep task-specific settings in its own `config.yaml`.
- Define the OpenRouter model in task config.
- Gather factual data through deterministic code.
- Persist raw or near-raw facts with timestamps.
- Build a compact factual payload for LLM analysis.
- Send only factual payloads to the LLM.
- Compute deterministic risk from facts before notification dispatch.
- Write a timestamped Markdown report.
- Dispatch notifications through the shared dispatcher when configured.
- Support a `--dry-run` mode when practical.
- Have focused tests for config, data shaping, prompt building, persistence, and report generation.

## Environment And Secrets

Use root `.env` for shared secrets.

Examples:

```text
OPENROUTER_API_KEY=...
UPTIME_KUMA_URL=...
UPTIME_KUMA_USERNAME=...
UPTIME_KUMA_PASSWORD=...
```

Never commit `.env`, databases, generated reports, logs, virtualenvs, caches, or credentials. `.env.example` should contain placeholders only.

## Configuration

Each task must own its config file.

Minimum recommended fields:

```yaml
task_name: example_task
model: "REPLACE_WITH_OPENROUTER_MODEL_SLUG"
database_path: "data/marvin.sqlite3"
report_dir: "reports/example_task"
openrouter:
  temperature: 0.2
  max_tokens: 1200
notifications:
  enabled: false
  risk_threshold: medium
  channels:
    - telegram
  include_report_path: true
```

Use explicit config over hidden defaults. If production behavior depends on a value, put it in config.

## Database Rules

Use SQLite for v1 unless there is a clear reason not to.

Persist:

- task run metadata
- observed timestamp
- raw or near-raw source data
- normalized fields needed for later analysis
- generated report metadata
- LLM JSON output

Prefer append-only records for observations. Use uniqueness constraints where overlapping cron runs would otherwise duplicate source events.

Schema should stay straightforward enough to migrate to PostgreSQL later if needed.

## LLM Rules

All LLM calls go through OpenRouter.

Each task must define its own model in `config.yaml`. Do not hard-code a production model in shared code.

Use the OpenRouter chat completions API through `marvin_core.openrouter`. Request JSON output where supported.

The LLM prompt must include:

- the factual payload
- required response schema
- task-specific interpretation rules
- `communication_style.md`

The LLM must not be asked to fetch facts, run commands, modify systems, send messages, or make irreversible decisions.

Do not let the LLM be the sole source for alerting risk. Compute task risk deterministically from observed facts, then allow the LLM to explain that risk in the report. Models are useful. Letting them decide whether Ravi gets paged is less useful.

## Notification Rules

Use `marvin_core.notifications.dispatcher` for all notifications.

Task config controls whether notifications are enabled, the minimum risk threshold, and the destination channels.

Risk levels are ordered:

```text
low < medium < high < critical
```

If `risk_threshold` is `medium`, dispatch for `medium`, `high`, and `critical`. Do not dispatch for `low`.

Supported channels:

- `telegram`
- `console` for local testing and dry operational checks

Telegram credentials live in root `.env`:

```text
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_CHAT_ID=...
```

`TELEGRAM_BOT_TOKEN` must be the BotFather API token, not the bot username. A username like `ravi_marvin_notify_bot` will fail. Telegram, in its infinite mercy, calls that a 404.

Test Telegram manually with:

```bash
.venv/bin/python tools/telegram_notification.py --message "MARVIN test notification"
```

Notification messages should include:

- task name
- risk level
- concise summary
- report path when configured

Add new channels under `marvin_core/notifications/`. Do not put channel-specific code inside task directories.

## MARVIN Communication Style

Use root `communication_style.md` for task reports.

The full `SOUL.md` defines MARVIN's identity and broader behavior. For reports, prefer `communication_style.md` because it is shorter, more direct, and easier for models to follow.

Report tone should be:

- operationally clear
- mildly sardonic
- precise
- concise
- useful before funny

For incidents, include one short MARVIN-style deadpan aside only when it does not reduce clarity.

Bad:

```text
Great news! Everything is amazing.
```

Good:

```text
All monitors are currently up. A rare moment of competence from the machines.
```

## Report Shape

Markdown reports should use this structure unless the task has a specific reason to differ:

```text
# <Task Report Title>

## Summary

## Recommended Actions

## Risk Level

## Notable Facts

## Factual Data
```

The factual data section should include JSON so reports remain auditable.

Do not let the LLM replace factual data. The report should show what was observed and what the LLM concluded from it.

## Error Handling

Tasks should fail loudly and record failures in task run metadata.

Required behavior:

- Missing required env vars should raise a clear error.
- Missing task config should raise a clear error.
- Missing `communication_style.md` should raise a clear error.
- External API failures should fail the run, not silently produce fake analysis.
- Database writes should happen before LLM analysis when facts were successfully collected.

## Cron Deployment

Tasks must be runnable with:

```bash
python -m tasks.<task_name>.run
```

Recommended cron pattern:

```cron
*/15 * * * * cd /home/raviks/Development/MARVIN-Agent && . .venv/bin/activate && python -m tasks.<task_name>.run >> logs/<task_name>.log 2>&1
```

Task output should be useful in cron logs. Reports should be written under `reports/<task_name>/`.

## Testing Expectations

Each task should have tests for:

- config validation
- data normalization
- factual payload construction
- prompt construction
- report rendering
- deterministic risk calculation
- notification threshold behavior
- database inserts or migrations, if the task adds schema
- dry-run behavior, if present

External services should be mocked in tests. Do not call OpenRouter or production services from tests. Apparently billing APIs dislike being part of unit tests.

## Uptime Kuma Task Reference

The first task, `tasks/uptime_kuma_heartbeat`, is the reference implementation.

It:

- authenticates to Uptime Kuma using root `.env`
- fetches monitors and heartbeat data with `uptime-kuma-api`
- normalizes monitor status from the latest heartbeat when Kuma monitor status is missing
- persists monitor snapshots, heartbeat observations, task runs, and reports
- sends factual payloads to OpenRouter
- computes deterministic risk from current and recent monitor status
- dispatches notifications when configured risk threshold is met
- uses `communication_style.md` for MARVIN-style summaries
- writes Markdown reports under `reports/uptime_kuma_heartbeat/`
- includes tests for persistence, analysis payloads, prompts, and report writing

Future tasks should follow this pattern unless there is a concrete reason to diverge. If there is, document the reason in the task README or config comments, so future Ravi does not have to conduct archaeology at 2 AM.
