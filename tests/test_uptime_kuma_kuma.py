from datetime import timezone

from tasks.uptime_kuma_heartbeat.kuma import (
    normalize_heartbeat,
    normalize_monitor,
    parse_kuma_time,
)


def test_parse_kuma_time_handles_z_suffix():
    parsed = parse_kuma_time("2026-06-13T00:00:00Z")
    assert parsed.tzinfo == timezone.utc


def test_normalize_monitor_uses_hostname_fallback():
    monitor = normalize_monitor({"id": 7, "hostname": "example.com", "status": 1})
    assert monitor["name"] == "monitor-7"
    assert monitor["url"] == "example.com"


def test_normalize_heartbeat_accepts_common_time_and_message_fields():
    heartbeat = normalize_heartbeat(
        7,
        {"dateTime": "2026-06-13T00:00:00Z", "status": 0, "msg": "timeout", "ping": None},
    )
    assert heartbeat["monitor_id"] == 7
    assert heartbeat["time"] == "2026-06-13T00:00:00Z"
    assert heartbeat["message"] == "timeout"

