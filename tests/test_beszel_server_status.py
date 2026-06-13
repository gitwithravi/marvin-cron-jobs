import json

from tasks.beszel_server_status.analysis import (
    build_factual_payload,
    build_messages,
    compute_risk_level,
    dry_run_analysis,
)


def test_build_factual_payload_groups_systems_and_containers():
    payload = build_factual_payload(
        task_name="beszel_server_status",
        observed_at="2026-06-13T00:00:00+00:00",
        alert_history_lookback_hours=24,
        systems=[
            {"id": "s1", "name": "prod-web", "host": "10.0.0.1", "status": "up", "info": {"cpu": 0.16, "mp": 10.74, "dp": 41.19}},
            {"id": "s2", "name": "staging-db", "host": "10.0.0.2", "status": "down", "info": {}},
        ],
        containers=[
            {"id": "c1", "name": "nginx", "system": "s1", "status": "Up 4 weeks", "image": "nginx:latest", "cpu": 0.5, "memory": 12.3, "health": 0},
        ],
        alerts=[
            {"id": "a1", "system": "s2", "name": "Disk", "triggered": True, "value": 80, "min": 10},
        ],
        alert_history=[
            {"id": "h1", "system": "s2", "alert": "a1", "type": "disk", "value": "95", "resolved": False, "created": "2026-06-13T00:00:00Z"},
        ],
        system_stats={
            "s1": [{"id": "st1", "system": "s1", "type": "1m", "cpu": 0.35, "mem_percent": 7.21, "disk_percent": 93.07, "created": "2026-06-13T00:00:00Z"}],
        },
    )

    assert payload["system_count"] == 2
    assert payload["container_count"] == 1
    assert payload["system_status_counts"] == {"up": 1, "down": 1}
    assert payload["container_status_counts"] == {"Up 4 weeks": 1}
    assert payload["triggered_alert_count"] == 1
    assert payload["unresolved_alert_history_count"] == 1
    assert len(payload["systems"]) == 2
    assert payload["systems"][0]["info_cpu"] == 0.16
    assert payload["systems"][0]["latest_stat"]["cpu"] == 0.35


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
        factual_payload={"system_count": 1},
    )

    assert messages[0] == {"role": "system", "content": "system"}
    assert "be factual but sardonic" in messages[1]["content"]
    assert json.dumps({"system_count": 1}, indent=2, sort_keys=True) in messages[1]["content"]


def test_compute_risk_critical_when_down_with_triggered_alerts():
    payload = {
        "system_status_counts": {"down": 1, "up": 2},
        "triggered_alert_count": 2,
        "unresolved_alert_history_count": 3,
    }
    assert compute_risk_level(payload) == "critical"


def test_compute_risk_high_when_down_no_alerts():
    payload = {
        "system_status_counts": {"down": 1, "up": 2},
        "triggered_alert_count": 0,
        "unresolved_alert_history_count": 0,
    }
    assert compute_risk_level(payload) == "high"


def test_compute_risk_medium_when_triggered_alerts_but_all_up():
    payload = {
        "system_status_counts": {"up": 3},
        "triggered_alert_count": 2,
        "unresolved_alert_history_count": 0,
    }
    assert compute_risk_level(payload) == "medium"


def test_compute_risk_medium_with_unresolved_history():
    payload = {
        "system_status_counts": {"up": 3},
        "triggered_alert_count": 0,
        "unresolved_alert_history_count": 5,
    }
    assert compute_risk_level(payload) == "medium"


def test_compute_risk_low_when_clean():
    payload = {
        "system_status_counts": {"up": 3},
        "triggered_alert_count": 0,
        "unresolved_alert_history_count": 0,
    }
    assert compute_risk_level(payload) == "low"


def test_dry_run_analysis_down_systems_with_alerts():
    analysis = dry_run_analysis({
        "system_status_counts": {"down": 1, "up": 2},
        "system_count": 3,
        "container_count": 5,
        "triggered_alert_count": 2,
        "unresolved_alert_history_count": 0,
    })
    assert analysis["risk_level"] == "critical"
    assert "down" in analysis["summary"].lower()
    assert len(analysis["recommended_actions"]) > 0


def test_dry_run_analysis_all_clean():
    analysis = dry_run_analysis({
        "system_status_counts": {"up": 3},
        "system_count": 3,
        "container_count": 5,
        "triggered_alert_count": 0,
        "unresolved_alert_history_count": 0,
    })
    assert analysis["risk_level"] == "low"
    assert "No immediate action" in analysis["recommended_actions"][0]