import sqlite3

from marvin_core.db import (
    connect,
    create_task_run,
    insert_beszel_alert_history_observations,
    insert_beszel_alert_observations,
    insert_beszel_system_snapshots,
    insert_heartbeat_observations,
    insert_monitor_snapshots,
    insert_report,
    migrate,
)


def test_db_migration_and_inserts(tmp_path):
    conn = connect(tmp_path / "marvin.sqlite3")
    migrate(conn)

    run_id = create_task_run(conn, "uptime_kuma_heartbeat", "2026-06-13T00:00:00+00:00")
    insert_monitor_snapshots(
        conn,
        run_id,
        "2026-06-13T00:00:00+00:00",
        [{"id": 1, "name": "API", "type": "http", "url": "https://example.com", "status": 1}],
    )
    insert_heartbeat_observations(
        conn,
        run_id,
        "2026-06-13T00:00:00+00:00",
        [{"monitor_id": 1, "time": "2026-06-13T00:00:00+00:00", "status": 1, "ping": 42}],
    )
    insert_report(
        conn,
        run_id,
        "uptime_kuma_heartbeat",
        "2026-06-13T00:00:01+00:00",
        "reports/example.md",
        "dry-run",
        {"summary": "ok"},
    )

    counts = {
        table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in ["task_runs", "monitor_snapshots", "heartbeat_observations", "reports"]
    }
    assert counts == {
        "task_runs": 1,
        "monitor_snapshots": 1,
        "heartbeat_observations": 1,
        "reports": 1,
    }

    conn.close()


def test_migration_is_idempotent(tmp_path):
    conn = connect(tmp_path / "marvin.sqlite3")
    migrate(conn)
    migrate(conn)
    assert isinstance(conn, sqlite3.Connection)
    conn.close()


def test_beszel_db_inserts(tmp_path):
    conn = connect(tmp_path / "marvin.sqlite3")
    migrate(conn)

    run_id = create_task_run(conn, "beszel_server_status", "2026-06-13T00:00:00+00:00")

    insert_beszel_system_snapshots(
        conn,
        run_id,
        "2026-06-13T00:00:00+00:00",
        [{"id": "sys1", "name": "prod-web-01", "host": "10.0.0.1", "status": "up", "raw": {"status": "up"}}],
    )
    insert_beszel_alert_observations(
        conn,
        run_id,
        "2026-06-13T00:00:00+00:00",
        [{"id": "a1", "system": "sys1", "name": "Disk", "triggered": True, "value": 80, "min": 10, "raw": {"triggered": True}}],
    )
    insert_beszel_alert_history_observations(
        conn,
        run_id,
        "2026-06-13T00:00:00+00:00",
        [{"id": "h1", "system": "sys1", "alert": "a1", "type": "cpu", "value": "95", "resolved": False, "created": "2026-06-13T00:00:00Z", "raw": {"resolved": False}}],
    )

    counts = {
        table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in ["beszel_system_snapshots", "beszel_alert_observations", "beszel_alert_history_observations"]
    }
    assert counts == {
        "beszel_system_snapshots": 1,
        "beszel_alert_observations": 1,
        "beszel_alert_history_observations": 1,
    }

    conn.close()

