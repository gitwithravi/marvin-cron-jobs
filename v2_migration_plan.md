  # MARVIN Console V2 Migration Plan

  ## Summary

  Build dashboard-v2 as a new route surface inside the existing dashboard/ Next.js app, mounted at /console, while reusing the current auth and API proxy infrastructure. The goal of
  V2 is not just visual cleanup: it is a maintainable command-center UI system that implements the marvin_ui_design_principle.md north star, preserves page coverage, and allows
  selective flow improvements where the current information architecture fights the intended “attention-first” console model.

  The migration should proceed by creating a new UI architecture first, then rebuilding each existing dashboard page under /console with a one-to-one route mapping, then redirecting
  old /dashboard/* routes to their /console/* equivalents once parity is verified. Sunset happens only after all mapped pages are live and stable.

  ## Route Mapping And Migration Rules

  Create these V2 routes inside the same app:

  - /console replaces /dashboard
  - /console/approvals replaces /dashboard/approvals
  - /console/beszel replaces /dashboard/beszel
  - /console/team-status replaces /dashboard/team-status
  - /console/support replaces /dashboard/support
  - /console/reports replaces /dashboard/reports
  - /console/reports/[taskName] replaces /dashboard/reports/[taskName]
  - /console/status replaces /dashboard/status
  - /console/todos replaces /dashboard/todos
  - /console/email-captures replaces /dashboard/email-captures
  - /console/invoices replaces /dashboard/invoices

  Migration rules:

  - Keep /login and existing session/auth flows unchanged in phase 1.
  - Update root / redirect to /console only after /console overview is production-ready.
  - Keep existing /api/* routes as the backend contract for V2 in the first pass.
  - After each page is validated, add a redirect from the old /dashboard/* route to its /console/* equivalent.
  - Do not sunset /dashboard until every mapped page is live and the old navigation is no longer the default entry.

  ## Implementation Changes

  ### 1. Establish a maintainable V2 frontend architecture

  Create a V2-specific structure inside dashboard/ with clear boundaries:

  - app/console/... for route entrypoints only.
  - components/console/... for reusable presentation primitives and composed page sections.
  - lib/console/... for view models, display mapping, formatting, and page-specific server data assembly.
  - lib/api/... or similar shared fetch helpers for typed frontend access to existing /api/* endpoints.
  - lib/design-system/... for tokens, status semantics, copy rules, and layout conventions.

  Architecture rules for V2:

  - Keep route files thin: auth, server data loading, and composition only.
  - Split current large client components into smaller feature slices by domain and responsibility.
  - Move fetch logic and response shaping out of monolithic UI components into typed helpers/hooks.
  - Separate “domain state” from “render state”; avoid single components owning all loading, filtering, editing, and layout concerns.
  - Prefer server components for read-heavy screens and isolate client components to interactive islands.
  - Introduce explicit shared types for task status, approval state, evidence blocks, timeline rows, and operator actions instead of any-shaped UI data.

  ### 2. Encode the MARVIN design principle as system constraints

  Implement a V2 design system aligned to “Command Center, Not Admin Panel”:

  - Replace the current light Inter-based admin feel with a dark, terminal-adjacent theme using muted contrast and status color only when meaningful.
  - Define V2 CSS variables for background, surface hierarchy, typography, spacing, borders, and status colors, instead of page-by-page styling drift.
  - Standardize status enums to boring internal values and map them to display copy separately.
  - Make conclusion-first presentation a hard pattern: every operational unit shows conclusion, evidence, last run, and required action before raw details.
  - Make raw JSON/log/Markdown secondary and collapsible, not the primary layout.
  - Use personality only in empty states, helper text, and non-critical summaries.

  Required reusable V2 primitives:

  - App shell with attention-first navigation and active-state awareness.
  - Status badge with internal enum -> MARVIN display label mapping.
  - Operational unit card/panel with status, conclusion, evidence, timestamp, and action slot.
  - Timeline/log list for runs, approvals, and history.
  - Evidence block for raw facts, confidence, and supporting detail.
  - Empty state, loading state, and failure state components with consistent tone.

  ### 3. Rebuild the overview as a command center, not a metrics page

  The new /console overview should be a triage surface, not a summary dashboard.

  Overview composition:

  - Top summary line answering: what is broken, what needs approval, what recently changed.
  - Critical alerts section first.
  - Pending approvals second.
  - Latest MARVIN conclusions third.
  - Task execution posture and service health after that.
  - Historical/log-style recent activity below the fold.

  Specific first-pass changes:

  - De-emphasize or remove decorative summary metrics that do not drive action.
  - Move OpenRouter spend out of prime real estate; keep it as a secondary operational module if still needed.
  - Represent tasks as operational units with last run, risk, conclusion, evidence, and next action.
  - Make homepage copy concise and high-signal rather than “product overview” language.

  ### 4. Rebuild each mapped page by feature slice

  For each mapped page, keep capability coverage but improve structure.

  - approvals: split list, detail, decision form, and history into separate modules; prioritize “needs decision now”.
  - beszel: present current risk/conclusion first, then alerts, then containers/resources, then historical detail.
  - team-status: optimize for blockers, overdue work, and who is waiting on whom rather than neutral listing.
  - support: separate ticket queue, generated suggestion, review/edit state, and send action into distinct subcomponents.
  - reports: replace generic cards with operational run summaries; keep report detail page Markdown-first with evidence and summary above raw payload views.
  - status: treat external/public status pages as references, not as the main information architecture.
  - todos: split the current monolith into board/list state, editor, filters, tags, and people management; make urgent and pending items easier to scan than completed inventory.
  - email-captures: separate inbox list, extraction outcome, duplicate detection, and created todo traceability.
  - invoices: separate month summary, extraction intake, edit form, and file/history surfaces.

  ### 5. Sunset strategy

  After /console is complete:

  - Make /console the primary nav destination and default home redirect.
  - Convert /dashboard/* pages to redirects only.
  - Remove obsolete V1-only components, V1 layout styles, and duplicate copy/constants after a short stabilization period.
  - Keep shared auth and API utilities if still used; remove dead V1 view helpers once no route imports them.

  ## Public Interfaces And Internal Contracts

  Keep these contracts stable during V2 phase 1:

  - Existing /api/* routes remain the frontend-backend contract.
  - Existing session cookie and /login behavior remain unchanged.
  - Existing FastAPI backend endpoints remain unchanged.

  Add these internal contracts for maintainability:

  - Typed frontend data contracts for each V2 page’s assembled view model.
  - A shared status-display mapper with internal enum values like healthy | warning | critical | failed | pending | running | approved | rejected.
  - A shared route-map constant that defines old /dashboard/* -> new /console/* equivalents.
  - Shared page composition conventions so every route follows the same server-data -> view-model -> presentation flow.

  ## Test Plan

  Verification should cover both behavior and migration safety.

  - Route tests for every /console/* page to ensure authenticated access and successful rendering.
  - Redirect tests for / to /console once switched, and for each retired /dashboard/* route once sunset starts.
  - UI smoke tests for the major operator flows: approvals, reports, todos, support suggestions, invoices, and Beszel status.
  - Component tests for status mapping, operational unit rendering, empty states, and conclusion/evidence ordering.
  - Regression tests for auth/session behavior and /api/* proxy usage.
  - Manual acceptance review against the design principle:
      - Critical information appears before secondary metrics.
      - Each page answers what happened, what MARVIN concluded, and what human action is required.
      - Raw data is available but clearly secondary.
      - No generic SaaS-style overview sections remain in V2.

  ## Assumptions And Defaults

  - V2 is built inside the existing dashboard/ app, not as a separate package.
  - The migration allows targeted flow reshaping while preserving one-to-one route coverage.
  - Backend APIs are stable enough that frontend maintainability can be improved without backend rewrites in phase 1.
  - Styling can be replaced or reorganized substantially for V2, including introducing a V2-specific global/theme layer.
  - Old V1 and new V2 can coexist temporarily in the same codebase during migration.
