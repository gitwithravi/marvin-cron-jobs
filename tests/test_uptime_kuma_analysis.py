import json

from tasks.uptime_kuma_heartbeat.analysis import (
    build_factual_payload,
    build_messages,
    dry_run_analysis,
)


def test_build_factual_payload_groups_heartbeats_by_monitor():
    payload = build_factual_payload(
        task_name="uptime_kuma_heartbeat",
        observed_at="2026-06-13T00:00:00+00:00",
        lookback_hours=24,
        monitors=[
            {"id": 1, "name": "API", "type": "http", "url": "https://api.example.com", "status": 1},
            {"id": 2, "name": "Worker", "type": "ping", "url": None, "status": 0},
        ],
        heartbeats=[
            {"monitor_id": 1, "time": "2026-06-13T00:00:00+00:00", "status": 1, "ping": 30},
            {"monitor_id": 1, "time": "2026-06-12T23:59:00+00:00", "status": 1, "ping": 50},
            {"monitor_id": 2, "time": "2026-06-13T00:00:00+00:00", "status": 0, "ping": None},
        ],
    )

    assert payload["monitor_count"] == 2
    assert payload["heartbeat_count"] == 3
    assert payload["fleet_status_counts"] == {"up": 1, "down": 1}
    assert payload["monitors"][0]["average_ping_ms"] == 40
    assert payload["monitors"][1]["status_counts"] == {"down": 1}


def test_build_factual_payload_uses_latest_heartbeat_when_monitor_status_missing():
    payload = build_factual_payload(
        task_name="uptime_kuma_heartbeat",
        observed_at="2026-06-13T00:00:00+00:00",
        lookback_hours=24,
        monitors=[
            {"id": 1, "name": "API", "type": "http", "url": "https://api.example.com", "status": None},
        ],
        heartbeats=[
            {"monitor_id": 1, "time": "2026-06-13T00:00:00+00:00", "status": 1, "ping": 30},
        ],
    )

    assert payload["fleet_status_counts"] == {"up": 1}
    assert payload["monitors"][0]["current_status"] == "up"


def test_build_messages_includes_communication_style_and_payload(tmp_path):
    prompts = tmp_path / "prompts"
    prompts.mkdir()
    (prompts / "system.md").write_text("system", encoding="utf-8")
    (prompts / "user.md").write_text(
        "Style={communication_style}\nPayload={payload}",
        encoding="utf-8",
    )

    messages = build_messages(
        prompts_dir=prompts,
        communication_style="be factual but sardonic",
        factual_payload={"monitor_count": 1},
    )

    assert messages[0] == {"role": "system", "content": "system"}
    assert "be factual but sardonic" in messages[1]["content"]
    assert json.dumps({"monitor_count": 1}, indent=2, sort_keys=True) in messages[1]["content"]


def test_dry_run_analysis_reports_down_monitors():
    analysis = dry_run_analysis(
        {
            "fleet_status_counts": {"down": 1},
            "monitor_count": 2,
            "heartbeat_count": 10,
        }
    )

    assert analysis["risk_level"] == "high"
    assert "currently down" in analysis["summary"]
    assert analysis["recommended_actions"]
