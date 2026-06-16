import os
import re
import sqlite3
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from typing import Any

from marvin_core.db import connect, migrate
from marvin_core.env import load_root_env, require_env
from marvin_core.openrouter import OpenRouterClient


DATABASE_PATH = "data/marvin.sqlite3"
DEFAULT_TAG_NAME = "Others"
TODO_STATUSES = {
    "inbox",
    "idea",
    "need_to_plan",
    "wip",
    "update_needed",
    "pending_on_others",
    "done",
}
TODO_PRIORITIES = {"low", "medium", "high", "urgent"}
OPEN_STATUSES = TODO_STATUSES - {"done"}
TODO_PROJECTS = {"vitbhopal", "vityarthi", "recruitment", "personal", "unknown"}
TOKEN_STOPWORDS = {
    "a",
    "an",
    "and",
    "from",
    "in",
    "of",
    "on",
    "the",
    "to",
}
MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _name_key(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def _tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", value.lower())
        if token not in TOKEN_STOPWORDS
    }


def _connect() -> sqlite3.Connection:
    conn = connect(DATABASE_PATH)
    migrate(conn)
    return conn


def _row_to_tag(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "is_protected": bool(row["is_protected"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_to_person(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_to_todo(row: sqlite3.Row, tags: list[dict[str, Any]]) -> dict[str, Any]:
    waiting_on_person = None
    if row["waiting_on_person_id"] is not None and row["waiting_on_person_name"] is not None:
        waiting_on_person = {
            "id": row["waiting_on_person_id"],
            "name": row["waiting_on_person_name"],
        }
    return {
        "id": row["id"],
        "title": row["title"],
        "notes": row["notes"],
        "status": row["status"],
        "priority": row["priority"],
        "due_date": row["due_date"],
        "source": row["source"],
        "source_ref_id": row["source_ref_id"],
        "project": row["project"],
        "reviewed": bool(row["reviewed"]),
        "raw_context": row["raw_context"],
        "completed_at": row["completed_at"],
        "waiting_on_person_id": row["waiting_on_person_id"],
        "waiting_on_person": waiting_on_person,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "tags": tags,
    }


def _validate_status(status: str | None, *, default: str = "inbox") -> str:
    value = (status or default).strip().lower()
    if value not in TODO_STATUSES:
        raise ValueError(f"Invalid todo status: {status}")
    return value


def _validate_priority(priority: str | None, *, default: str = "medium") -> str:
    value = (priority or default).strip().lower()
    if value not in TODO_PRIORITIES:
        raise ValueError(f"Invalid todo priority: {priority}")
    return value


def _validate_project(project: str | None, *, default: str = "unknown") -> str:
    value = (project or default).strip().lower()
    if value not in TODO_PROJECTS:
        raise ValueError(f"Invalid todo project: {project}")
    return value


def _validate_due_date(due_date: str | None) -> str | None:
    if due_date in (None, ""):
        return None
    datetime.strptime(due_date, "%Y-%m-%d")
    return due_date


def parse_natural_due_date(value: str | None, *, today: date | None = None) -> str | None:
    if not value:
        return None

    today = today or date.today()
    text = value.strip().lower()
    if not text:
        return None

    iso_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
    if iso_match:
        return _validate_due_date(iso_match.group(1))

    if re.search(r"\btoday\b", text):
        return today.isoformat()
    if re.search(r"\btomorrow\b", text):
        return (today + timedelta(days=1)).isoformat()
    next_weekday = re.search(
        r"\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        text,
    )
    if next_weekday:
        weekdays = {
            "monday": 0,
            "tuesday": 1,
            "wednesday": 2,
            "thursday": 3,
            "friday": 4,
            "saturday": 5,
            "sunday": 6,
        }
        target = weekdays[next_weekday.group(1)]
        delta = (target - today.weekday()) % 7
        return (today + timedelta(days=delta or 7)).isoformat()

    day_month = re.search(
        r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?"
        r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
        r"aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
        r"(?:\s+(\d{4}))?\b",
        text,
    )
    if day_month:
        day = int(day_month.group(1))
        month = MONTHS[day_month.group(2)]
        year = int(day_month.group(3)) if day_month.group(3) else today.year
        candidate = date(year, month, day)
        if not day_month.group(3) and candidate < today:
            candidate = date(year + 1, month, day)
        return candidate.isoformat()

    month_day = re.search(
        r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
        r"aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)?(\d{4})?\b",
        text,
    )
    if month_day:
        month = MONTHS[month_day.group(1)]
        day = int(month_day.group(2))
        year = int(month_day.group(3)) if month_day.group(3) else today.year
        candidate = date(year, month, day)
        if not month_day.group(3) and candidate < today:
            candidate = date(year + 1, month, day)
        return candidate.isoformat()

    vague_month = re.search(
        r"\b(early|mid|late)?\s*"
        r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
        r"aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
        r"(?:\s+(\d{4}))?\b",
        text,
    )
    if vague_month:
        qualifier = vague_month.group(1) or "mid"
        month = MONTHS[vague_month.group(2)]
        year = int(vague_month.group(3)) if vague_month.group(3) else today.year
        last_day = monthrange(year, month)[1]
        day = {"early": 7, "mid": 15, "late": min(25, last_day)}[qualifier]
        candidate = date(year, month, day)
        if not vague_month.group(3) and candidate < today:
            year += 1
            last_day = monthrange(year, month)[1]
            candidate = date(year, month, min(day, last_day))
        return candidate.isoformat()

    return None


def list_tags(conn: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    owns_conn = conn is None
    conn = conn or _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM todo_tags ORDER BY lower(name)"
        ).fetchall()
        return [_row_to_tag(row) for row in rows]
    finally:
        if owns_conn:
            conn.close()


def list_people(conn: sqlite3.Connection | None = None) -> list[dict[str, Any]]:
    owns_conn = conn is None
    conn = conn or _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM todo_people ORDER BY lower(name)"
        ).fetchall()
        return [_row_to_person(row) for row in rows]
    finally:
        if owns_conn:
            conn.close()


def create_person(
    name: str,
    conn: sqlite3.Connection | None = None,
) -> dict[str, Any]:
    clean_name = re.sub(r"\s+", " ", name.strip())
    if not clean_name:
        raise ValueError("Person name is required.")

    owns_conn = conn is None
    conn = conn or _connect()
    try:
        now = _now()
        cursor = conn.execute(
            """
            INSERT INTO todo_people (name, name_key, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name_key) DO UPDATE SET
                name = excluded.name,
                updated_at = excluded.updated_at
            RETURNING *
            """,
            (clean_name, _name_key(clean_name), now, now),
        )
        row = cursor.fetchone()
        conn.commit()
        return _row_to_person(row)
    finally:
        if owns_conn:
            conn.close()


def create_tag(
    name: str,
    description: str | None = None,
    conn: sqlite3.Connection | None = None,
) -> dict[str, Any]:
    clean_name = re.sub(r"\s+", " ", name.strip())
    if not clean_name:
        raise ValueError("Tag name is required.")

    owns_conn = conn is None
    conn = conn or _connect()
    try:
        now = _now()
        cursor = conn.execute(
            """
            INSERT INTO todo_tags (name, name_key, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(name_key) DO UPDATE SET
                description = COALESCE(excluded.description, todo_tags.description),
                updated_at = excluded.updated_at
            RETURNING *
            """,
            (clean_name, _name_key(clean_name), description or None, now, now),
        )
        row = cursor.fetchone()
        conn.commit()
        return _row_to_tag(row)
    finally:
        if owns_conn:
            conn.close()


def _default_tag_id(conn: sqlite3.Connection) -> int:
    row = conn.execute(
        "SELECT id FROM todo_tags WHERE name_key = ?", (_name_key(DEFAULT_TAG_NAME),)
    ).fetchone()
    if row:
        return int(row["id"])
    return int(create_tag(DEFAULT_TAG_NAME, "Fallback tag for uncategorized todos.", conn)["id"])


def _normalize_tag_ids(conn: sqlite3.Connection, tag_ids: list[int] | None) -> list[int]:
    if not tag_ids:
        return [_default_tag_id(conn)]
    placeholders = ",".join("?" for _ in tag_ids)
    rows = conn.execute(
        f"SELECT id FROM todo_tags WHERE id IN ({placeholders})",
        tuple(tag_ids),
    ).fetchall()
    valid = sorted({int(row["id"]) for row in rows})
    return valid or [_default_tag_id(conn)]


def _heuristic_classify(title: str, tags: list[dict[str, Any]]) -> list[int]:
    title_tokens = _tokens(title)
    if not title_tokens:
        return []

    matched: list[int] = []
    for tag in tags:
        if tag["name"].lower() == DEFAULT_TAG_NAME.lower():
            continue
        tag_tokens = _tokens(f"{tag['name']} {tag.get('description') or ''}")
        if title_tokens & tag_tokens:
            matched.append(int(tag["id"]))
    return matched


def classify_todo_tags(title: str, tags: list[dict[str, Any]]) -> list[int]:
    heuristic = _heuristic_classify(title, tags)
    try:
        load_root_env()
        client = OpenRouterClient(require_env("OPENROUTER_API_KEY"), timeout_seconds=30)
        model = os.getenv("TODO_CLASSIFIER_MODEL", os.getenv("MARVIN_CHAT_MODEL", "google/gemini-2.5-flash"))
        tag_payload = [
            {
                "id": tag["id"],
                "name": tag["name"],
                "description": tag.get("description"),
            }
            for tag in tags
            if tag["name"].lower() != DEFAULT_TAG_NAME.lower()
        ]
        if not tag_payload:
            return []
        response = client.chat_json(
            model=model,
            temperature=0.1,
            max_tokens=300,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Classify a todo into one or more existing tags. "
                        "Return JSON only with shape {\"tag_ids\": [number]}. "
                        "Use only IDs from the provided tag list. If no tag clearly matches, return an empty list."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Todo: {title}\nTags: {tag_payload}",
                },
            ],
        )
        raw_ids = response.get("tag_ids")
        if not isinstance(raw_ids, list):
            return heuristic
        allowed = {int(tag["id"]) for tag in tag_payload}
        valid = sorted({int(tag_id) for tag_id in raw_ids if isinstance(tag_id, int) and int(tag_id) in allowed})
        return valid or heuristic
    except Exception:
        return heuristic


def _load_todo(conn: sqlite3.Connection, todo_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT
            todos.*,
            todo_people.name AS waiting_on_person_name
        FROM todos
        LEFT JOIN todo_people ON todo_people.id = todos.waiting_on_person_id
        WHERE todos.id = ?
        """,
        (todo_id,),
    ).fetchone()
    if not row:
        return None
    tags = [
        _row_to_tag(tag_row)
        for tag_row in conn.execute(
            """
            SELECT todo_tags.*
            FROM todo_tags
            JOIN todo_tag_links ON todo_tag_links.tag_id = todo_tags.id
            WHERE todo_tag_links.todo_id = ?
            ORDER BY lower(todo_tags.name)
            """,
            (todo_id,),
        ).fetchall()
    ]
    return _row_to_todo(row, tags)


def list_todos(
    *,
    status: str | None = None,
    tag_id: int | None = None,
    include_done: bool = False,
    source: str | None = None,
    project: str | None = None,
    priority: str | None = None,
    reviewed: bool | None = None,
    conn: sqlite3.Connection | None = None,
) -> list[dict[str, Any]]:
    owns_conn = conn is None
    conn = conn or _connect()
    try:
        clauses: list[str] = []
        params: list[Any] = []
        if status:
            clauses.append("todos.status = ?")
            params.append(_validate_status(status))
        elif not include_done:
            clauses.append("todos.status != 'done'")
        if tag_id:
            clauses.append(
                "EXISTS (SELECT 1 FROM todo_tag_links WHERE todo_tag_links.todo_id = todos.id AND todo_tag_links.tag_id = ?)"
            )
            params.append(tag_id)
        if source:
            clauses.append("todos.source = ?")
            params.append(source.strip().lower())
        if project:
            clauses.append("todos.project = ?")
            params.append(_validate_project(project))
        if priority:
            clauses.append("todos.priority = ?")
            params.append(_validate_priority(priority))
        if reviewed is not None:
            clauses.append("todos.reviewed = ?")
            params.append(1 if reviewed else 0)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        rows = conn.execute(
            f"""
            SELECT
                todos.*,
                todo_people.name AS waiting_on_person_name
            FROM todos
            LEFT JOIN todo_people ON todo_people.id = todos.waiting_on_person_id
            {where}
            ORDER BY
                CASE status
                    WHEN 'update_needed' THEN 0
                    WHEN 'pending_on_others' THEN 1
                    WHEN 'wip' THEN 2
                    WHEN 'need_to_plan' THEN 3
                    WHEN 'idea' THEN 4
                    ELSE 5
                END,
                CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
                due_date ASC,
                updated_at DESC
            """,
            tuple(params),
        ).fetchall()
        todos: list[dict[str, Any]] = []
        for row in rows:
            todo = _load_todo(conn, int(row["id"]))
            if todo is not None:
                todos.append(todo)
        return todos
    finally:
        if owns_conn:
            conn.close()


def _normalize_person_id(
    conn: sqlite3.Connection,
    waiting_on_person_id: int | None,
) -> int | None:
    if waiting_on_person_id in (None, ""):
        return None
    row = conn.execute(
        "SELECT id FROM todo_people WHERE id = ?",
        (int(waiting_on_person_id),),
    ).fetchone()
    if not row:
        raise ValueError("Waiting on person not found.")
    return int(row["id"])


def create_todo(
    *,
    title: str,
    notes: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    due_date: str | None = None,
    deadline_text: str | None = None,
    tag_ids: list[int] | None = None,
    classify_tags: bool = True,
    source: str | None = None,
    source_ref_id: str | None = None,
    project: str | None = None,
    reviewed: bool | None = None,
    raw_context: str | None = None,
    waiting_on_person_id: int | None = None,
) -> dict[str, Any]:
    clean_title = re.sub(r"\s+", " ", title.strip())
    if not clean_title:
        raise ValueError("Todo title is required.")

    conn = _connect()
    try:
        tags = list_tags(conn)
        normalized_status = _validate_status(status)
        parsed_due_date = (
            _validate_due_date(due_date)
            if due_date
            else parse_natural_due_date(clean_title) or parse_natural_due_date(deadline_text)
        )
        normalized_waiting_on_person_id = _normalize_person_id(conn, waiting_on_person_id)
        if normalized_status == "pending_on_others" and normalized_waiting_on_person_id is None:
            raise ValueError("Pending on others todos must have a person assigned.")
        assigned_tag_ids = _normalize_tag_ids(
            conn,
            tag_ids
            if tag_ids is not None
            else classify_todo_tags(clean_title, tags)
            if classify_tags
            else None,
        )
        now = _now()
        cursor = conn.execute(
            """
            INSERT INTO todos
                (title, notes, status, priority, due_date, source, source_ref_id, project, reviewed, raw_context, waiting_on_person_id, completed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                clean_title,
                notes or None,
                normalized_status,
                _validate_priority(priority),
                parsed_due_date,
                (source or "manual").strip().lower(),
                source_ref_id or None,
                _validate_project(project),
                1 if reviewed is not False else 0,
                raw_context or None,
                normalized_waiting_on_person_id,
                now if normalized_status == "done" else None,
                now,
                now,
            ),
        )
        todo_id = int(cursor.lastrowid)
        conn.executemany(
            "INSERT INTO todo_tag_links (todo_id, tag_id) VALUES (?, ?)",
            [(todo_id, tag_id) for tag_id in assigned_tag_ids],
        )
        conn.commit()
        todo = _load_todo(conn, todo_id)
        assert todo is not None
        return todo
    finally:
        conn.close()


def classify_and_apply_tags(todo_id: int) -> dict[str, Any] | None:
    conn = _connect()
    try:
        todo = _load_todo(conn, todo_id)
        if not todo:
            return None
        current_tag_ids = {int(tag["id"]) for tag in todo["tags"]}
        default_tag_id = _default_tag_id(conn)
        if current_tag_ids != {default_tag_id}:
            return todo

        tags = list_tags(conn)
        tag_ids = _normalize_tag_ids(conn, classify_todo_tags(todo["title"], tags))
        if set(tag_ids) == current_tag_ids:
            return todo

        conn.execute("DELETE FROM todo_tag_links WHERE todo_id = ?", (todo_id,))
        conn.executemany(
            "INSERT INTO todo_tag_links (todo_id, tag_id) VALUES (?, ?)",
            [(todo_id, tag_id) for tag_id in tag_ids],
        )
        conn.execute("UPDATE todos SET updated_at = ? WHERE id = ?", (_now(), todo_id))
        conn.commit()
        return _load_todo(conn, todo_id)
    finally:
        conn.close()


def update_todo(todo_id: int, updates: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "title",
        "notes",
        "status",
        "priority",
        "due_date",
        "tag_ids",
        "source",
        "source_ref_id",
        "project",
        "reviewed",
        "raw_context",
        "waiting_on_person_id",
    }
    unknown = set(updates) - allowed
    if unknown:
        raise ValueError(f"Unsupported todo fields: {', '.join(sorted(unknown))}")

    conn = _connect()
    try:
        current_todo = _load_todo(conn, todo_id)
        if not current_todo:
            raise LookupError("Todo not found.")

        fields: list[str] = []
        params: list[Any] = []
        next_status = current_todo["status"]
        if "status" in updates:
            next_status = _validate_status(updates["status"])
        next_waiting_on_person_id = current_todo["waiting_on_person_id"]
        if "waiting_on_person_id" in updates:
            next_waiting_on_person_id = _normalize_person_id(conn, updates["waiting_on_person_id"])
        if next_status == "pending_on_others" and next_waiting_on_person_id is None:
            raise ValueError("Pending on others todos must have a person assigned.")
        if next_status != "pending_on_others" and "waiting_on_person_id" not in updates and current_todo["status"] == "pending_on_others":
            next_waiting_on_person_id = None
        if "title" in updates:
            title = re.sub(r"\s+", " ", str(updates["title"]).strip())
            if not title:
                raise ValueError("Todo title is required.")
            fields.append("title = ?")
            params.append(title)
        if "notes" in updates:
            fields.append("notes = ?")
            params.append(updates["notes"] or None)
        if "status" in updates:
            fields.append("status = ?")
            params.append(next_status)
        if "priority" in updates:
            fields.append("priority = ?")
            params.append(_validate_priority(updates["priority"]))
        if "due_date" in updates:
            fields.append("due_date = ?")
            params.append(_validate_due_date(updates["due_date"]))
        if "source" in updates:
            fields.append("source = ?")
            params.append(str(updates["source"] or "manual").strip().lower())
        if "source_ref_id" in updates:
            fields.append("source_ref_id = ?")
            params.append(updates["source_ref_id"] or None)
        if "project" in updates:
            fields.append("project = ?")
            params.append(_validate_project(updates["project"]))
        if "reviewed" in updates:
            fields.append("reviewed = ?")
            params.append(1 if updates["reviewed"] else 0)
        if "raw_context" in updates:
            fields.append("raw_context = ?")
            params.append(updates["raw_context"] or None)
        if "waiting_on_person_id" in updates or current_todo["status"] == "pending_on_others" or next_status == "pending_on_others":
            fields.append("waiting_on_person_id = ?")
            params.append(next_waiting_on_person_id if next_status == "pending_on_others" else None)
        if next_status == "done":
            fields.append("completed_at = ?")
            params.append(current_todo["completed_at"] or _now())
        elif current_todo["completed_at"] is not None:
            fields.append("completed_at = ?")
            params.append(None)
        if fields:
            fields.append("updated_at = ?")
            params.append(_now())
            params.append(todo_id)
            conn.execute(f"UPDATE todos SET {', '.join(fields)} WHERE id = ?", tuple(params))
        if "tag_ids" in updates:
            tag_ids = _normalize_tag_ids(conn, [int(value) for value in updates["tag_ids"]])
            conn.execute("DELETE FROM todo_tag_links WHERE todo_id = ?", (todo_id,))
            conn.executemany(
                "INSERT INTO todo_tag_links (todo_id, tag_id) VALUES (?, ?)",
                [(todo_id, tag_id) for tag_id in tag_ids],
            )
            conn.execute("UPDATE todos SET updated_at = ? WHERE id = ?", (_now(), todo_id))
        conn.commit()
        todo = _load_todo(conn, todo_id)
        assert todo is not None
        return todo
    finally:
        conn.close()


def retag_todo(todo_id: int, tag_ids: list[int]) -> dict[str, Any]:
    return update_todo(todo_id, {"tag_ids": tag_ids})


def build_reminder_digest() -> dict[str, Any]:
    todos = list_todos(include_done=False)
    if not todos:
        return {"message": "No open todos. Nothing needs your attention right now.", "source": "fallback"}

    fallback_lines = ["Focus list:"]
    for todo in todos[:8]:
        due = f", due {todo['due_date']}" if todo.get("due_date") else ""
        tags = ", ".join(tag["name"] for tag in todo["tags"])
        fallback_lines.append(
            f"- [{todo['priority']}] {todo['title']} ({todo['status']}; {tags}{due})"
        )
    fallback = "\n".join(fallback_lines)

    try:
        load_root_env()
        client = OpenRouterClient(require_env("OPENROUTER_API_KEY"), timeout_seconds=45)
        model = os.getenv("TODO_REMINDER_MODEL", os.getenv("MARVIN_CHAT_MODEL", "google/gemini-2.5-flash"))
        response = client.chat_json(
            model=model,
            temperature=0.2,
            max_tokens=700,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are MARVIN helping a forgetful operator decide what to do next. "
                        "Return JSON only with {\"message\": \"markdown string\"}. "
                        "Keep it concise, actionable, and prioritize overdue, high priority, update_needed, "
                        "wip, and pending_on_others items."
                    ),
                },
                {"role": "user", "content": f"Open todos: {todos}"},
            ],
        )
        message = response.get("message")
        if isinstance(message, str) and message.strip():
            return {"message": message.strip(), "source": "llm"}
    except Exception:
        pass
    return {"message": fallback, "source": "fallback"}
