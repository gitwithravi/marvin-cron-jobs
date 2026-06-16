import email
import email.policy
import hashlib
import imaplib
import json
import os
import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from zoneinfo import ZoneInfo

from marvin_core.db import connect, migrate
from marvin_core.env import load_root_env, require_env
from marvin_core.notifications.ntfy import NtfyNotificationError, send_ntfy_message
from marvin_core.openrouter import OpenRouterClient
from marvin_core.paths import project_path
from marvin_core.todos import create_tag, create_todo, parse_natural_due_date


DATABASE_PATH = "data/marvin.sqlite3"
PROJECTS = {"vitbhopal", "vityarthi", "recruitment", "personal", "unknown"}
PRIORITIES = {"low", "medium", "high", "urgent"}
ALIAS_PROJECTS = {
    "vityarthi": "vityarthi",
    "vitbhopal": "vitbhopal",
    "recruitment": "recruitment",
    "personal": "personal",
}
PROJECT_TAG_NAMES = {
    "vitbhopal": "VIT Bhopal",
    "vityarthi": "VITyarthi",
    "recruitment": "Recruitment",
    "personal": "Personal",
}
FORWARDED_MARKERS = (
    "---------- forwarded message ---------",
    "-----original message-----",
    "begin forwarded message:",
)


class EmailCaptureError(RuntimeError):
    status_code = 400


class EmailCaptureUnauthorized(EmailCaptureError):
    status_code = 403


class EmailCaptureRateLimited(EmailCaptureError):
    status_code = 429


class EmailCaptureInvalidPayload(EmailCaptureError):
    status_code = 400


@dataclass(frozen=True)
class EmailCapturePayload:
    from_email: str
    to_email: str
    subject: str | None
    message_id: str | None
    date: str | None
    headers: dict[str, Any]
    text_body: str | None
    html_body: str | None
    raw_email: str | None
    attachments: list[dict[str, Any]]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    conn = connect(DATABASE_PATH)
    migrate(conn)
    return conn


def _normalize_email(value: str | None) -> str:
    if not value:
        return ""
    match = re.search(r"<([^>]+)>", value)
    email = match.group(1) if match else value
    return email.strip().lower()


def _allowed_forwarders() -> set[str]:
    return {
        _normalize_email(item)
        for item in os.getenv("MARVIN_ALLOWED_FORWARDERS", "").split(",")
        if item.strip()
    }


def is_allowed_forwarder(from_email: str) -> bool:
    allowed = _allowed_forwarders()
    return bool(allowed) and _normalize_email(from_email) in allowed


def parse_payload(data: dict[str, Any]) -> EmailCapturePayload:
    from_email = _normalize_email(str(data.get("from") or data.get("from_email") or ""))
    to_email = _normalize_email(str(data.get("to") or data.get("to_email") or ""))
    if not from_email:
        raise EmailCaptureInvalidPayload("Email sender is required.")
    if not to_email:
        raise EmailCaptureInvalidPayload("Email recipient is required.")

    headers = data.get("headers") or {}
    if not isinstance(headers, dict):
        headers = {}
    attachments = data.get("attachments") or []
    if not isinstance(attachments, list):
        attachments = []

    return EmailCapturePayload(
        from_email=from_email,
        to_email=to_email,
        subject=str(data.get("subject") or "").strip() or None,
        message_id=str(data.get("messageId") or data.get("message_id") or "").strip() or None,
        date=str(data.get("date") or "").strip() or None,
        headers=headers,
        text_body=str(data.get("textBody") or data.get("text_body") or "").strip() or None,
        html_body=str(data.get("htmlBody") or data.get("html_body") or "").strip() or None,
        raw_email=str(data.get("rawEmail") or data.get("raw_email") or "").strip() or None,
        attachments=[item for item in attachments if isinstance(item, dict)],
    )


def _parse_received_at(value: str | None) -> str:
    if not value:
        return _now()
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return _now()
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def _clean_subject(subject: str | None) -> str:
    value = re.sub(r"^\s*((fwd?|re):\s*)+", "", subject or "", flags=re.I).strip()
    return re.sub(r"\s+", " ", value) or "No subject"


def _normalized_hash(subject: str | None, body: str | None, forwarder: str) -> str:
    source = " ".join([subject or "", body or "", forwarder])
    normalized = re.sub(r"\s+", " ", source.strip().lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _split_user_note(text: str | None) -> tuple[str, str]:
    if not text:
        return "", ""
    lowered = text.lower()
    marker_positions = [lowered.find(marker) for marker in FORWARDED_MARKERS if lowered.find(marker) >= 0]
    if not marker_positions:
        return "", text.strip()
    index = min(marker_positions)
    return text[:index].strip(), text[index:].strip()


def _alias_token(to_email: str) -> str | None:
    local = to_email.split("@", 1)[0]
    if "+" in local:
        return local.split("+", 1)[1].strip().lower() or None
    if "-" in local:
        return local.split("-", 1)[1].strip().lower() or None
    return None


def _project_from_text(text: str, from_email: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ("lms", "course", "student", "certificate", "payment")):
        return "vityarthi"
    if any(word in lowered for word in ("candidate", "interview", "hiring", "recruitment", "profile")):
        return "recruitment"
    if from_email.endswith("@vitbhopal.ac.in"):
        return "vitbhopal"
    return "unknown"


def _priority_from_text(text: str) -> str:
    lowered = text.lower()
    if re.search(r"\b(urgent|critical|asap|immediately)\b", lowered):
        return "urgent"
    if re.search(r"\b(today|eod|before lunch|high priority)\b", lowered):
        return "high"
    if re.search(r"\b(whenever possible|low priority|no rush)\b", lowered):
        return "low"
    return "medium"


def _due_date_from_text(text: str) -> str | None:
    today = datetime.now(ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Kolkata"))).date()
    lowered = text.lower()
    if re.search(r"\bnext week\b", lowered):
        delta = (0 - today.weekday()) % 7
        return (today + timedelta(days=delta or 7)).isoformat()
    after_days = re.search(r"\bafter\s+(\d{1,2})\s+days?\b", lowered)
    if after_days:
        return (today + timedelta(days=int(after_days.group(1)))).isoformat()
    if re.search(r"\beod\b", lowered):
        return today.isoformat()
    weekday = re.search(r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", lowered)
    if weekday and not re.search(r"\bnext\s+", lowered):
        target = {
            "monday": 0,
            "tuesday": 1,
            "wednesday": 2,
            "thursday": 3,
            "friday": 4,
            "saturday": 5,
            "sunday": 6,
        }[weekday.group(1)]
        delta = (target - today.weekday()) % 7
        return (today + timedelta(days=delta or 7)).isoformat()
    parsed = parse_natural_due_date(text, today=today)
    if parsed:
        return parsed
    if re.search(r"\bbefore lunch\b", lowered):
        return today.isoformat()
    return None


def _extract_original_sender(text: str) -> str | None:
    match = re.search(r"^\s*From:\s*(.+)$", text, flags=re.I | re.M)
    return _normalize_email(match.group(1)) if match else None


def deterministic_extract(payload: EmailCapturePayload) -> dict[str, Any]:
    user_note, forwarded_body = _split_user_note(payload.text_body)
    alias = _alias_token(payload.to_email)
    combined = "\n".join(
        part
        for part in (user_note, payload.subject or "", forwarded_body or payload.text_body or "")
        if part
    )
    project = ALIAS_PROJECTS.get(alias or "") or _project_from_text(combined, payload.from_email)
    priority = "urgent" if alias == "urgent" else _priority_from_text(combined)
    if alias == "waiting":
        title_prefix = "Follow up on"
    else:
        title_prefix = "Review"
    due_date = _due_date_from_text(combined)
    subject = _clean_subject(payload.subject)
    return {
        "title": f"{title_prefix} email: {subject}",
        "description": _build_notes(payload, user_note, forwarded_body),
        "project": project,
        "priority": priority,
        "due_date": due_date,
        "task_type": "follow_up" if alias == "waiting" else "email_review",
        "people": [],
        "entities": [],
        "confidence": 0.5,
        "source_email_from": _extract_original_sender(forwarded_body or payload.text_body or ""),
        "user_note": user_note,
    }


def _build_notes(payload: EmailCapturePayload, user_note: str, body: str) -> str:
    lines = [
        f"Forwarded by: {payload.from_email}",
        f"To: {payload.to_email}",
        f"Subject: {_clean_subject(payload.subject)}",
    ]
    original_sender = _extract_original_sender(body)
    if original_sender:
        lines.append(f"Original sender: {original_sender}")
    if user_note:
        lines.extend(["", "User note:", user_note])
    preview = re.sub(r"\s+", " ", body or payload.text_body or "").strip()
    if preview:
        lines.extend(["", "Email context:", preview[:1600]])
    if payload.attachments:
        names = [
            str(item.get("filename") or item.get("name") or "attachment")
            for item in payload.attachments
        ]
        lines.extend(["", f"Attachments: {', '.join(names)}"])
    return "\n".join(lines)


def _validate_extraction(value: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    title = str(value.get("title") or "").strip()
    project = str(value.get("project") or fallback["project"]).strip().lower()
    priority = str(value.get("priority") or fallback["priority"]).strip().lower()
    due_date = value.get("dueDate", value.get("due_date"))
    confidence = value.get("confidence", 0)
    if not title:
        raise ValueError("LLM extraction missing title.")
    if project not in PROJECTS:
        project = fallback["project"]
    if priority not in PRIORITIES:
        priority = fallback["priority"]
    if due_date:
        due_date = datetime.strptime(str(due_date), "%Y-%m-%d").date().isoformat()
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0
    return {
        **fallback,
        "title": re.sub(r"\s+", " ", title),
        "description": str(value.get("description") or fallback["description"]).strip(),
        "project": project,
        "priority": priority,
        "due_date": due_date or fallback.get("due_date"),
        "task_type": str(value.get("taskType") or value.get("task_type") or fallback["task_type"]),
        "people": value.get("people") if isinstance(value.get("people"), list) else [],
        "entities": value.get("entities") if isinstance(value.get("entities"), list) else [],
        "confidence": confidence,
    }


def extract_with_llm(payload: EmailCapturePayload, fallback: dict[str, Any]) -> dict[str, Any]:
    if os.getenv("LLM_EMAIL_CAPTURE_ENABLED", "true").lower() not in {"1", "true", "yes"}:
        return fallback
    load_root_env()
    client = OpenRouterClient(require_env("OPENROUTER_API_KEY"), timeout_seconds=45)
    model = os.getenv("LLM_EMAIL_CAPTURE_MODEL", os.getenv("TODO_CLASSIFIER_MODEL", os.getenv("MARVIN_CHAT_MODEL", "google/gemini-2.5-flash")))
    user_note, forwarded_body = _split_user_note(payload.text_body)
    response = client.chat_json(
        model=model,
        temperature=0.1,
        max_tokens=700,
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract one actionable todo from a forwarded email. Return strict JSON with "
                    "title, description, project, priority, dueDate, taskType, people, entities, confidence. "
                    "Allowed projects: vitbhopal, vityarthi, recruitment, personal, unknown. "
                    "Allowed priorities: low, medium, high, urgent. dueDate must be YYYY-MM-DD or null."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "forwardedBy": payload.from_email,
                        "to": payload.to_email,
                        "subject": payload.subject,
                        "userNote": user_note,
                        "forwardedBody": forwarded_body,
                        "fallbackHints": fallback,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    )
    return _validate_extraction(response, fallback)


def _write_raw_email(capture_id: str, payload: EmailCapturePayload, received_at: str) -> str | None:
    if not payload.raw_email:
        return None
    parsed = datetime.fromisoformat(received_at)
    base = project_path(os.getenv("MARVIN_EMAIL_STORAGE_PATH", "data/marvin/email-capture"))
    path = base / f"{parsed.year:04d}" / f"{parsed.month:02d}" / f"{parsed.day:02d}" / f"{capture_id}.eml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload.raw_email, encoding="utf-8")
    try:
        return str(path.relative_to(project_path(".")))
    except ValueError:
        return str(path)


def _check_rate_limits(conn: sqlite3.Connection, from_email: str) -> None:
    total_limit = int(os.getenv("EMAIL_CAPTURE_RATE_LIMIT_PER_HOUR", "60"))
    forwarder_limit = int(os.getenv("EMAIL_CAPTURE_RATE_LIMIT_PER_FORWARDER_HOUR", "20"))
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    total = conn.execute(
        "SELECT COUNT(*) FROM email_captures WHERE created_at >= ?",
        (cutoff,),
    ).fetchone()[0]
    if total >= total_limit:
        raise EmailCaptureRateLimited("Email capture rate limit exceeded.")
    forwarder_total = conn.execute(
        "SELECT COUNT(*) FROM email_captures WHERE from_email = ? AND created_at >= ?",
        (from_email, cutoff),
    ).fetchone()[0]
    if forwarder_total >= forwarder_limit:
        raise EmailCaptureRateLimited("Email capture forwarder rate limit exceeded.")


def _insert_event(conn: sqlite3.Connection, capture_id: str | None, event_name: str, event: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO email_capture_events (email_capture_id, event_name, event_json, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (capture_id, event_name, json.dumps(event, sort_keys=True, default=str), _now()),
    )


def _find_duplicate(
    conn: sqlite3.Connection,
    payload: EmailCapturePayload,
    body_hash: str,
    received_at: str,
) -> sqlite3.Row | None:
    if payload.message_id:
        row = conn.execute(
            """
            SELECT * FROM email_captures
            WHERE message_id = ? AND created_task_id IS NOT NULL
            ORDER BY created_at DESC LIMIT 1
            """,
            (payload.message_id,),
        ).fetchone()
        if row:
            return row
    row = conn.execute(
        """
        SELECT * FROM email_captures
        WHERE body_hash = ? AND created_task_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
        """,
        (body_hash,),
    ).fetchone()
    if row:
        return row
    cutoff = (datetime.fromisoformat(received_at) - timedelta(hours=24)).isoformat()
    return conn.execute(
        """
        SELECT * FROM email_captures
        WHERE from_email = ? AND subject = ? AND received_at >= ? AND created_task_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
        """,
        (payload.from_email, payload.subject, cutoff),
    ).fetchone()


def _capture_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "messageId": row["message_id"],
        "from": row["from_email"],
        "to": row["to_email"],
        "subject": row["subject"],
        "receivedAt": row["received_at"],
        "rawEmailPath": row["raw_email_path"],
        "textBody": row["text_body"],
        "htmlBody": row["html_body"],
        "status": row["status"],
        "errorMessage": row["error_message"],
        "createdTaskId": row["created_task_id"],
        "notificationStatus": row["notification_status"],
        "notificationError": row["notification_error"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _tag_ids_for_capture(project: str) -> list[int]:
    email_tag = create_tag("Email", "Todos captured from forwarded email.")
    tag_ids = [int(email_tag["id"])]
    if project in PROJECT_TAG_NAMES:
        project_tag = create_tag(PROJECT_TAG_NAMES[project])
        tag_ids.append(int(project_tag["id"]))
    return tag_ids


def _send_capture_notification(todo: dict[str, Any], duplicate: bool = False) -> tuple[str, str | None]:
    prefix = "Duplicate ignored" if duplicate else "MARVIN captured an email task"
    lines = [
        prefix,
        "",
        f"Task: {todo['title']}",
        f"Project: {todo.get('project') or 'unknown'}",
        f"Priority: {todo['priority']}",
    ]
    if todo.get("due_date"):
        lines.append(f"Due: {todo['due_date']}")
    try:
        send_ntfy_message(
            "\n".join(lines),
            priority=5 if todo["priority"] == "urgent" else 3,
            tags=["warning", "email"] if todo["priority"] == "urgent" else ["email", "inbox"],
        )
        return "sent", None
    except (NtfyNotificationError, RuntimeError) as exc:
        return "failed", str(exc)


def _parse_email_bytes(raw_bytes: bytes) -> dict[str, Any]:
    msg = email.message_from_bytes(raw_bytes, policy=email.policy.default)
    text_body = None
    html_body = None
    attachments: list[dict[str, Any]] = []
    for part in msg.walk():
        content_type = part.get_content_type()
        disposition = str(part.get_content_disposition() or "")
        if "attachment" in disposition:
            filename = part.get_filename() or "attachment"
            attachments.append({"filename": filename, "content_type": content_type})
        elif content_type == "text/plain" and text_body is None:
            try:
                text_body = part.get_content()
            except Exception:
                text_body = None
        elif content_type == "text/html" and html_body is None:
            try:
                html_body = part.get_content()
            except Exception:
                html_body = None
    raw_email = raw_bytes.decode("utf-8", errors="replace")
    return {
        "from": str(msg.get("From") or ""),
        "to": str(msg.get("To") or ""),
        "subject": str(msg.get("Subject") or ""),
        "messageId": str(msg.get("Message-ID") or ""),
        "date": str(msg.get("Date") or ""),
        "headers": dict(msg.items()),
        "textBody": text_body,
        "htmlBody": html_body,
        "rawEmail": raw_email,
        "attachments": attachments,
    }


def fetch_imap_emails(
    host: str,
    username: str,
    password: str,
    port: int = 993,
    folder: str = "INBOX",
    mark_read: bool = True,
) -> list[dict[str, Any]]:
    conn = imaplib.IMAP4_SSL(host, port)
    try:
        conn.login(username, password)
        conn.select(folder)
        status, messages = conn.search(None, "UNSEEN")
        if status != "OK":
            return []
        results: list[dict[str, Any]] = []
        for num in messages[0].split():
            fetch_status, data = conn.fetch(num, "(RFC822)")
            if fetch_status != "OK" or not data or not data[0]:
                continue
            raw_bytes = data[0][1]
            if not isinstance(raw_bytes, bytes):
                continue
            payload = _parse_email_bytes(raw_bytes)
            results.append(payload)
            if mark_read:
                conn.store(num, "+FLAGS", "\\Seen")
        return results
    finally:
        try:
            conn.logout()
        except Exception:
            pass


def process_imap_emails(
    host: str,
    username: str,
    password: str,
    port: int = 993,
    folder: str = "INBOX",
    mark_read: bool = True,
) -> list[dict[str, Any]]:
    emails = fetch_imap_emails(host, username, password, port, folder, mark_read)
    results: list[dict[str, Any]] = []
    for email_data in emails:
        try:
            result = process_email_capture(email_data)
            results.append(result)
        except EmailCaptureError as e:
            results.append(
                {
                    "success": False,
                    "error": str(e),
                    "from": email_data.get("from"),
                    "subject": email_data.get("subject"),
                }
            )
    return results



def process_email_capture(data: dict[str, Any]) -> dict[str, Any]:

    payload = parse_payload(data)
    received_at = _parse_received_at(payload.date)
    body_hash = _normalized_hash(payload.subject, payload.text_body or payload.html_body, payload.from_email)
    capture_id = str(uuid.uuid4())
    now = _now()

    conn = _connect()
    try:
        if not is_allowed_forwarder(payload.from_email):
            conn.execute(
                """
                INSERT INTO email_captures
                    (id, message_id, from_email, to_email, subject, received_at, body_hash, status, error_message,
                     payload_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    capture_id,
                    payload.message_id,
                    payload.from_email,
                    payload.to_email,
                    payload.subject,
                    received_at,
                    body_hash,
                    "rejected",
                    "Unauthorized sender",
                    json.dumps(data, sort_keys=True, default=str),
                    now,
                    now,
                ),
            )
            _insert_event(conn, capture_id, "email_rejected_unauthorized", {"from": payload.from_email, "to": payload.to_email})
            conn.commit()
            raise EmailCaptureUnauthorized("Unauthorized sender")

        _check_rate_limits(conn, payload.from_email)
        duplicate = _find_duplicate(conn, payload, body_hash, received_at)
        raw_email_path = None
        raw_storage_error = None
        try:
            raw_email_path = _write_raw_email(capture_id, payload, received_at)
        except OSError as exc:
            raw_storage_error = str(exc)
        conn.execute(
            """
            INSERT INTO email_captures
                (id, message_id, from_email, to_email, subject, received_at, raw_email_path, text_body, html_body,
                 body_hash, status, payload_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                capture_id,
                payload.message_id,
                payload.from_email,
                payload.to_email,
                payload.subject,
                received_at,
                raw_email_path,
                payload.text_body,
                payload.html_body,
                body_hash,
                "received",
                json.dumps(data, sort_keys=True, default=str),
                now,
                now,
            ),
        )
        _insert_event(conn, capture_id, "email_received", {"from": payload.from_email, "to": payload.to_email})
        if raw_storage_error:
            _insert_event(conn, capture_id, "raw_email_storage_failed", {"error": raw_storage_error})
        conn.commit()

        if duplicate:
            existing_todo = conn.execute("SELECT * FROM todos WHERE id = ?", (duplicate["created_task_id"],)).fetchone()
            title = existing_todo["title"] if existing_todo else duplicate["subject"] or "existing todo"
            notification_status, notification_error = (
                _send_capture_notification(
                    {
                        "title": title,
                        "project": existing_todo["project"] if existing_todo else "unknown",
                        "priority": existing_todo["priority"] if existing_todo else "medium",
                        "due_date": existing_todo["due_date"] if existing_todo else None,
                    },
                    duplicate=True,
                )
            )
            conn.execute(
                """
                UPDATE email_captures
                SET status = ?, created_task_id = ?, notification_status = ?, notification_error = ?, updated_at = ?
                WHERE id = ?
                """,
                ("duplicate", duplicate["created_task_id"], notification_status, notification_error, _now(), capture_id),
            )
            _insert_event(conn, capture_id, "email_duplicate_detected", {"duplicateCaptureId": duplicate["id"]})
            conn.commit()
            return {
                "success": True,
                "duplicate": True,
                "taskId": duplicate["created_task_id"],
                "title": title,
                "priority": existing_todo["priority"] if existing_todo else "medium",
                "project": existing_todo["project"] if existing_todo else "unknown",
                "emailCaptureId": capture_id,
            }

        fallback = deterministic_extract(payload)
        try:
            extracted = extract_with_llm(payload, fallback)
            _insert_event(conn, capture_id, "email_parsed", {"source": "llm", "confidence": extracted["confidence"]})
        except Exception as exc:
            extracted = fallback
            _insert_event(conn, capture_id, "llm_extract_failed", {"error": str(exc)})
        conn.commit()

        todo = create_todo(
            title=extracted["title"],
            notes=extracted["description"],
            status="inbox",
            priority=extracted["priority"],
            due_date=extracted["due_date"],
            tag_ids=_tag_ids_for_capture(extracted["project"]),
            source="email",
            source_ref_id=capture_id,
            project=extracted["project"],
            reviewed=False,
            raw_context=json.dumps(
                {
                    "emailCaptureId": capture_id,
                    "messageId": payload.message_id,
                    "sourceEmailFrom": extracted.get("source_email_from"),
                    "forwardedBy": payload.from_email,
                    "sourceSubject": payload.subject,
                    "userNote": extracted.get("user_note"),
                    "attachments": payload.attachments,
                },
                sort_keys=True,
                default=str,
            ),
        )
        notification_status, notification_error = _send_capture_notification(todo)
        conn.execute(
            """
            UPDATE email_captures
            SET status = ?, created_task_id = ?, notification_status = ?, notification_error = ?, updated_at = ?
            WHERE id = ?
            """,
            ("task_created", todo["id"], notification_status, notification_error, _now(), capture_id),
        )
        _insert_event(
            conn,
            capture_id,
            "task_created",
            {
                "taskId": todo["id"],
                "title": todo["title"],
                "project": todo["project"],
                "priority": todo["priority"],
            },
        )
        if notification_status == "sent":
            _insert_event(conn, capture_id, "ntfy_sent", {"taskId": todo["id"]})
        else:
            _insert_event(conn, capture_id, "ntfy_failed", {"error": notification_error})
        conn.commit()
        return {
            "success": True,
            "duplicate": False,
            "taskId": todo["id"],
            "title": todo["title"],
            "priority": todo["priority"],
            "project": todo["project"],
            "emailCaptureId": capture_id,
        }
    except EmailCaptureError:
        raise
    except Exception as exc:
        exists = conn.execute("SELECT 1 FROM email_captures WHERE id = ?", (capture_id,)).fetchone()
        conn.execute(
            "UPDATE email_captures SET status = ?, error_message = ?, updated_at = ? WHERE id = ?",
            ("failed", str(exc), _now(), capture_id),
        )
        _insert_event(conn, capture_id if exists else None, "email_parse_failed", {"error": str(exc)})
        conn.commit()
        raise
    finally:
        conn.close()


def list_email_captures(limit: int = 50) -> list[dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT * FROM email_captures
            ORDER BY datetime(created_at) DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [_capture_to_dict(row) for row in rows]
    finally:
        conn.close()


def get_email_capture(capture_id: str) -> dict[str, Any] | None:
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM email_captures WHERE id = ?", (capture_id,)).fetchone()
        if not row:
            return None
        events = conn.execute(
            """
            SELECT event_name, event_json, created_at
            FROM email_capture_events
            WHERE email_capture_id = ?
            ORDER BY datetime(created_at) ASC
            """,
            (capture_id,),
        ).fetchall()
        capture = _capture_to_dict(row)
        capture["events"] = [
            {
                "eventName": event["event_name"],
                "event": json.loads(event["event_json"]),
                "createdAt": event["created_at"],
            }
            for event in events
        ]
        return capture
    finally:
        conn.close()
