import json
import sqlite3
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from marvin_core.paths import project_path


SCHEMA = """
CREATE TABLE IF NOT EXISTS task_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    error TEXT
);

CREATE TABLE IF NOT EXISTS monitor_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    monitor_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    url TEXT,
    status INTEGER,
    raw_json TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS heartbeat_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    monitor_id INTEGER NOT NULL,
    heartbeat_time TEXT,
    observed_at TEXT NOT NULL,
    status INTEGER,
    ping REAL,
    message TEXT,
    raw_json TEXT NOT NULL,
    UNIQUE (monitor_id, heartbeat_time),
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    report_path TEXT NOT NULL,
    llm_model TEXT,
    llm_json TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS beszel_system_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    system_id TEXT NOT NULL,
    name TEXT NOT NULL,
    host TEXT,
    status TEXT,
    raw_json TEXT NOT NULL,
    UNIQUE (run_id, system_id),
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS beszel_alert_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    alert_id TEXT NOT NULL,
    system_id TEXT,
    alert_name TEXT,
    triggered INTEGER,
    value TEXT,
    min_value TEXT,
    raw_json TEXT NOT NULL,
    UNIQUE (run_id, alert_id),
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS beszel_alert_history_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    history_id TEXT NOT NULL,
    system_id TEXT,
    alert_id TEXT,
    alert_type TEXT,
    value TEXT,
    resolved INTEGER,
    created_at TEXT,
    raw_json TEXT NOT NULL,
    UNIQUE (run_id, history_id),
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS team_status_member_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    member_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    UNIQUE (run_id, member_id),
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS team_status_task_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    task_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    title TEXT,
    status TEXT,
    project_name TEXT,
    notes TEXT,
    raw_json TEXT NOT NULL,
    UNIQUE (run_id, task_id),
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS todo_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    description TEXT,
    is_protected INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todo_people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    due_date TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref_id TEXT,
    project TEXT NOT NULL DEFAULT 'unknown',
    reviewed INTEGER NOT NULL DEFAULT 1,
    raw_context TEXT,
    waiting_on_person_id INTEGER,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (waiting_on_person_id) REFERENCES todo_people(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS todo_tag_links (
    todo_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (todo_id, tag_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES todo_tags(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO todo_tags
    (name, name_key, description, is_protected, created_at, updated_at)
VALUES
    ('Others', 'others', 'Fallback tag for uncategorized todos.', 1, datetime('now'), datetime('now'));

CREATE TABLE IF NOT EXISTS vityarthi_support_ticket_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    ticket_id INTEGER NOT NULL,
    subject TEXT,
    status TEXT,
    priority TEXT,
    category TEXT,
    owner_id INTEGER,
    owner_name TEXT,
    owner_email TEXT,
    created_at TEXT,
    updated_at TEXT,
    raw_json TEXT NOT NULL,
    UNIQUE (run_id, ticket_id),
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS vityarthi_ticket_count_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    open_count INTEGER NOT NULL DEFAULT 0,
    replied_count INTEGER NOT NULL DEFAULT 0,
    closed_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (run_id) REFERENCES task_runs(id)
);

CREATE TABLE IF NOT EXISTS reimbursement_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT,
    invoice_date TEXT NOT NULL,
    invoice_from TEXT NOT NULL,
    amount_usd REAL,
    amount_inr REAL,
    original_filename TEXT NOT NULL,
    invoice_file_path TEXT NOT NULL,
    invoice_file_url TEXT,
    extraction_model TEXT,
    extraction_raw_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reimbursement_invoices_invoice_date
    ON reimbursement_invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_reimbursement_invoices_identity
    ON reimbursement_invoices(invoice_no, invoice_from);

CREATE TABLE IF NOT EXISTS task_run_payloads (
    run_id INTEGER PRIMARY KEY,
    task_name TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    factual_json TEXT NOT NULL,
    deterministic_analysis_json TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES task_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS marvin_summaries (
    run_id INTEGER NOT NULL,
    model TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (run_id, model),
    FOREIGN KEY (run_id) REFERENCES task_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_rag_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    ticket_number TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    subject TEXT,
    customer_message TEXT,
    suggested_reply TEXT NOT NULL,
    final_reply TEXT,
    confidence TEXT NOT NULL,
    requires_human_attention INTEGER NOT NULL DEFAULT 1,
    retrieval_backend TEXT,
    matched_examples_json TEXT NOT NULL,
    policy_flags_json TEXT NOT NULL,
    source_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sent_at TEXT
);

CREATE TABLE IF NOT EXISTS email_captures (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    from_email TEXT NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT,
    received_at TEXT NOT NULL,
    raw_email_path TEXT,
    text_body TEXT,
    html_body TEXT,
    body_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    error_message TEXT,
    created_task_id INTEGER,
    notification_status TEXT,
    notification_error TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_task_id) REFERENCES todos(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_captures_message_id
    ON email_captures(message_id);

CREATE INDEX IF NOT EXISTS idx_email_captures_body_hash
    ON email_captures(body_hash);

CREATE INDEX IF NOT EXISTS idx_email_captures_sender_subject
    ON email_captures(from_email, subject, received_at);

CREATE TABLE IF NOT EXISTS email_capture_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_capture_id TEXT,
    event_name TEXT NOT NULL,
    event_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (email_capture_id) REFERENCES email_captures(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_run_payloads_task_name_observed
    ON task_run_payloads(task_name, observed_at);

CREATE INDEX IF NOT EXISTS idx_task_run_payloads_risk_level
    ON task_run_payloads(risk_level);

CREATE INDEX IF NOT EXISTS idx_task_runs_task_name
    ON task_runs(task_name);

CREATE INDEX IF NOT EXISTS idx_task_runs_status
    ON task_runs(status);

CREATE INDEX IF NOT EXISTS idx_support_rag_suggestions_ticket_status
    ON support_rag_suggestions(ticket_id, status);

CREATE INDEX IF NOT EXISTS idx_support_rag_suggestions_updated
    ON support_rag_suggestions(updated_at);

CREATE INDEX IF NOT EXISTS idx_email_capture_events_capture
    ON email_capture_events(email_capture_id, created_at);

CREATE TABLE IF NOT EXISTS agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_name TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    target_label TEXT,
    status TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    error TEXT
);

CREATE TABLE IF NOT EXISTS agent_run_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_run_id INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    input_json TEXT,
    output_json TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_run_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    target_label TEXT,
    summary_text TEXT,
    draft_content_json TEXT NOT NULL,
    edited_content_json TEXT,
    evidence_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewer TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    reviewed_at TEXT,
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status
    ON agent_runs(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_agent_runs_workflow
    ON agent_runs(workflow_name, updated_at);

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run
    ON agent_run_steps(agent_run_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_status
    ON agent_approvals(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_kind
    ON agent_approvals(kind, updated_at);
"""


def connect(database_path: str | Path) -> sqlite3.Connection:
    path = project_path(database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)"
    )
    conn.commit()
    run_migrations(conn)


def create_task_run(conn: sqlite3.Connection, task_name: str, started_at: str) -> int:
    cursor = conn.execute(
        "INSERT INTO task_runs (task_name, started_at, status) VALUES (?, ?, ?)",
        (task_name, started_at, "running"),
    )
    conn.commit()
    return int(cursor.lastrowid)


def finish_task_run(
    conn: sqlite3.Connection,
    run_id: int,
    finished_at: str,
    status: str,
    error: str | None = None,
) -> None:
    conn.execute(
        "UPDATE task_runs SET finished_at = ?, status = ?, error = ? WHERE id = ?",
        (finished_at, status, error, run_id),
    )
    conn.commit()


MIGRATIONS = [
    ("beszel_alert_observations_alert_name", "ALTER TABLE beszel_alert_observations ADD COLUMN alert_name TEXT"),
    ("beszel_alert_observations_triggered", "ALTER TABLE beszel_alert_observations ADD COLUMN triggered INTEGER"),
    ("beszel_alert_observations_min_value", "ALTER TABLE beszel_alert_observations ADD COLUMN min_value TEXT"),
    ("reimbursement_invoices_invoice_file_path", "ALTER TABLE reimbursement_invoices ADD COLUMN invoice_file_path TEXT"),
    ("reimbursement_invoices_invoice_file_url", "ALTER TABLE reimbursement_invoices ADD COLUMN invoice_file_url TEXT"),
    ("todos_source", "ALTER TABLE todos ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'"),
    ("todos_source_ref_id", "ALTER TABLE todos ADD COLUMN source_ref_id TEXT"),
    ("todos_project", "ALTER TABLE todos ADD COLUMN project TEXT NOT NULL DEFAULT 'unknown'"),
    ("todos_reviewed", "ALTER TABLE todos ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 1"),
    ("todos_raw_context", "ALTER TABLE todos ADD COLUMN raw_context TEXT"),
    ("todo_people_table", "CREATE TABLE IF NOT EXISTS todo_people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    ("todos_waiting_on_person_id", "ALTER TABLE todos ADD COLUMN waiting_on_person_id INTEGER REFERENCES todo_people(id) ON DELETE SET NULL"),
    ("todos_completed_at", "ALTER TABLE todos ADD COLUMN completed_at TEXT"),
]


def run_migrations(conn: sqlite3.Connection) -> None:
    applied = {
        row[0]
        for row in conn.execute("SELECT name FROM _migrations").fetchall()
    }
    for name, sql in MIGRATIONS:
        if name not in applied:
            try:
                conn.execute(sql)
            except sqlite3.OperationalError:
                pass
            conn.execute("INSERT INTO _migrations (name) VALUES (?)", (name,))
    columns = {
        row[1]
        for row in conn.execute("PRAGMA table_info(reimbursement_invoices)").fetchall()
    }
    if {"invoice_file_path", "google_drive_file_id"}.issubset(columns):
        conn.execute(
            """
            UPDATE reimbursement_invoices
            SET invoice_file_path = COALESCE(invoice_file_path, google_drive_file_id)
            WHERE invoice_file_path IS NULL
            """
        )
    if {"invoice_file_url", "google_drive_web_link"}.issubset(columns):
        conn.execute(
            """
            UPDATE reimbursement_invoices
            SET invoice_file_url = COALESCE(invoice_file_url, google_drive_web_link)
            WHERE invoice_file_url IS NULL
            """
        )
    todo_columns = {
        row[1]
        for row in conn.execute("PRAGMA table_info(todos)").fetchall()
    }
    if "source" in todo_columns:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_todos_source ON todos(source)")
    if "project" in todo_columns:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_todos_project ON todos(project)")
    if "reviewed" in todo_columns:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_todos_reviewed ON todos(reviewed)")
    if "waiting_on_person_id" in todo_columns:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_todos_waiting_on_person_id ON todos(waiting_on_person_id)")
    if "completed_at" in todo_columns:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(completed_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_todo_people_name_key ON todo_people(name_key)")
    conn.commit()


def insert_monitor_snapshots(
    conn: sqlite3.Connection,
    run_id: int,
    observed_at: str,
    monitors: Iterable[dict[str, Any]],
) -> None:
    conn.executemany(
        """
        INSERT INTO monitor_snapshots
            (run_id, observed_at, monitor_id, name, type, url, status, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                observed_at,
                monitor["id"],
                monitor.get("name") or f"monitor-{monitor['id']}",
                monitor.get("type"),
                monitor.get("url") or monitor.get("hostname"),
                monitor.get("status"),
                json.dumps(monitor, sort_keys=True, default=str),
            )
            for monitor in monitors
        ],
    )
    conn.commit()


def insert_heartbeat_observations(
    conn: sqlite3.Connection,
    run_id: int,
    observed_at: str,
    heartbeats: Iterable[dict[str, Any]],
) -> None:
    conn.executemany(
        """
        INSERT OR IGNORE INTO heartbeat_observations
            (run_id, monitor_id, heartbeat_time, observed_at, status, ping, message, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                heartbeat["monitor_id"],
                heartbeat.get("time"),
                observed_at,
                heartbeat.get("status"),
                heartbeat.get("ping"),
                heartbeat.get("message"),
                json.dumps(heartbeat, sort_keys=True, default=str),
            )
            for heartbeat in heartbeats
        ],
    )
    conn.commit()


def insert_report(
    conn: sqlite3.Connection,
    run_id: int,
    task_name: str,
    created_at: str,
    report_path: str,
    llm_model: str,
    llm_json: dict[str, Any],
) -> None:
    conn.execute(
        """
        INSERT INTO reports
            (run_id, task_name, created_at, report_path, llm_model, llm_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            run_id,
            task_name,
            created_at,
            report_path,
            llm_model,
            json.dumps(llm_json, sort_keys=True),
),
    )
    conn.commit()


def insert_beszel_system_snapshots(
    conn: sqlite3.Connection,
    run_id: int,
    observed_at: str,
    systems: Iterable[dict[str, Any]],
) -> None:
    conn.executemany(
        """
        INSERT OR IGNORE INTO beszel_system_snapshots
            (run_id, observed_at, system_id, name, host, status, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                observed_at,
                system["id"],
                system.get("name") or f"system-{system['id']}",
                system.get("host"),
                system.get("status"),
                json.dumps(system, sort_keys=True, default=str),
            )
            for system in systems
        ],
    )
    conn.commit()


def insert_beszel_alert_observations(
    conn: sqlite3.Connection,
    run_id: int,
    observed_at: str,
    alerts: Iterable[dict[str, Any]],
) -> None:
    conn.executemany(
        """
        INSERT OR IGNORE INTO beszel_alert_observations
            (run_id, observed_at, alert_id, system_id, alert_name, triggered, value, min_value, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                observed_at,
                alert["id"],
                alert.get("system"),
                alert.get("name"),
                1 if alert.get("triggered") else 0,
                str(alert["value"]) if alert.get("value") is not None else None,
                str(alert["min"]) if alert.get("min") is not None else None,
                json.dumps(alert, sort_keys=True, default=str),
            )
            for alert in alerts
        ],
    )
    conn.commit()


def insert_beszel_alert_history_observations(
    conn: sqlite3.Connection,
    run_id: int,
    observed_at: str,
    history_entries: Iterable[dict[str, Any]],
) -> None:
    conn.executemany(
        """
        INSERT OR IGNORE INTO beszel_alert_history_observations
            (run_id, observed_at, history_id, system_id, alert_id, alert_type, value, resolved, created_at, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                observed_at,
                entry["id"],
                entry.get("system"),
                entry.get("alert"),
                entry.get("type"),
                entry.get("value"),
                1 if entry.get("resolved") else 0,
                entry.get("created"),
                json.dumps(entry, sort_keys=True, default=str),
            )
            for entry in history_entries
        ],
    )
    conn.commit()


def insert_team_status_member_snapshots(
    conn: sqlite3.Connection,
    run_id: int,
    observed_at: str,
    members: Iterable[dict[str, Any]],
) -> None:
    conn.executemany(
        """
        INSERT OR IGNORE INTO team_status_member_snapshots
            (run_id, observed_at, member_id, name, raw_json)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                observed_at,
                member["id"],
                member.get("name") or f"member-{member['id']}",
                json.dumps(member, sort_keys=True, default=str),
            )
            for member in members
        ],
    )
    conn.commit()


def insert_team_status_task_observations(
    conn: sqlite3.Connection,
    run_id: int,
    observed_at: str,
    tasks: Iterable[dict[str, Any]],
) -> None:
    conn.executemany(
        """
        INSERT OR IGNORE INTO team_status_task_observations
            (run_id, observed_at, task_id, member_id, work_date, title, status, project_name, notes, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                observed_at,
                task["id"],
                task["member_id"],
                task.get("work_date"),
                task.get("title"),
                task.get("status"),
                task.get("project_name"),
                task.get("notes"),
                json.dumps(task, sort_keys=True, default=str),
            )
            for task in tasks
        ],
    )
    conn.commit()


def insert_vityarthi_support_ticket_observations(
    conn: sqlite3.Connection,
    run_id: int,
    observed_at: str,
    ticket_counts: dict[str, int],
    open_tickets: Iterable[dict[str, Any]],
) -> None:
    conn.execute(
        """
        INSERT INTO vityarthi_ticket_count_snapshots
            (run_id, observed_at, open_count, replied_count, closed_count, total_count)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            run_id,
            observed_at,
            ticket_counts.get("open", 0),
            ticket_counts.get("replied", 0),
            ticket_counts.get("closed", 0),
            ticket_counts.get("total", 0),
        ),
    )
    conn.commit()

    conn.executemany(
        """
        INSERT OR IGNORE INTO vityarthi_support_ticket_observations
            (run_id, observed_at, ticket_id, subject, status, priority, category, owner_id, owner_name, owner_email, created_at, updated_at, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                observed_at,
                ticket["id"],
                ticket.get("subject"),
                ticket.get("status"),
                ticket.get("priority"),
                ticket.get("category"),
                ticket.get("owner_id"),
                ticket.get("owner_name"),
                ticket.get("owner_email"),
                ticket.get("created_at"),
                ticket.get("updated_at"),
                json.dumps(ticket, sort_keys=True, default=str),
            )
            for ticket in open_tickets
        ],
    )
    conn.commit()


def insert_task_run_payload(
    conn: sqlite3.Connection,
    run_id: int,
    task_name: str,
    observed_at: str,
    risk_level: str,
    factual_payload: dict[str, Any],
    deterministic_analysis: dict[str, Any],
) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO task_run_payloads
            (run_id, task_name, observed_at, risk_level, factual_json, deterministic_analysis_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            run_id,
            task_name,
            observed_at,
            risk_level,
            json.dumps(factual_payload, sort_keys=True, default=str),
            json.dumps(deterministic_analysis, sort_keys=True, default=str),
        ),
    )
    conn.commit()


def insert_marvin_summary(
    conn: sqlite3.Connection,
    run_id: int,
    model: str,
    summary_json: dict[str, Any],
    created_at: str,
) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO marvin_summaries
            (run_id, model, summary_json, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            run_id,
            model,
            json.dumps(summary_json, sort_keys=True, default=str),
            created_at,
        ),
    )
    conn.commit()


def _support_suggestion_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "ticket_id": row["ticket_id"],
        "ticket_number": row["ticket_number"],
        "status": row["status"],
        "subject": row["subject"],
        "customer_message": row["customer_message"],
        "suggested_reply": row["suggested_reply"],
        "final_reply": row["final_reply"],
        "confidence": row["confidence"],
        "requires_human_attention": bool(row["requires_human_attention"]),
        "retrieval_backend": row["retrieval_backend"],
        "matched_examples": json.loads(row["matched_examples_json"]),
        "policy_flags": json.loads(row["policy_flags_json"]),
        "source": json.loads(row["source_json"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "sent_at": row["sent_at"],
    }


def insert_support_rag_suggestion(
    conn: sqlite3.Connection,
    *,
    ticket_id: int,
    ticket_number: str | None,
    subject: str | None,
    customer_message: str | None,
    suggested_reply: str,
    confidence: str,
    requires_human_attention: bool,
    retrieval_backend: str | None,
    matched_examples: list[dict[str, Any]],
    policy_flags: list[str],
    source: dict[str, Any],
    created_at: str,
) -> dict[str, Any]:
    cursor = conn.execute(
        """
        INSERT INTO support_rag_suggestions
            (
                ticket_id,
                ticket_number,
                status,
                subject,
                customer_message,
                suggested_reply,
                confidence,
                requires_human_attention,
                retrieval_backend,
                matched_examples_json,
                policy_flags_json,
                source_json,
                created_at,
                updated_at
            )
        VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            ticket_id,
            ticket_number,
            subject,
            customer_message,
            suggested_reply,
            confidence,
            1 if requires_human_attention else 0,
            retrieval_backend,
            json.dumps(matched_examples, sort_keys=True, default=str),
            json.dumps(policy_flags, sort_keys=True, default=str),
            json.dumps(source, sort_keys=True, default=str),
            created_at,
            created_at,
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM support_rag_suggestions WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    return _support_suggestion_row_to_dict(row)


def update_support_rag_suggestion(
    conn: sqlite3.Connection,
    *,
    suggestion_id: int,
    status: str,
    updated_at: str,
    final_reply: str | None = None,
    sent_at: str | None = None,
) -> dict[str, Any]:
    conn.execute(
        """
        UPDATE support_rag_suggestions
        SET status = ?,
            final_reply = COALESCE(?, final_reply),
            sent_at = COALESCE(?, sent_at),
            updated_at = ?
        WHERE id = ?
        """,
        (status, final_reply, sent_at, updated_at, suggestion_id),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM support_rag_suggestions WHERE id = ?",
        (suggestion_id,),
    ).fetchone()
    if row is None:
        raise LookupError(f"Support RAG suggestion {suggestion_id} was not found")
    return _support_suggestion_row_to_dict(row)


def get_support_rag_suggestion(
    conn: sqlite3.Connection,
    suggestion_id: int,
) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT * FROM support_rag_suggestions WHERE id = ?",
        (suggestion_id,),
    ).fetchone()
    return _support_suggestion_row_to_dict(row) if row else None


def list_latest_support_rag_suggestions(
    conn: sqlite3.Connection,
    *,
    ticket_ids: Iterable[int] | None = None,
) -> dict[int, dict[str, Any]]:
    ids = list(ticket_ids or [])
    params: list[Any] = []
    where = ""
    if ids:
        placeholders = ",".join("?" for _ in ids)
        where = f"WHERE ticket_id IN ({placeholders})"
        params.extend(ids)

    rows = conn.execute(
        f"""
        SELECT s.*
        FROM support_rag_suggestions s
        JOIN (
            SELECT ticket_id, MAX(id) AS max_id
            FROM support_rag_suggestions
            {where}
            GROUP BY ticket_id
        ) latest
          ON latest.max_id = s.id
        ORDER BY s.updated_at DESC
        """,
        params,
    ).fetchall()
    return {
        int(row["ticket_id"]): _support_suggestion_row_to_dict(row)
        for row in rows
    }


def _json_dumps(value: Any) -> str:
    return json.dumps(value, sort_keys=True, default=str)


def _json_loads(value: str | None) -> Any:
    if not value:
        return None
    return json.loads(value)


def _agent_run_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "workflow_name": row["workflow_name"],
        "subject_type": row["subject_type"],
        "subject_id": row["subject_id"],
        "target_label": row["target_label"],
        "status": row["status"],
        "metadata": _json_loads(row["metadata_json"]) or {},
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "completed_at": row["completed_at"],
        "error": row["error"],
    }


def _agent_run_step_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "agent_run_id": row["agent_run_id"],
        "step_name": row["step_name"],
        "status": row["status"],
        "input": _json_loads(row["input_json"]),
        "output": _json_loads(row["output_json"]),
        "error": row["error"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _agent_approval_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "agent_run_id": row["agent_run_id"],
        "kind": row["kind"],
        "target_label": row["target_label"],
        "summary_text": row["summary_text"],
        "draft_content": _json_loads(row["draft_content_json"]) or {},
        "edited_content": _json_loads(row["edited_content_json"]) or {},
        "evidence": _json_loads(row["evidence_json"]) or {},
        "status": row["status"],
        "rejection_reason": row["rejection_reason"],
        "reviewer": row["reviewer"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "reviewed_at": row["reviewed_at"],
    }


def create_agent_run(
    conn: sqlite3.Connection,
    *,
    workflow_name: str,
    subject_type: str,
    subject_id: str,
    target_label: str | None,
    metadata: dict[str, Any],
    created_at: str,
    status: str = "running",
) -> dict[str, Any]:
    cursor = conn.execute(
        """
        INSERT INTO agent_runs
            (workflow_name, subject_type, subject_id, target_label, status, metadata_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            workflow_name,
            subject_type,
            subject_id,
            target_label,
            status,
            _json_dumps(metadata),
            created_at,
            created_at,
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM agent_runs WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    return _agent_run_row_to_dict(row)


def update_agent_run(
    conn: sqlite3.Connection,
    *,
    agent_run_id: int,
    status: str,
    updated_at: str,
    metadata: dict[str, Any] | None = None,
    completed_at: str | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    current = conn.execute(
        "SELECT * FROM agent_runs WHERE id = ?",
        (agent_run_id,),
    ).fetchone()
    if current is None:
        raise LookupError(f"Agent run {agent_run_id} was not found")
    merged_metadata = _json_loads(current["metadata_json"]) or {}
    if metadata:
        merged_metadata.update(metadata)
    conn.execute(
        """
        UPDATE agent_runs
        SET status = ?,
            metadata_json = ?,
            updated_at = ?,
            completed_at = COALESCE(?, completed_at),
            error = COALESCE(?, error)
        WHERE id = ?
        """,
        (
            status,
            _json_dumps(merged_metadata),
            updated_at,
            completed_at,
            error,
            agent_run_id,
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM agent_runs WHERE id = ?",
        (agent_run_id,),
    ).fetchone()
    return _agent_run_row_to_dict(row)


def get_agent_run(conn: sqlite3.Connection, agent_run_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT * FROM agent_runs WHERE id = ?",
        (agent_run_id,),
    ).fetchone()
    return _agent_run_row_to_dict(row) if row else None


def list_agent_runs(
    conn: sqlite3.Connection,
    *,
    status: str | None = None,
    workflow_name: str | None = None,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if status:
        clauses.append("status = ?")
        params.append(status)
    if workflow_name:
        clauses.append("workflow_name = ?")
        params.append(workflow_name)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"""
        SELECT *
        FROM agent_runs
        {where}
        ORDER BY updated_at DESC, id DESC
        """,
        params,
    ).fetchall()
    return [_agent_run_row_to_dict(row) for row in rows]


def create_agent_run_step(
    conn: sqlite3.Connection,
    *,
    agent_run_id: int,
    step_name: str,
    status: str,
    input_data: dict[str, Any] | None,
    output_data: dict[str, Any] | None,
    created_at: str,
) -> dict[str, Any]:
    cursor = conn.execute(
        """
        INSERT INTO agent_run_steps
            (agent_run_id, step_name, status, input_json, output_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            agent_run_id,
            step_name,
            status,
            _json_dumps(input_data) if input_data is not None else None,
            _json_dumps(output_data) if output_data is not None else None,
            created_at,
            created_at,
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM agent_run_steps WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    return _agent_run_step_row_to_dict(row)


def list_agent_run_steps(conn: sqlite3.Connection, agent_run_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT *
        FROM agent_run_steps
        WHERE agent_run_id = ?
        ORDER BY id ASC
        """,
        (agent_run_id,),
    ).fetchall()
    return [_agent_run_step_row_to_dict(row) for row in rows]


def create_agent_approval(
    conn: sqlite3.Connection,
    *,
    agent_run_id: int,
    kind: str,
    target_label: str | None,
    summary_text: str | None,
    draft_content: dict[str, Any],
    evidence: dict[str, Any],
    created_at: str,
) -> dict[str, Any]:
    cursor = conn.execute(
        """
        INSERT INTO agent_approvals
            (agent_run_id, kind, target_label, summary_text, draft_content_json, evidence_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            agent_run_id,
            kind,
            target_label,
            summary_text,
            _json_dumps(draft_content),
            _json_dumps(evidence),
            created_at,
            created_at,
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM agent_approvals WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    return _agent_approval_row_to_dict(row)


def update_agent_approval(
    conn: sqlite3.Connection,
    *,
    approval_id: int,
    status: str,
    updated_at: str,
    edited_content: dict[str, Any] | None = None,
    rejection_reason: str | None = None,
    reviewer: str | None = None,
    reviewed_at: str | None = None,
) -> dict[str, Any]:
    row = conn.execute(
        "SELECT * FROM agent_approvals WHERE id = ?",
        (approval_id,),
    ).fetchone()
    if row is None:
        raise LookupError(f"Agent approval {approval_id} was not found")
    conn.execute(
        """
        UPDATE agent_approvals
        SET status = ?,
            edited_content_json = COALESCE(?, edited_content_json),
            rejection_reason = COALESCE(?, rejection_reason),
            reviewer = COALESCE(?, reviewer),
            updated_at = ?,
            reviewed_at = COALESCE(?, reviewed_at)
        WHERE id = ?
        """,
        (
            status,
            _json_dumps(edited_content) if edited_content is not None else None,
            rejection_reason,
            reviewer,
            updated_at,
            reviewed_at,
            approval_id,
        ),
    )
    conn.commit()
    updated = conn.execute(
        "SELECT * FROM agent_approvals WHERE id = ?",
        (approval_id,),
    ).fetchone()
    return _agent_approval_row_to_dict(updated)


def get_agent_approval(conn: sqlite3.Connection, approval_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT * FROM agent_approvals WHERE id = ?",
        (approval_id,),
    ).fetchone()
    return _agent_approval_row_to_dict(row) if row else None


def list_agent_approvals(
    conn: sqlite3.Connection,
    *,
    view: str = "pending",
    kind: str | None = None,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if view == "pending":
        clauses.append("a.status = 'pending'")
    elif view == "history":
        clauses.append("a.status <> 'pending'")
    if kind:
        clauses.append("a.kind = ?")
        params.append(kind)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"""
        SELECT
            a.*,
            r.workflow_name,
            r.subject_type,
            r.subject_id,
            r.status AS run_status,
            r.metadata_json,
            r.created_at AS run_created_at,
            r.updated_at AS run_updated_at,
            r.completed_at AS run_completed_at,
            r.error AS run_error
        FROM agent_approvals a
        JOIN agent_runs r
          ON r.id = a.agent_run_id
        {where}
        ORDER BY a.updated_at DESC, a.id DESC
        """,
        params,
    ).fetchall()
    approvals: list[dict[str, Any]] = []
    for row in rows:
        approval = _agent_approval_row_to_dict(row)
        approval["run"] = {
            "id": row["agent_run_id"],
            "workflow_name": row["workflow_name"],
            "subject_type": row["subject_type"],
            "subject_id": row["subject_id"],
            "status": row["run_status"],
            "metadata": _json_loads(row["metadata_json"]) or {},
            "created_at": row["run_created_at"],
            "updated_at": row["run_updated_at"],
            "completed_at": row["run_completed_at"],
            "error": row["run_error"],
        }
        approvals.append(approval)
    return approvals


def has_pending_agent_approval(
    conn: sqlite3.Connection,
    *,
    kind: str,
    subject_type: str,
    subject_id: str,
) -> bool:
    row = conn.execute(
        """
        SELECT 1
        FROM agent_approvals a
        JOIN agent_runs r
          ON r.id = a.agent_run_id
        WHERE a.kind = ?
          AND a.status = 'pending'
          AND r.subject_type = ?
          AND r.subject_id = ?
        LIMIT 1
        """,
        (kind, subject_type, subject_id),
    ).fetchone()
    return row is not None
