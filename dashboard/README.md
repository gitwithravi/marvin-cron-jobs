# MARVIN Dashboard

This is the Next.js dashboard for MARVIN. The first feature is authenticated task report viewing, but the app shell is intended to host future agent controls.

## Setup

```bash
cd dashboard
npm install
cp .env.example .env.local
```

Create a SHA-1 password hash:

```bash
printf 'your-password' | sha1sum
```

Set:

```text
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD_HASH=<sha1 hash>
SESSION_SECRET=<long random string>
```

The floating chat has MARVIN and Hermes modes. MARVIN/Hermes calls both go through the Python chat server on `CHAT_SERVER_PORT`; configure Hermes in the root `.env` with `HERMES_BASE_URL`, `HERMES_MODEL`, optional `HERMES_API_KEY`, and `HERMES_TIMEOUT_SECONDS`.

Run locally:

```bash
npm run dev
```

The `dev` and `start` scripts bind to `127.0.0.1:3030`.

For production behind nginx:

```bash
npm run build
pm2 start ecosystem.config.cjs
```

Point nginx at `http://127.0.0.1:3030` and preserve `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers so login/logout redirects use the public Tailscale MagicDNS name.

## Security Notes

This app uses HTTP-only signed cookies and compares passwords server-side. Because the planned deployment uses Tailscale MagicDNS without HTTPS, browser-to-server traffic is not protected by TLS at the browser layer. Tailscale encrypts tailnet traffic, but the dashboard must not be exposed outside the tailnet.

`DASHBOARD_PASSWORD_HASH` is password-equivalent if leaked. Keep dashboard env files private.
