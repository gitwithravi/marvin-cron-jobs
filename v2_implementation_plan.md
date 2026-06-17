# Dashboard V2 Implementation Plan

## Purpose

Implement `dashboard-v2` as a maintainable, MARVIN-like operations console. This is not a visual refresh of `dashboard/`. It is a parallel rebuild that reuses the current FastAPI/backend contracts while replacing the frontend structure, screen hierarchy, and interaction design.

The dashboard must feel like a private command center for one operator: dark, dense, calm, evidence-first, slightly sardonic only when safe, and never like a generic SaaS admin panel.

## Non-Negotiable Principles

- Build a command center, not an admin dashboard.
- Every screen must answer at least one of:
  - Is something broken?
  - Is something getting worse?
  - What did MARVIN conclude?
  - What evidence supports that conclusion?
  - What human decision is required?
- Never invent analytics, charts, fake activity, fake confidence, or placeholder operational data.
- Show conclusions before raw data.
- Show evidence before action buttons.
- Keep raw JSON/log-like data available, but secondary.
- Use MARVIN personality only in low-risk places: empty states, completed states, small helper copy, non-critical labels.
- Do not use sardonic copy in errors, approvals, finance, security, rejection/approval confirmations, or anything operationally sensitive.
- Keep implementation boring underneath: typed data, small components, centralized API clients, reusable UI primitives.

## Visual System

### Overall Feel

- Dark background, muted surfaces, thin borders, compact spacing.
- Terminal-adjacent, not hacker cosplay.
- Dense but readable.
- Mostly text, status badges, timelines, logs, and evidence blocks.
- Avoid gradients, decorative blobs, marketing hero layouts, big empty cards, and generic analytics dashboards.

### Palette

Use CSS variables in `dashboard-v2/app/globals.css`.

Suggested tokens:

```css
:root {
  --bg: #080b0d;
  --bg-grid: rgba(255, 255, 255, 0.025);
  --surface: #101518;
  --surface-2: #151c20;
  --surface-3: #1b2428;
  --border: #273238;
  --border-strong: #3a474e;
  --text: #e7ece9;
  --text-muted: #9aa7a2;
  --text-faint: #66736f;
  --accent: #8fbba9;
  --accent-strong: #b8d8cb;
  --critical: #ef6351;
  --warning: #d8a657;
  --healthy: #7ccf9b;
  --pending: #9eb2d8;
  --running: #a7c7e7;
  --failed: #ef6351;
  --focus: rgba(143, 187, 169, 0.32);
}
```

### Typography

- Use system sans-serif for body text.
- Use monospace for task names, run IDs, timestamps, evidence labels, API-ish values, logs, and status chips.
- Do not scale fonts with viewport width.
- Do not use negative letter spacing.
- Keep headings compact inside panels.

### Component Style

- Border radius: `6px` or less for panels, buttons, inputs, and cards.
- Buttons use icons from `lucide-react` where useful.
- Use text labels only when command clarity matters.
- Icon-only buttons must have accessible labels and tooltips/titles.
- Cards are allowed only for real operational units or repeated records.
- Do not nest cards inside cards.
- Page sections should be structured panes/bands, not decorative floating cards.

### Status Labels

Internal enums stay boring:

```ts
type MarvinStatus =
  | "healthy"
  | "warning"
  | "critical"
  | "failed"
  | "pending"
  | "running"
  | "approved"
  | "rejected";
```

Display labels:

- `healthy`: Nothing is on fire
- `warning`: Mildly concerning
- `critical`: On fire
- `failed`: Predictably broken
- `pending`: Awaiting human ceremony
- `running`: Thinking, tragically
- `approved`: Human approved
- `rejected`: Human showed restraint

Use these labels in status badges and low-risk summaries. Use exact backend status values in raw detail views.

## Project Structure

Create `dashboard-v2/` as a separate Next.js app.

Recommended structure:

```text
dashboard-v2/
  app/
    api/
    console/
      page.tsx
      attention/page.tsx
      runs/page.tsx
      runs/[taskName]/page.tsx
      approvals/page.tsx
      work/page.tsx
      systems/page.tsx
      support/page.tsx
      finance/page.tsx
      chat/page.tsx
    login/page.tsx
    layout.tsx
    globals.css
    page.tsx
  components/
    shell/
    ui/
  features/
    approvals/
    attention/
    chat/
    finance/
    reports/
    support/
    systems/
    todos/
    work/
  lib/
    api/
    auth.ts
    format.ts
    risk.ts
    status.ts
    time.ts
```

Maintainability rules:

- Route files should compose screens only. Avoid business logic in `app/**/page.tsx`.
- API calls live in `lib/api/*`.
- Feature-specific mapping and state live in `features/<feature>/*`.
- Shared styling primitives live in `components/ui/*`.
- Shell/navigation lives in `components/shell/*`.
- Avoid files over 250 lines. If a component grows, split it.
- Avoid `any`. If raw backend JSON is unknown, type it as `unknown` or `Record<string, unknown>` and isolate it.
- Avoid manually duplicated date, currency, risk, and response parsing logic.

## Shared UI Primitives

Build these first:

- `Button`: variants `primary`, `secondary`, `danger`, `ghost`; supports icon.
- `IconButton`: fixed square size, accessible label.
- `Panel`: plain bordered section for one operational unit.
- `SectionHeader`: eyebrow, title, optional summary/action.
- `StatusBadge`: maps internal statuses/risk to label and color.
- `RiskBadge`: maps `low`, `medium`, `high`, `critical`, unknown.
- `EvidenceBlock`: label, compact evidence rows, optional expandable raw detail.
- `Timeline`: ordered operational events.
- `Tabs`: accessible tab buttons.
- `EmptyState`: title, restrained MARVIN copy, optional action.
- `ErrorState`: precise, non-sardonic error rendering.
- `LoadingState`: compact, no spinners unless necessary.
- `ConfirmDialog`: approvals and destructive/external actions.
- `DataList`: dense label/value rows.
- `LogBlock`: preformatted logs or raw detail.
- `JsonBlock`: collapsible JSON viewer.

## Shared Data Layer

Create these API modules:

- `lib/api/client.ts`
  - `apiFetch<T>(path, options)`.
  - Handles JSON parsing, non-OK responses, network failure, and typed error messages.
- `lib/api/marvin-proxy.ts`
  - Server-side helper for Next API routes to proxy to FastAPI.
- `lib/api/types.ts`
  - Shared backend response types.
- `lib/api/attention.ts`
  - Aggregates alerts, approvals, runs, todos, and Beszel into attention items.
- `lib/api/runs.ts`
- `lib/api/approvals.ts`
- `lib/api/todos.ts`
- `lib/api/systems.ts`
- `lib/api/support.ts`
- `lib/api/finance.ts`
- `lib/api/chat.ts`

API behavior:

- All browser calls go to Next `/api/*`.
- Next API routes enforce session auth before proxying.
- If FastAPI is down, return a clean `503` JSON error.
- Client screens render unavailable states, not stack traces.

## Shell And Navigation

### Screen: Login

Route: `/login`

Purpose:

- Authenticate the single private operator.

Layout:

- Centered compact login panel.
- MARVIN wordmark at top.
- Short subtitle: "Private operations console."
- Username/password fields.
- Primary action: "Sign in".

Personality:

- Invalid credentials may use restrained copy: "Invalid username or password. A familiar human limitation."
- Missing auth config should be precise: "Dashboard authentication is not configured."
- No jokes around session/security failures beyond the existing invalid credential message.

Maintainability:

- Reuse v1 auth logic.
- Keep auth utilities in `lib/auth.ts`.
- Login page should be mostly server-rendered with one form action or simple POST route.

### Screen: App Shell

Routes: all `/console/*`

Purpose:

- Provide persistent navigation and high-signal context.

Layout:

- Left sidebar on desktop, top compact nav on mobile.
- Brand: `MARVIN`.
- Subtitle: `Operations Console`.
- Primary nav:
  - Command
  - Attention
  - Runs
  - Approvals
  - Work
  - Systems
  - Support
  - Finance
  - Chat
- Footer:
  - signed-in user
  - session/logout
  - small environment label: `LOCAL / PRIVATE`

UI behavior:

- Active nav item should be obvious but not bright.
- Shell should not scroll independently unless needed.
- Main content max width should allow dense operational screens, not narrow blog layouts.

Maintainability:

- Define nav items in one array.
- Shell component must not fetch feature data.

## Screen 1: Command

Route: `/console`

Purpose:

- First screen after login.
- Show operational posture and the few things that need Ravi's attention.

Data sources:

- `/api/alerts/latest`
- `/api/approvals?view=pending`
- `/api/runs`
- `/api/todos?include_done=true`
- `/api/beszel`
- `/api/openrouter-usage`

Layout order:

1. Posture strip
2. Attention queue preview
3. Latest MARVIN conclusions
4. System/service posture
5. Quiet secondary metrics

Posture strip:

- One-line summary generated only from real data.
- Examples:
  - "Nothing is on fire. 3 systems checked. 1 task needs approval."
  - "Mildly concerning. Beszel has active alerts and humans remain involved."
- Do not say "welcome back".

Attention queue preview:

- Show top 5 attention items sorted by severity then recency.
- Each item:
  - severity badge
  - title
  - one-line conclusion
  - evidence snippet
  - updated time
  - action link

Latest MARVIN conclusions:

- Use latest task runs.
- Show task name, risk, deterministic summary, observed time.
- Action: `View run`.

System posture:

- Beszel summary: systems up/down, triggered alerts, containers.
- OpenRouter usage: credits used/remaining as text and small progress bar, not a decorative chart.
- API availability state.

Personality:

- Empty attention queue: "No pending decisions. A rare moment of peace. Don't get attached."
- Do not use jokes if any critical item exists.

Maintainability:

- Build `features/attention/getAttentionItems.ts` as a server-side aggregator.
- The Command page should only compose `PostureStrip`, `AttentionPreview`, `LatestConclusions`, and `SystemPosture`.

## Screen 2: Attention

Route: `/console/attention`

Purpose:

- Unified action queue for anything requiring attention.

Data sources:

- Same attention aggregator as Command.

Layout:

- Header: "Attention"
- Filter tabs:
  - All
  - Critical
  - Approvals
  - Failed runs
  - Waiting on humans
  - Systems
- Dense list on left.
- Detail pane on right for selected item.

Item card:

- status/risk badge
- title
- source type
- conclusion
- evidence count or evidence snippet
- updated time
- primary action

Detail pane:

- Conclusion
- Evidence
- Recommended action
- Source metadata
- Link to owning screen

Personality:

- Empty state: "The queue is empty. Suspicious, but acceptable."
- Never use personality in critical detail text.

Maintainability:

- `AttentionItem` should be a normalized type.
- Keep source-specific mapping functions small:
  - `approvalToAttentionItem`
  - `runToAttentionItem`
  - `todoToAttentionItem`
  - `alertToAttentionItem`
  - `beszelToAttentionItems`

## Screen 3: Runs

Route: `/console/runs`

Purpose:

- Browse task runs and reports.

Data sources:

- `/api/runs`
- task configs from `tasks/*/config.yaml`, if needed for display names.

Layout:

- Header: "Runs"
- Filter row:
  - task
  - risk
  - status
  - has summary
- Main table/list:
  - task
  - risk
  - status
  - deterministic conclusion
  - observed time
  - summary availability
  - action

UI:

- Prefer dense table/list over card grid.
- Risk color should be meaningful but restrained.
- Failed runs should be visually obvious.

Maintainability:

- `features/reports/RunList.tsx`
- `features/reports/runMappers.ts`
- Formatting via `lib/time.ts` and `lib/risk.ts`.

## Screen 4: Run Detail

Route: `/console/runs/[taskName]?run=<runId>`

Purpose:

- Explain what MARVIN observed and concluded for a specific task run.

Data sources:

- `/api/runs/{runId}?task_name=<taskName>`
- `/api/runs/{runId}/summary?task_name=<taskName>` for summary generation.

Layout order:

1. Run header
2. Deterministic analysis
3. MARVIN/LLM summary, if available
4. Evidence/factual payload summary
5. Raw JSON/log details

Run header:

- task name
- run ID
- status
- risk
- observed time
- started/finished time

Deterministic analysis:

- Must appear before LLM summary.
- Show summary, notable facts, recommended actions.
- Label it clearly: "Deterministic analysis".

LLM summary:

- Label: "MARVIN's explanation".
- If absent, button: "Generate explanation".
- Loading copy: "Thinking, tragically."
- Do not let LLM summary override deterministic risk.

Raw data:

- Collapsible JSON.
- Secondary visual weight.

Personality:

- Safe loading state can say: "Thinking, tragically."
- Error generating summary must be plain: "Failed to generate summary."

Maintainability:

- Split into `RunHeader`, `DeterministicAnalysisPanel`, `MarvinSummaryPanel`, `EvidencePanel`, `RawPayloadPanel`.

## Screen 5: Approvals

Route: `/console/approvals`

Purpose:

- Human review workspace for external or consequential actions.

Data sources:

- `/api/approvals?view=pending`
- `/api/approvals?view=history`
- `/api/approvals/{approvalId}`
- `/api/approvals/{approvalId}/approve`
- `/api/approvals/{approvalId}/reject`

Layout:

- Two-pane workspace.
- Left pane:
  - tabs: Pending, History
  - approval list
  - status, target label, summary, created time
- Right pane:
  - approval detail
  - draft content editor
  - evidence
  - workflow steps
  - approve/reject controls

Approval detail order:

1. What MARVIN wants to do
2. Draft content
3. Evidence
4. Policy flags
5. Workflow steps/logs
6. Human decision controls

Actions:

- Approve requires confirm dialog.
- Reject requires optional reason.
- Buttons:
  - `Approve`
  - `Reject`
  - `Refresh`

Personality:

- Empty pending state: "No pending approvals. A rare moment of peace. Don't get attached."
- Approval buttons and confirm dialogs must be precise and non-sardonic.
- Do not use "Human approved" as the only confirmation; include exact target label.

Maintainability:

- `useApprovals` hook owns loading, selection, approve/reject actions.
- Editor state should be isolated from list state.
- Evidence rendering should reuse `EvidenceBlock`.

## Screen 6: Work

Route: `/console/work`

Purpose:

- Consolidate todos, follow-ups, email captures, and team status into one operational work surface.

Data sources:

- `/api/todos?include_done=true`
- `/api/todo-tags`
- `/api/todo-people`
- `/api/email-captures`
- `/api/team-status`

Layout:

- Header: "Work"
- Top summary band:
  - inbox count
  - high/urgent count
  - waiting on others count
  - unreviewed email captures
- Tabs:
  - Board
  - Follow-ups
  - Email captures
  - Team
  - History

### Work / Board Tab

Purpose:

- Replace v1 TodoManager with maintainable pieces.

Columns:

- Triage: `inbox`, `idea`, `need_to_plan`
- WIP: `wip`
- Update needed: `update_needed`
- Pending on others: `pending_on_others`

Todo card:

- title
- priority
- due date
- project
- tags
- waiting person, if any
- reviewed/source flags

Actions:

- create todo
- edit todo
- move status
- mark done
- assign waiting person
- tag filtering

Personality:

- Empty board: "No visible work. Either progress happened or the filters are lying."
- Do not joke on due/urgent items.

Maintainability:

- Split into `TodoCapture`, `TodoFilters`, `TodoBoard`, `TodoCard`, `TodoEditDialog`, `WaitingPersonDialog`, `TagManagerDialog`.
- Keep drag/drop optional. Simple buttons/select controls are acceptable and easier to maintain.

### Work / Follow-ups Tab

Purpose:

- Show tasks blocked on people.

Layout:

- Group by person.
- Each group shows waiting tasks sorted by priority/due date.
- Actions:
  - need update
  - back to WIP
  - mark done

Personality:

- Empty state: "No one is blocking anything. Statistically suspicious."

### Work / Email Captures Tab

Purpose:

- Review forwarded emails, created todos, duplicates, errors, and notification delivery.

Layout:

- Left list of captures.
- Right detail:
  - subject/from/date
  - status
  - created todo links
  - duplicate markers
  - event timeline
  - raw preview

Personality:

- Errors must be precise.
- Empty state may say: "No captured emails. The inbox has chosen silence."

### Work / Team Tab

Purpose:

- Live team status grouped by member/date.

Layout:

- Date selector.
- Member sections with task/status lists.
- Highlight stale or missing updates if backend provides that signal.

Personality:

- Be restrained. Team/people views should avoid jokes that sound accusatory.

## Screen 7: Systems

Route: `/console/systems`

Purpose:

- Infrastructure and service health.

Data sources:

- `/api/beszel`
- `/api/alerts/latest`
- `/api/openrouter-usage`
- `PUBLIC_STATUS_PAGES`

Layout:

- Header: "Systems"
- Top health strip:
  - systems up/down
  - active alerts
  - API availability
  - OpenRouter credit posture
- Sections:
  - Beszel systems
  - Active alerts
  - Containers
  - Public status pages
  - OpenRouter usage

Beszel system unit:

- system name
- status
- CPU/memory/disk compact values
- last updated
- recent alert evidence

Avoid:

- Large decorative charts.
- Fake trend lines.
- Overly colorful dashboards.

Personality:

- Healthy state: "Nothing is on fire."
- Failed/unavailable state must be precise.

Maintainability:

- `features/systems/BeszelOverview.tsx` should be split from v1 into small components:
  - `SystemHealthStrip`
  - `BeszelSystemList`
  - `AlertList`
  - `ContainerList`
  - `OpenRouterUsagePanel`
  - `StatusPagesPanel`

## Screen 8: Support

Route: `/console/support`

Purpose:

- Review support tickets, generate RAG suggestions, and send approved replies.

Data sources:

- `/api/support-rag/tickets`
- `/api/support-rag/suggest`
- `/api/support-rag/send`
- `/api/support-rag/review`
- `/api/support-rag/index`
- `/api/agent-runs/support-reply`
- `/api/agent-runs/support-reply/sync`

Layout:

- Ticket queue left.
- Ticket/detail workspace right.
- Detail order:
  - ticket summary
  - MARVIN suggestion
  - matched examples/evidence
  - editable reply
  - review/send actions

Actions:

- Generate suggestion.
- Edit draft.
- Save review.
- Send reply.
- Sync workflow.

Personality:

- Do not be sarcastic in replies, ticket content, or send confirmations.
- Empty queue can be lightly sardonic: "No tickets waiting. Someone may have fixed something. Alarming."

Maintainability:

- Keep reply editor separate from ticket list.
- Keep RAG evidence renderer reusable with approvals evidence blocks.

## Screen 9: Finance

Route: `/console/finance`

Purpose:

- Upload invoices, confirm extracted fields, and review monthly reimbursement totals.

Data sources:

- `/api/invoices`
- `/api/invoices/extract`
- `/api/invoices/files/*`

Layout:

- Header: "Finance"
- Upload/extract panel.
- Extraction confirmation panel.
- Month records panel.
- Totals row.

Extraction confirmation:

- Original filename.
- Confidence badge.
- Currency detected.
- Invoice number.
- Vendor.
- Invoice date.
- Amount USD.
- Amount INR.
- Duplicate warning.
- USD-only confirmation checkbox when required.

Personality:

- No jokes in financial totals, duplicate warnings, extracted fields, or confirmation actions.
- Empty monthly records can say: "No invoices for this month. The spreadsheet remains hungry."

Maintainability:

- Split into `InvoiceUpload`, `InvoiceDraftConfirm`, `InvoiceMonthSelector`, `InvoiceTotals`, `InvoiceTable`.
- Keep extraction draft state isolated.

## Screen 10: Chat

Route: `/console/chat`

Purpose:

- Chat with Hermes/MARVIN without covering operational screens.

Data sources:

- `/api/hermes-converse`

Layout:

- Full-page chat view.
- Conversation column.
- Prompt input at bottom.
- Optional right rail for recent run/context shortcuts.

Behavior:

- Do not make bubbly consumer chat UI.
- Messages should look like log entries or terminal conversation blocks.
- Clearly label assistant/source.

Personality:

- Placeholder: "Ask Hermes. MARVIN will judge silently."
- Loading: "Waiting for Hermes..."
- Errors must be precise.

Maintainability:

- Keep chat state in `useChatSession`.
- Do not couple chat to shell or global layout state.

## API Route Migration

Implement Next API routes under `dashboard-v2/app/api/` matching v1 where possible:

- `/api/login`
- `/api/logout`
- `/api/alerts/latest`
- `/api/alerts/refresh`
- `/api/approvals`
- `/api/approvals/[approvalId]`
- `/api/approvals/[approvalId]/approve`
- `/api/approvals/[approvalId]/reject`
- `/api/runs`
- `/api/runs/[runId]`
- `/api/runs/[runId]/summary`
- `/api/todos`
- `/api/todos/[id]`
- `/api/todos/[id]/retag`
- `/api/todo-tags`
- `/api/todo-people`
- `/api/beszel`
- `/api/team-status`
- `/api/support-rag/*`
- `/api/invoices`
- `/api/invoices/extract`
- `/api/invoices/files/[...path]`
- `/api/email-captures`
- `/api/email-captures/[id]`
- `/api/openrouter-usage`
- `/api/hermes-converse`

Rules:

- Every privileged API route calls `requireApiSession()`.
- Proxy helpers must preserve method, search params, and JSON body.
- File-serving routes must preserve v1 security behavior.
- Do not expose FastAPI directly to browser code.

## Implementation Order

1. Scaffold `dashboard-v2`.
2. Add dependencies and config:
   - Next 15
   - React 19
   - TypeScript
   - ESLint
   - `react-markdown`
   - `remark-gfm`
   - `yaml`
   - `lucide-react`
3. Copy and clean auth/session utilities from v1.
4. Build shared API client and proxy helpers.
5. Build global CSS tokens and UI primitives.
6. Build shell and login.
7. Build API route parity.
8. Build Command screen.
9. Build Attention screen.
10. Build Runs and Run Detail screens.
11. Build Approvals screen.
12. Build Work screen in tabs.
13. Build Systems screen.
14. Build Support screen.
15. Build Finance screen.
16. Build Chat screen.
17. Add PM2 config for `marvin-dashboard-v2` on port `3032`.
18. Run lint/build and manual smoke tests.

## Acceptance Checklist

- `dashboard-v2` runs independently of `dashboard/`.
- Existing `dashboard/` remains untouched except for any explicitly requested docs/config updates.
- Login/session flow works.
- Unauthenticated `/api/*` routes return `401`.
- FastAPI unavailable state renders cleanly.
- Command screen prioritizes attention, not generic metrics.
- No fake charts or fake analytics.
- Deterministic task analysis appears before LLM summaries.
- Approvals show evidence before approve/reject actions.
- Finance and security-sensitive screens use precise, non-sardonic copy.
- Shared UI primitives are reused across screens.
- No feature component becomes a 900-line manager.
- `npm run lint` passes.
- `npm run build` passes.
- Mobile layout is usable.
- Text does not overflow buttons, panels, or sidebars.

## Final Notes For Implementer

- Use the current `dashboard/` only to understand API contracts and behavior.
- Do not copy v1's giant global stylesheet or oversized client components.
- Prefer boring, typed utilities over clever abstractions.
- When unsure about UI copy, choose clarity over personality.
- When unsure about layout, put attention and evidence first.
- When unsure about data, show nothing rather than inventing a metric.
