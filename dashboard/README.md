# MARVIN Dashboard

The dashboard is a private Next.js interface for MARVIN. It provides authenticated access to reports, todos, team status, OpenRouter usage, alerts, and the floating MARVIN/Hermes chat widget.

## Features

- Session-based login with HTTP-only signed cookies.
- Overview page with task/report posture and OpenRouter account usage.
- Report list and Markdown report viewer.
- Team status board backed by the local Python chat server.
- Todo manager with tag creation, updates, and retagging.
- Floating chat with two modes:
  - `MARVIN`: report lookup and confirmed task execution.
  - `Hermes`: OpenAI-compatible Hermes agent chat proxied through the Python server.
- Alert refresh and latest alert display.

## Local Setup

```bash
cd dashboard
npm install
cp .env.example .env.local
```

Create a dashboard password hash:

```bash
printf 'your-password' | sha1sum
```

Set `dashboard/.env.local`:

```text
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD_HASH=<sha1 hash>
SESSION_SECRET=<long random string>
DASHBOARD_COOKIE_SECURE=false
CHAT_SERVER_PORT=3031
```

`CHAT_SERVER_PORT` must match the root `.env` used by `marvin_core/chat_server.py`.

Run locally:

```bash
npm run dev
```

The dashboard binds to `127.0.0.1:3030`.

## Production

From the repo root, install the Python environment and configure `.env`. From this directory:

```bash
npm install
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

`ecosystem.config.cjs` starts both required services:

- `marvin-dashboard`: `next start --hostname 127.0.0.1 --port 3030`
- `marvin-chat-server`: `../.venv/bin/python3 ../marvin_core/chat_server.py`

Place nginx in front of `http://127.0.0.1:3030` and preserve `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers. Keep the dashboard private to Tailscale or another trusted network unless HTTPS is configured.

## Operations

```bash
pm2 list
pm2 logs marvin-dashboard
pm2 logs marvin-chat-server
pm2 restart marvin-dashboard marvin-chat-server
```

Smoke checks:

```bash
curl -I http://127.0.0.1:3030/login
curl -i -s -X POST http://127.0.0.1:3030/api/hermes-converse \
  -H 'Content-Type: application/json' \
  -d '{"message":"ping","history":[]}'
```

The Hermes API check should return `401 Unauthorized` without a valid dashboard session cookie.

See the root `README.md` for full production installation, root environment variables, nginx example, task scheduling, and backups.

## Security Notes

- `DASHBOARD_PASSWORD_HASH` is password-equivalent if leaked.
- Use a long random `SESSION_SECRET`.
- Set `DASHBOARD_COOKIE_SECURE=true` only when the browser reaches the dashboard over HTTPS.
- Do not expose the Python chat server directly.
