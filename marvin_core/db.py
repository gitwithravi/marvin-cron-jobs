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
    conn.commit()


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
