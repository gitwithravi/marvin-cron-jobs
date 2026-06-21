# MARVIN Production Deployment

This document is the production runbook for deploying MARVIN on a Linux host.

Assumptions:
- You are deploying on a private VM or a tailnet host.
- nginx sits in front of the dashboard.
- PM2 manages the dashboard and FastAPI processes.
- The repo is cloned into `/opt/marvin-agent`.

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y git python3 python3-venv nodejs npm nginx
sudo npm install -g pm2
```

Use Node.js 20+ for Next.js 15. If your distro ships an older Node.js, install a current LTS release before continuing.

## 2. Clone the repo

```bash
sudo mkdir -p /opt
sudo chown "$USER":"$USER" /opt
git clone <repo-url> /opt/marvin-agent
cd /opt/marvin-agent
```

## 3. Create the Python virtualenv

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

## 4. Install dashboard dependencies

```bash
cd dashboard-v2
npm install
cd ..
```

## 5. Create the root `.env`

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env` and set the values you actually use.

Minimum production values:

```env
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

HERMES_BASE_URL=http://hermes-vm:8000/v1
HERMES_MODEL=hermes
HERMES_API_KEY=
HERMES_TIMEOUT_SECONDS=60
```

If you want email-to-todo capture, also set:

```env
MARVIN_EMAIL_CAPTURE_SECRET=replace-with-a-long-random-secret
MARVIN_ALLOWED_FORWARDERS=ravi@vitbhopal.ac.in,ravi.pm@vitbhopal.ac.in
MARVIN_EMAIL_STORAGE_PATH=data/marvin/email-capture
APP_BASE_URL=https://tasks.vitbhopal.dev
APP_TIMEZONE=Asia/Kolkata
LLM_EMAIL_CAPTURE_ENABLED=true
LLM_EMAIL_CAPTURE_MODEL=google/gemini-2.5-flash

NTFY_BASE_URL=https://ntfy.vitbhopal.dev
NTFY_TOPIC=marvin-todos
NTFY_USERNAME=
NTFY_PASSWORD=
NTFY_ACCESS_TOKEN=
```

## 6. Create the dashboard `.env.local`

```bash
cd dashboard-v2
cp .env.example .env.local
chmod 600 .env.local
```

Set at least:

```env
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD_HASH=<sha1 hash>
SESSION_SECRET=<long-random-secret>
DASHBOARD_COOKIE_SECURE=true
MARVIN_API_PORT=3031
```

If you are using email capture, add the same secret here too:

```env
MARVIN_EMAIL_CAPTURE_SECRET=replace-with-a-long-random-secret
```

Generate a SHA-1 password hash:

```bash
printf 'your-password' | sha1sum
```

Return to the repo root after editing:

```bash
cd ..
```

## 7. Prepare data directories

```bash
mkdir -p data reports logs
mkdir -p data/qdrant_support_rag
mkdir -p data/marvin/email-capture
chmod -R u+rwX data reports logs
```

If your deployment user is not the same user that runs PM2, make sure that user can write those directories.

## 8. Index support RAG

If you have support CSV exports in `kb/`, run the indexer once:

```bash
. .venv/bin/activate
python tools/index_support_rag.py
```

That will:
- read the CSV exports from `kb/`
- write the fallback JSONL index at `data/support_rag_examples.jsonl`
- populate local Qdrant storage at `data/qdrant_support_rag`

If you want only the fallback JSONL index and no Qdrant collection:

```bash
. .venv/bin/activate
python tools/index_support_rag.py --no-qdrant
```

## 9. Build the dashboard

```bash
cd dashboard-v2
npm run build
cd ..
```

## 10. Start with PM2

```bash
pm2 start dashboard-v2/ecosystem.config.cjs
pm2 save
pm2 startup
```

The PM2 process file starts:
- `marvin-dashboard-v2` on `127.0.0.1:3032`
- `marvin-api` on `127.0.0.1:3031`

Useful PM2 commands:

```bash
pm2 list
pm2 logs marvin-dashboard-v2
pm2 logs marvin-api
pm2 restart marvin-dashboard-v2 marvin-api
pm2 restart marvin-dashboard-v2 --update-env
pm2 restart marvin-api --update-env
```

## 11. Configure nginx

Example nginx site:

```nginx
server {
    listen 80;
    server_name marvin.example.com;

    location / {
        proxy_pass http://127.0.0.1:3032;
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

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/marvin /etc/nginx/sites-enabled/marvin
sudo nginx -t
sudo systemctl reload nginx
```

If you expose the site over HTTPS, set:

```env
DASHBOARD_COOKIE_SECURE=true
```

## 12. Optional cron jobs

Add the operational tasks you want to run on a schedule. Example:

```cron
*/15 * * * * cd /opt/marvin-agent && . .venv/bin/activate && python -m tasks.uptime_kuma_heartbeat.run >> logs/uptime_kuma_heartbeat.log 2>&1
*/15 * * * * cd /opt/marvin-agent && . .venv/bin/activate && python -m tasks.beszel_server_status.run >> logs/beszel_server_status.log 2>&1
*/30 * * * * cd /opt/marvin-agent && . .venv/bin/activate && python -m tasks.team_status_today.run >> logs/team_status_today.log 2>&1
*/30 * * * * cd /opt/marvin-agent && . .venv/bin/activate && python -m tasks.vityarthi_support_tickets.run >> logs/vityarthi_support_tickets.log 2>&1
```

## 13. Email-to-todo capture

If you want inbound email capture:

1. Set `MARVIN_EMAIL_CAPTURE_SECRET` in both root `.env` and `dashboard-v2/.env.local`.
2. Set `MARVIN_ALLOWED_FORWARDERS` to the real forwarder addresses.
3. Restart PM2:

```bash
pm2 restart marvin-api marvin-dashboard-v2 --update-env
```

4. Deploy the Cloudflare Worker in `workers/cloudflare-email-worker/`.
5. Point Cloudflare Email Routing for `marvin@...` to that Worker.
6. Add any plus aliases you want to support.

Example worker config:

```toml
[vars]
MARVIN_API_BASE_URL = "https://tasks.vitbhopal.dev"
MARVIN_EMAIL_CAPTURE_SECRET = "replace-with-a-long-random-secret"
```

## 14. Smoke tests

After startup, verify the services:

```bash
curl -I http://127.0.0.1:3032/login
curl -s http://127.0.0.1:${MARVIN_API_PORT}/todo-tags
curl -s http://127.0.0.1:${MARVIN_API_PORT}/email-captures
curl -s http://127.0.0.1:${MARVIN_API_PORT}/runs?task_name=team_status_today
```

If email capture is enabled, test the webhook directly:

```bash
curl -sS -X POST http://127.0.0.1:3032/api/marvin/email-capture \
  -H 'Content-Type: application/json' \
  -H "X-Marvin-Email-Secret: $MARVIN_EMAIL_CAPTURE_SECRET" \
  -d '{
    "from":"ravi@vitbhopal.ac.in",
    "to":"marvin+urgent@vitbhopal.dev",
    "subject":"Fwd: Production smoke test",
    "messageId":"<prod-smoke@example.com>",
    "date":"2026-06-16T10:30:00+05:30",
    "headers":{"content-type":"text/plain"},
    "textBody":"Please do this tomorrow.\n\n---------- Forwarded message ---------\nFrom: smoke-test@example.com\nNeed follow up.",
    "rawEmail":"Subject: Fwd: Production smoke test\n\nNeed follow up.",
    "attachments":[]
  }'
```

Expected result:
- `success: true`
- `taskId` returned
- todo appears in `/console/todos`
- capture appears in `/console/email-captures`

## 15. Backups

Back up these paths:

```text
data/marvin.sqlite3
data/qdrant_support_rag/
data/support_rag_examples.jsonl
reports/
.env
dashboard-v2/.env.local
```

## 16. Update flow

For routine updates:

```bash
cd /opt/marvin-agent
git pull
. .venv/bin/activate
pip install -r requirements.txt
cd dashboard-v2
npm install
npm run build
cd ..
pm2 restart marvin-api marvin-dashboard-v2 --update-env
```

If you change support RAG data:

```bash
. .venv/bin/activate
python tools/index_support_rag.py
pm2 restart marvin-api
```

If you change only dashboard UI:

```bash
cd dashboard-v2
npm run build
cd ..
pm2 restart marvin-dashboard-v2
```
