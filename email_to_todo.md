# MARVIN Email-to-Todo Capture Requirements

## 1. Feature summary

Build an **Email-to-Todo Capture** feature for MARVIN.

The user manages multiple email accounts. Instead of connecting every mailbox to MARVIN, the user will manually forward important emails to a dedicated address such as:

```text
marvin@vitbhopal.dev
```

MARVIN should receive the forwarded email, extract the actionable task, create a todo item, store the raw email context, and send an authenticated ntfy notification confirming capture.

Cloudflare Email Routing / Email Workers should be used for inbound email processing because the domain is already on Cloudflare. Cloudflare supports processing incoming routed email with Workers using an `email()` handler. ([Cloudflare Docs][1])

---

# 2. Goals

## Primary goals

1. Receive forwarded emails sent to `marvin@vitbhopal.dev`.
2. Parse the email subject, sender, body, forwarded content, and metadata.
3. Extract a todo task using deterministic rules plus optional LLM classification.
4. Create a todo in MARVIN.
5. Send an ntfy notification after successful task creation.
6. Preserve raw email content for later reference.
7. Prevent spam, unauthorized use, and duplicate task creation.

## Non-goals for v1

Do **not** build:

1. Full Gmail / Workspace OAuth integration.
2. Full email client UI.
3. Auto-reading all inboxes.
4. Automated email replies to the original sender.
5. Complex multi-agent workflows.

This is a capture pipeline, not another inbox pretending to be productivity.

---

# 3. High-level architecture

```text
User forwards email
        ↓
marvin@vitbhopal.dev
        ↓
Cloudflare Email Routing
        ↓
Cloudflare Email Worker
        ↓
POST to MARVIN backend webhook
        ↓
Verify shared secret / signature
        ↓
Store raw email
        ↓
Parse and extract task
        ↓
LLM task classification, if enabled
        ↓
Create todo in database
        ↓
Send ntfy notification
        ↓
Show task in MARVIN dashboard inbox
```

---

# 4. Recommended addresses

Implement support for the main address first:

```text
marvin@vitbhopal.dev
```

Also support plus-address routing if Cloudflare route handling allows it in the configured setup:

```text
marvin+todo@vitbhopal.dev
marvin+urgent@vitbhopal.dev
marvin+waiting@vitbhopal.dev
marvin+vityarthi@vitbhopal.dev
marvin+vitbhopal@vitbhopal.dev
marvin+recruitment@vitbhopal.dev
marvin+personal@vitbhopal.dev
```

Address meaning:

| Address                            | Meaning                      |
| ---------------------------------- | ---------------------------- |
| `marvin@vitbhopal.dev`             | Default task inbox           |
| `marvin+urgent@vitbhopal.dev`      | High-priority task           |
| `marvin+waiting@vitbhopal.dev`     | Follow-up / waiting-for task |
| `marvin+vityarthi@vitbhopal.dev`   | VITyarthi project            |
| `marvin+vitbhopal@vitbhopal.dev`   | VIT Bhopal project           |
| `marvin+recruitment@vitbhopal.dev` | Recruitment-related task     |
| `marvin+personal@vitbhopal.dev`    | Personal task                |

If plus addressing is inconvenient, use separate addresses instead:

```text
marvin-urgent@vitbhopal.dev
marvin-vityarthi@vitbhopal.dev
marvin-recruitment@vitbhopal.dev
```

---

# 5. Cloudflare Email Worker requirements

Cloudflare Email Workers can process inbound email and perform custom logic such as forwarding, replying, rejecting, or processing email programmatically. ([Cloudflare Docs][2])

## Worker responsibilities

The Cloudflare Worker should:

1. Receive incoming email using the `email(message, env, ctx)` handler.
2. Extract:

   * `message.from`
   * `message.to`
   * `message.headers`
   * subject
   * message ID
   * date
   * raw email body if available
3. Reject or ignore emails from unauthorized senders.
4. Send the email payload to the MARVIN backend webhook.
5. Avoid doing heavy LLM processing inside the Worker.
6. Return a successful processing result only after the MARVIN backend accepts the payload.

## Important design choice

The Worker should be thin.

It should **not** contain the todo logic. It should only receive the email and forward the structured/raw payload to MARVIN.

Reason: Cloudflare Worker runtime is not the right place for your MARVIN business logic, database writes, LLM calls, retry-heavy processing, and existential disappointment.

---

# 6. MARVIN backend webhook

Create a backend endpoint:

```http
POST /api/marvin/email-capture
```

## Authentication

The Cloudflare Worker must send a shared secret header:

```http
X-Marvin-Email-Secret: <secret>
```

The backend must reject requests without the correct secret.

Use environment variables:

```env
MARVIN_EMAIL_CAPTURE_SECRET=
```

## Request payload

The Cloudflare Worker should send JSON like this:

```json
{
  "from": "ravi@example.com",
  "to": "marvin+vityarthi@vitbhopal.dev",
  "subject": "Fwd: Pending LMS payment issue",
  "messageId": "<abc@example.com>",
  "date": "2026-06-16T10:30:00+05:30",
  "headers": {
    "content-type": "text/plain"
  },
  "textBody": "Forwarded email text...",
  "htmlBody": "<p>Forwarded email html...</p>",
  "rawEmail": "full raw email if available",
  "attachments": []
}
```

## Response

On success:

```json
{
  "success": true,
  "taskId": "task_123",
  "title": "Follow up on pending LMS payment issue",
  "priority": "medium",
  "project": "vityarthi"
}
```

On failure:

```json
{
  "success": false,
  "error": "Unauthorized sender"
}
```

---

# 7. Authorization rules

Only allow emails forwarded by known sender addresses.

Create config:

```env
MARVIN_ALLOWED_FORWARDERS=ravi@vitbhopal.ac.in,ravi.pm@vitbhopal.ac.in,ravi.recruitment@vitbhopal.ac.in,ravi@vityarthi.com,personal@example.com
```

The system should check the outer sender first.

For forwarded emails, the original sender may be different. That is okay. The allowed check should be based on who forwarded the email to MARVIN, not who originally sent it.

## Unauthorized email behavior

If sender is unauthorized:

1. Do not create todo.
2. Store minimal security log.
3. Send optional ntfy warning only if repeated suspicious attempts happen.
4. Do not expose internal error details.

---

# 8. Todo extraction requirements

The system should extract:

```json
{
  "title": "Short actionable task title",
  "description": "Useful context from the email",
  "project": "vitbhopal | vityarthi | recruitment | personal | unknown",
  "priority": "low | medium | high | urgent",
  "status": "inbox",
  "dueDate": "nullable ISO date",
  "source": "email",
  "sourceEmailFrom": "original sender if detected",
  "forwardedBy": "user email that forwarded it",
  "sourceSubject": "original email subject",
  "rawEmailId": "stored raw email reference",
  "tags": ["email", "follow-up"]
}
```

## Task title rules

The title should be action-oriented.

Good:

```text
Follow up with vendor about revised quotation
Review student payment issue for VITyarthi
Send recruitment profile feedback to HR
Check LMS certificate issue reported by student
```

Bad:

```text
Fwd: Reminder
Email task
Important
Please check
```

Because obviously what the world needs is another todo titled “Important”.

---

# 9. LLM extraction

Use an LLM to classify and summarize the forwarded email.

## Input to LLM

Pass:

1. Forwarder email.
2. Recipient alias.
3. Subject.
4. Cleaned text body.
5. Detected forwarded block.
6. Any user-added note before forwarded content.

## Output from LLM must be strict JSON

Example:

```json
{
  "title": "Follow up with admissions team about pending student payment issue",
  "description": "The forwarded email mentions a student whose payment is not reflecting in the LMS. Check payment history and update the student.",
  "project": "vityarthi",
  "priority": "medium",
  "dueDate": null,
  "taskType": "follow_up",
  "people": ["Admissions team"],
  "entities": ["LMS", "payment history"],
  "confidence": 0.86
}
```

## Required validation

Do not trust the LLM blindly.

Validate:

1. JSON is parseable.
2. Title is present.
3. Priority is one of allowed values.
4. Project is one of allowed values.
5. Due date is either null or valid ISO date.
6. Confidence is numeric.

If LLM fails, fallback to deterministic extraction:

```text
Title: Review email: <cleaned subject>
Project: based on recipient alias, else unknown
Priority: medium
Status: inbox
```

---

# 10. User-added notes

Support this forwarding style:

```text
Please add this for tomorrow. Need to call them before lunch.

---------- Forwarded message ---------
From: ...
Subject: ...
...
```

MARVIN should treat text before the forwarded block as the user instruction.

Examples:

```text
do tomorrow
urgent
add to recruitment
remind me next week
waiting for their reply
```

These instructions should override LLM guesses where reasonable.

---

# 11. Due date parsing

Support common date phrases in the user note and email body:

```text
tomorrow
today
next week
Monday
Friday
before lunch
by EOD
after 3 days
```

Use the server timezone:

```text
Asia/Kolkata
```

Store due dates as ISO timestamps.

For vague dates:

| Phrase         | Behavior                         |
| -------------- | -------------------------------- |
| `tomorrow`     | Next calendar day, 09:00         |
| `today`        | Same day, 18:00 if no time given |
| `next week`    | Next Monday, 09:00               |
| `by EOD`       | Same day, 18:00                  |
| `before lunch` | Same day or due date day, 12:00  |

---

# 12. Priority rules

Priority should be determined in this order:

1. Recipient alias, e.g. `marvin+urgent`.
2. User note, e.g. “urgent”, “today”, “critical”.
3. Email content.
4. Default priority: `medium`.

Priority enum:

```text
low
medium
high
urgent
```

Examples:

```text
marvin+urgent@vitbhopal.dev → urgent
"Need this today" → high
"Whenever possible" → low
No hint → medium
```

---

# 13. Project classification

Project should be determined in this order:

1. Recipient alias.
2. User note.
3. Sender/domain.
4. LLM classification.
5. Default: `unknown`.

Project enum:

```text
vitbhopal
vityarthi
recruitment
personal
unknown
```

Examples:

```text
marvin+vityarthi@vitbhopal.dev → vityarthi
Subject contains LMS / course / student / certificate → vityarthi
Subject contains candidate / interview / hiring → recruitment
Sender is from vitbhopal.ac.in → vitbhopal
```

---

# 14. Duplicate detection

Prevent duplicate todos.

Use these signals:

1. Email `messageId`.
2. Hash of normalized subject + normalized body + forwarder.
3. Same sender + same subject within 24 hours.

If duplicate is detected:

1. Do not create a new todo.
2. Add a note to the existing task if useful.
3. Send ntfy notification:

```text
Duplicate ignored: Follow up with vendor about quotation
```

---

# 15. Raw email storage

Store raw email for audit/reference.

Options:

1. Database text column for v1.
2. Filesystem storage under `/data/marvin/email-capture/`.
3. S3/R2-compatible object storage later.

Recommended v1 path:

```text
/data/marvin/email-capture/YYYY/MM/DD/<email_capture_id>.eml
```

Store metadata in DB.

---

# 16. Database schema

## Table: `email_captures`

```sql
CREATE TABLE email_captures (
  id UUID PRIMARY KEY,
  message_id TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  received_at TIMESTAMP NOT NULL,
  raw_email_path TEXT,
  text_body TEXT,
  html_body TEXT,
  body_hash TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  created_task_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Table: `todos`

If todo table already exists, add source fields if missing.

```sql
ALTER TABLE todos ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE todos ADD COLUMN source_ref_id UUID NULL;
ALTER TABLE todos ADD COLUMN project TEXT DEFAULT 'unknown';
ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium';
ALTER TABLE todos ADD COLUMN due_at TIMESTAMP NULL;
ALTER TABLE todos ADD COLUMN raw_context TEXT NULL;
```

Expected todo status for newly captured email tasks:

```text
inbox
```

Do not immediately put them into “active”. Email capture is inbox triage, not divine commandment.

---

# 17. ntfy notification requirements

Use authenticated ntfy publishing.

ntfy supports publishing with HTTP `PUT` or `POST`, and protected topics can use Basic Auth or token-based auth depending on server configuration. ([Ntfy][3])

## Environment variables

```env
NTFY_BASE_URL=https://ntfy.vitbhopal.dev
NTFY_TOPIC=marvin-todos
NTFY_USERNAME=
NTFY_PASSWORD=
# optional alternative
NTFY_ACCESS_TOKEN=
```

## Notification on task created

Send:

```text
📥 MARVIN captured an email task

Task: Follow up with vendor about revised quotation
Project: vitbhopal
Priority: medium
Due: tomorrow 09:00
```

## Notification headers

Use ntfy headers where supported:

```http
Title: MARVIN Email Capture
Priority: 3
Tags: email,inbox
Authorization: Basic <base64(username:password)>
```

For urgent tasks:

```http
Priority: 5
Tags: warning,email
```

## Notification failure behavior

If ntfy fails:

1. Task creation should still succeed.
2. Log notification failure.
3. Mark `notification_status = failed` if such field exists.
4. Do not retry forever like a haunted cron job.

---

# 18. Dashboard requirements

Add a page:

```text
/email-captures
```

Show:

1. Received time.
2. Forwarder.
3. Subject.
4. Extracted task title.
5. Project.
6. Priority.
7. Due date.
8. Status:

   * received
   * parsed
   * task_created
   * duplicate
   * failed
9. Link to created todo.
10. Raw email preview.

Add todo inbox view filters:

```text
source = email
project
priority
due date
unreviewed
```

---

# 19. Todo review behavior

Every email-created todo should start as:

```text
status = inbox
reviewed = false
```

User actions:

1. Accept task.
2. Edit task.
3. Snooze task.
4. Mark done.
5. Delete task.
6. Link task to existing project.
7. Convert task to “waiting for”.

---

# 20. Attachments

v1 behavior:

1. Detect attachments.
2. Store attachment metadata.
3. Do not process large attachments.
4. Do not send attachments to LLM.
5. Show attachment names in task description.

Attachment metadata:

```json
[
  {
    "filename": "quotation.pdf",
    "contentType": "application/pdf",
    "size": 123456,
    "storedPath": "/data/marvin/email-capture/attachments/..."
  }
]
```

Limit:

```env
MAX_EMAIL_ATTACHMENT_SIZE_MB=10
MAX_TOTAL_EMAIL_SIZE_MB=20
```

---

# 21. Security requirements

## Required

1. Only accept webhook calls with valid shared secret.
2. Only process emails from allowed forwarders.
3. Sanitize HTML before displaying in dashboard.
4. Do not execute links/scripts from email HTML.
5. Do not expose raw email publicly.
6. Do not send raw email to ntfy.
7. Do not send attachments to LLM in v1.
8. Log all rejected senders.
9. Rate-limit the webhook.
10. Store secrets only in environment variables.

## Rate limits

Suggested:

```text
Max 60 emails/hour total
Max 20 emails/hour per forwarder
Max 5 failed auth attempts/minute
```

---

# 22. Error handling

## Failure cases

| Case                        | Behavior                                               |
| --------------------------- | ------------------------------------------------------ |
| Unauthorized sender         | Reject / ignore, log security event                    |
| LLM failure                 | Create fallback todo                                   |
| DB failure                  | Store failed capture log if possible                   |
| ntfy failure                | Task remains created, log notification error           |
| Duplicate email             | Do not create new task                                 |
| Oversized email             | Store metadata, create task saying email was too large |
| Invalid payload from Worker | Return 400                                             |

---

# 23. Logging

Log structured events:

```json
{
  "event": "email_capture_task_created",
  "emailCaptureId": "...",
  "taskId": "...",
  "from": "ravi@example.com",
  "to": "marvin@vitbhopal.dev",
  "project": "vityarthi",
  "priority": "medium"
}
```

Important events:

```text
email_received
email_rejected_unauthorized
email_duplicate_detected
email_parse_failed
llm_extract_failed
task_created
ntfy_sent
ntfy_failed
```

---

# 24. Environment variables

```env
# Email capture
MARVIN_EMAIL_CAPTURE_SECRET=
MARVIN_ALLOWED_FORWARDERS=
MARVIN_EMAIL_STORAGE_PATH=/data/marvin/email-capture

# App
APP_BASE_URL=https://tasks.vitbhopal.dev
APP_TIMEZONE=Asia/Kolkata

# LLM
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
LLM_EMAIL_CAPTURE_ENABLED=true

# ntfy
NTFY_BASE_URL=https://ntfy.vitbhopal.dev
NTFY_TOPIC=marvin-todos
NTFY_USERNAME=
NTFY_PASSWORD=
NTFY_ACCESS_TOKEN=

# Limits
MAX_EMAIL_ATTACHMENT_SIZE_MB=10
MAX_TOTAL_EMAIL_SIZE_MB=20
EMAIL_CAPTURE_RATE_LIMIT_PER_HOUR=60
```

---

# 25. Suggested folder structure

```text
marvin/
  apps/
    dashboard/
      app/
        email-captures/
        api/
          marvin/
            email-capture/
              route.ts
  workers/
    cloudflare-email-worker/
      src/
        index.ts
      wrangler.toml
  packages/
    email-capture/
      parser.ts
      extractor.ts
      duplicate.ts
      ntfy.ts
      storage.ts
      types.ts
  prisma/
    schema.prisma
```

Adjust for your actual stack. The structure matters less than not turning this into a bowl of spaghetti with a webhook.

---

# 26. Cloudflare Worker pseudocode

```ts
export default {
  async email(message, env, ctx) {
    const payload = {
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject"),
      messageId: message.headers.get("message-id"),
      date: message.headers.get("date"),
      headers: Object.fromEntries(message.headers),
      // Implement raw/text extraction depending on available runtime APIs
    };

    const response = await fetch(`${env.MARVIN_API_BASE_URL}/api/marvin/email-capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Marvin-Email-Secret": env.MARVIN_EMAIL_CAPTURE_SECRET
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      message.setReject("MARVIN failed to capture this email.");
      return;
    }
  }
};
```

---

# 27. Backend extraction pseudocode

```ts
async function handleEmailCapture(payload) {
  verifySecret();

  if (!isAllowedForwarder(payload.from)) {
    await logSecurityEvent(payload);
    throw new Error("Unauthorized sender");
  }

  const bodyHash = hash(normalize(payload.subject + payload.textBody));

  const duplicate = await findDuplicate(payload.messageId, bodyHash);

  if (duplicate) {
    await notifyDuplicate(duplicate);
    return duplicate;
  }

  const emailCapture = await storeEmailCapture(payload, bodyHash);

  const deterministicHints = extractHintsFromAddressAndUserNote(payload);

  let extractedTask;

  try {
    extractedTask = await extractTaskWithLLM(payload, deterministicHints);
  } catch {
    extractedTask = fallbackTask(payload, deterministicHints);
  }

  const task = await createTodo({
    ...extractedTask,
    source: "email",
    sourceRefId: emailCapture.id,
    status: "inbox",
    reviewed: false
  });

  await markCaptureTaskCreated(emailCapture.id, task.id);

  await sendNtfyNotification(task);

  return task;
}
```

---

# 28. Acceptance criteria

The feature is complete when:

1. Sending an email to `marvin@vitbhopal.dev` creates a todo.
2. Forwarding from an unauthorized sender does not create a todo.
3. `marvin+urgent@vitbhopal.dev` creates an urgent task.
4. A forwarded email with “do tomorrow” sets due date to tomorrow.
5. Duplicate forwarded emails do not create duplicate todos.
6. ntfy notification is sent after successful task creation.
7. ntfy failure does not prevent todo creation.
8. Raw email content is stored and viewable from dashboard.
9. Email-created todos appear in the todo inbox as unreviewed.
10. The dashboard shows email capture logs.
11. LLM failure falls back to a basic task.
12. Secrets are not hardcoded.

---

# 29. Testing scenarios

## Test 1: Normal forwarded email

Input:

```text
To: marvin@vitbhopal.dev
Subject: Fwd: Pending invoice approval
Body: Forwarded email about invoice approval
```

Expected:

```text
Todo created
Project: unknown or vitbhopal
Priority: medium
Status: inbox
ntfy sent
```

## Test 2: Urgent alias

```text
To: marvin+urgent@vitbhopal.dev
```

Expected:

```text
Priority: urgent
ntfy priority high
```

## Test 3: User note

```text
Please do this tomorrow before lunch.

---------- Forwarded message ---------
...
```

Expected:

```text
Due date: tomorrow 12:00
Description includes user note
```

## Test 4: Unauthorized sender

Expected:

```text
No todo created
Security event logged
```

## Test 5: Duplicate email

Expected:

```text
No second todo
Duplicate logged
Optional ntfy duplicate notification
```

---

# 30. Recommended v1 build order

Build in this order:

1. Backend webhook with mock payload.
2. Todo creation from mock email.
3. ntfy notification.
4. Cloudflare Email Worker.
5. Allowed forwarder validation.
6. Raw email storage.
7. LLM extraction.
8. Duplicate detection.
9. Dashboard email capture page.
10. Plus-address project/priority routing.

This keeps the blast radius small. Which is apparently necessary, because one stuck cron already tried to financially assassinate you.

Final instruction to the code generator:

```text
Implement the MARVIN Email-to-Todo Capture feature exactly as described. Prioritize reliability, simple architecture, explicit logs, and graceful fallback. Do not build full mailbox OAuth integration. Do not make the Cloudflare Worker responsible for business logic. The Worker should only receive email and forward it securely to the MARVIN backend.
```

[1]: https://developers.cloudflare.com/email-routing/email-workers/?utm_source=chatgpt.com "Email Workers · Cloudflare Email Routing docs"
[2]: https://developers.cloudflare.com/email-service/api/route-emails/email-handler/?utm_source=chatgpt.com "Workers API - Email Service"
[3]: https://docs.ntfy.sh/publish/?utm_source=chatgpt.com "Sending messages - ntfy"

