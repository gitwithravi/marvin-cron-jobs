For **MARVIN dashboard**, the UI design guiding principle should be:

# “Command Center, Not Admin Panel”

The dashboard should feel like a **private operations console for a tired but brilliant assistant**, not a generic SaaS CRUD dashboard. Every screen should answer:

> “What needs Ravi’s attention, what has MARVIN already handled, and what decision is required next?”

Not “here are 47 tables because humanity apparently deserved Laravel Nova.”

---

## Core UI Principle

```md
MARVIN Dashboard UI Principle:

Design the dashboard as a calm, high-signal command center for operational awareness and decision-making.

The UI must prioritize clarity, urgency, and trust over decoration. It should show what MARVIN observed, what it concluded, what action it recommends, and what needs human approval.

Avoid generic SaaS dashboard patterns, excessive cards, decorative charts, and noisy metrics. Every element must help answer one of these questions:

1. Is something broken?
2. Is something getting worse?
3. What did MARVIN do?
4. What does MARVIN need from me?
5. Can I trust the conclusion?

The interface should feel technical, quiet, slightly sardonic, and purpose-built for a single operator.
```

---

## Visual Direction

Use a **dark, terminal-adjacent interface**, but not a hacker cosplay nightmare.

Think:

```md
Visual Style:

- Dark background
- Muted contrast
- Monospace or semi-monospace accents
- Sparse use of color
- Status colors only when meaningful
- Dense but readable layouts
- Markdown-first content rendering
- Log-like history where appropriate
- Cards only when they summarize meaningful state
```

Avoid:

```md
- Gradient-heavy SaaS UI
- Random colorful analytics charts
- Excessive rounded cards
- Marketing dashboard aesthetics
- “AI assistant” bubbly chatbot UI
- Animated nonsense unless it communicates state
```

---

## Information Hierarchy

The dashboard should be built around **attention**, not navigation.

Recommended order:

```md
1. Critical alerts
2. Pending approvals
3. Latest MARVIN conclusions
4. Scheduled task status
5. System/service health
6. Historical logs
7. Configuration
```

The homepage should not be “welcome back, Ravi.”

It should be:

```md
Nothing is on fire.
3 systems checked.
1 task needs approval.
2 humans continue to be bottlenecks.
```

Much better.

---

## Dashboard Layout Principle

```md
Each dashboard card must represent one operational unit:
- Website check
- Server check
- PR review
- Team status
- Invoice summary
- Support ticket drafting
- Email-to-todo parser
- LMS action
```

Each card should show:

```md
- Status
- Last run time
- Last conclusion
- Confidence / evidence
- Next scheduled run
- Action button if needed
```

Example:

```md
Website Monitor
Status: Degraded
Last checked: 14 min ago
Finding: admissions site responded in 4.8s, above threshold
Evidence: HTTP 200, TTFB 3.9s, cache MISS
Action: View run log
```

---

## LLM-Specific UI Generation Rules

Give this directly to the code generator:

```md
When generating MARVIN dashboard UI:

- Do not create a generic admin dashboard.
- Do not create fake analytics unless backed by real data.
- Prefer text summaries over charts.
- Prefer timelines, logs, status cards, and approval panels.
- Show MARVIN’s conclusion before raw data.
- Raw data should be available, but secondary.
- Every automated action must show evidence and confidence.
- Every destructive or external action must require approval.
- Use sardonic microcopy sparingly, never at the cost of clarity.
- The UI should look like a serious internal tool with a dry sense of humor, not a comedy app.
```

---

## Design Personality

MARVIN should have personality, but the UI should not become irritating.

Use this rule:

```md
Personality appears in:
- Empty states
- Status summaries
- Small helper text
- Completed task messages
- Non-critical labels

Personality must not appear in:
- Error details
- Approval confirmations
- Security-sensitive actions
- Financial summaries
- Anything requiring legal, operational, or HR precision
```

Example good:

```md
No pending approvals.
A rare moment of peace. Don’t get attached.
```

Example bad:

```md
Delete production database?
Humanity was a mistake. Proceed?
```

No. Funny, but also how incidents are born.

---

## Status Language

Use status labels that feel MARVIN-like but remain clear.

```md
Healthy       → Nothing is on fire
Warning       → Mildly concerning
Critical      → On fire
Failed        → Predictably broken
Pending       → Awaiting human ceremony
Running       → Thinking, tragically
Approved      → Human approved
Rejected      → Human showed restraint
```

But internally, keep real status enums:

```ts
"healthy" | "warning" | "critical" | "failed" | "pending" | "running" | "approved" | "rejected"
```

The UI can display personality labels, but the system should remain boring and reliable underneath. As all good systems are. Tragically.

---

## Best One-Line Principle

Use this as the north star:

```md
MARVIN dashboard should be a quiet command center where automation explains itself, asks for approval when needed, and highlights only what deserves attention.
```

Or the more MARVIN version:

```md
A calm operations console for seeing what broke, what MARVIN judged, and which human decision is unfortunately still required.
```

That is the guiding principle I would put at the top of your UI design document.

