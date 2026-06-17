# Dashboard V2 Migration Plan

## Summary

Build `dashboard-v2` as a parallel Next.js 15 app, leaving `dashboard/` intact until v2 is usable. Treat v1 as a backend/API reference only. The v2 UI should follow `marvin_ui_design_principle.md`: a dark, calm operations command center focused on attention, evidence, conclusions, and human decisions.

The first v2 release will be a fresh rethink, not a screen-for-screen clone. Existing capabilities remain available, but the information architecture changes from "pages of features" to "what needs attention, what MARVIN concluded, what evidence supports it, and what action is required."

## Architecture And Interfaces

- Create `dashboard-v2/` with:
  - Next.js App Router, React 19, TypeScript strict mode.
  - Same auth model as v1: signed HTTP-only `marvin_dashboard_session` cookie.
  - Same backend boundary: browser calls only Next `/api/*`; Next proxies to FastAPI on `127.0.0.1:${MARVIN_API_PORT}`.
  - Same env contract as v1: `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD_HASH`, `SESSION_SECRET`, `DASHBOARD_COOKIE_SECURE`, `MARVIN_API_PORT`, `PUBLIC_STATUS_PAGES`.
  - Add `lucide-react` for icons; avoid shadcn or a heavy UI kit.
- Preserve backend API compatibility:
  - Reuse FastAPI endpoints unchanged: `/alerts/*`, `/approvals/*`, `/runs/*`, `/todos/*`, `/beszel`, `/team-status`, `/support-rag/*`, `/invoices/*`, `/email-captures`, `/openrouter-usage`, `/hermes/chat`.
  - Keep Next API route names compatible where practical so existing browser-side fetch patterns remain boring and predictable.
  - Move API response types into typed modules under `dashboard-v2/lib/api/types.ts`.
  - Centralize fetch/proxy behavior in `dashboard-v2/lib/api/marvin.ts`; no component should hand-roll response parsing.

## Key Implementation Changes

### Information Architecture

- `/` redirects to `/console`.
- `/console`: attention-first command center with critical alerts, pending approvals, latest conclusions, task posture, and service health.
- `/console/attention`: unified queue for alerts, approvals, overdue/high-priority todos, failed runs, and support drafts needing review.
- `/console/runs`: task runs and reports, with MARVIN conclusion first, deterministic evidence second, raw JSON last.
- `/console/approvals`: approval review workspace with draft, evidence, policy flags, approve/reject actions, and history.
- `/console/work`: todos, follow-ups, email captures, and team status grouped around operational work.
- `/console/systems`: Beszel, public status pages, OpenRouter usage, and backend health.
- `/console/support`: support RAG ticket review and reply drafting.
- `/console/finance`: invoice upload, extraction confirmation, and monthly reimbursement records.
- `/console/chat`: optional full-page Hermes/MARVIN chat; floating chat can be added later only if it does not obscure operational content.

### Maintainable Code Structure

- `app/` contains route shells only.
- `features/*` contains feature-specific components, hooks, mappers, and types.
- `components/ui/*` contains reusable primitives: `Button`, `IconButton`, `StatusBadge`, `EvidenceBlock`, `MetricLine`, `Timeline`, `Panel`, `EmptyState`, `ConfirmDialog`, `Tabs`, `Field`, `Textarea`.
- `lib/api/*` contains all API clients and response validation/mapping.
- `lib/status.ts` owns boring internal enums and MARVIN display labels, for example `healthy -> Nothing is on fire`.
- `lib/time.ts`, `lib/format.ts`, and `lib/risk.ts` replace duplicated formatting helpers.
- Keep feature components under roughly 200 lines; split stateful work into hooks like `useApprovals`, `useTodos`, `useInvoices`.

### Design System

- Dark terminal-adjacent theme with CSS variables: background, surface, panel, border, text, muted text, status colors, focus ring.
- Sparse status color only: healthy/success, warning, critical/danger, pending, running, failed.
- Dense layouts, no marketing hero, no decorative gradients, no fake analytics.
- Cards only for meaningful operational units; page sections should be full-width bands or structured panes.
- Use monospace accents for run IDs, timestamps, task names, evidence labels, and logs.
- Personality appears only in empty states, low-risk summaries, and small helper text. Error details, approvals, invoices, and security actions stay precise.

### Command Center Behavior

- Build an attention aggregator on the Next server using existing APIs:
  - latest alert from `/alerts/latest`
  - pending approvals from `/approvals?view=pending`
  - latest runs from `/runs`
  - todos from `/todos?include_done=true`
  - Beszel summary from `/beszel`
- Normalize these into `AttentionItem` objects:
  - `id`, `kind`, `severity`, `title`, `summary`, `evidence`, `updatedAt`, `href`, `actionLabel`
- Sort by severity first, then recency.
- Never invent metrics; every summary must trace to API-backed data.

### Migration And Rollout

- Run v2 locally on port `3032`: `npm run dev -- --port 3032` or a dedicated script.
- Add `dashboard-v2/ecosystem.config.cjs` with `marvin-dashboard-v2` on `127.0.0.1:3032`.
- Keep existing `marvin-dashboard` on `3030` until v2 passes smoke checks.
- After acceptance, switch PM2/nginx to v2 or change v2 production port to `3030`.
- Do not delete `dashboard/` in the initial migration; archive/remove only after v2 has been used in production.

## Test Plan

### Static Checks

- `cd dashboard-v2 && npm run lint`
- `cd dashboard-v2 && npm run build`
- TypeScript strict build must pass without `any` in new shared API/types except for explicitly isolated raw JSON fields.

### Manual Smoke Checks

- `/login` renders and rejects bad credentials.
- Authenticated `/console` loads when FastAPI is running.
- Unauthenticated `/api/*` returns `401`.
- If FastAPI is down, v2 shows a precise unavailable state instead of crashing.
- Pending approvals can be opened, edited, approved, and rejected.
- Run detail shows deterministic analysis before LLM summary and raw payload.
- Todo board supports create, edit, status movement, tags, people, and follow-up grouping.
- Invoice extraction flow preserves duplicate/USD confirmation behavior.
- Beszel and status pages handle empty/unavailable data cleanly.

### Visual Acceptance

- Desktop and mobile screenshots for `/console`, `/console/attention`, `/console/runs`, `/console/approvals`, `/console/work`, `/console/systems`.
- Verify no text overlap, no unreadable contrast, no layout shift from long task names or evidence strings.
- Confirm the UI reads as "command center" rather than SaaS admin: attention queue first, evidence visible, raw data secondary.

## Assumptions

- `dashboard-v2` should be a separate app, not an in-place rewrite.
- V2 should rethink workflows and navigation, while preserving access to all current backend-backed capabilities.
- FastAPI and SQLite schema stay unchanged for the first migration.
- No real credentials or `.env.local` files are committed.
- `dashboard/` remains available as rollback until v2 has production confidence.
