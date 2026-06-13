from tasks.beszel_server_status.beszel import (
    normalize_alert,
    normalize_alert_history,
    normalize_container,
    normalize_system,
    normalize_system_stat,
)


def test_normalize_system_extracts_info_fields():
    record = {
        "id": "abc123",
        "name": "prod-web-01",
        "host": "10.0.0.1",
        "status": "up",
        "port": "8090",
        "info": {"cpu": 0.16, "mp": 10.74, "dp": 41.19},
        "created": "2026-01-01 00:00:00",
        "updated": "2026-06-13 07:02:07",
    }
    result = normalize_system(record)
    assert result["id"] == "abc123"
    assert result["name"] == "prod-web-01"
    assert result["host"] == "10.0.0.1"
    assert result["status"] == "up"
    assert result["info"]["cpu"] == 0.16
    assert result["raw"] == record


def test_normalize_system_fallback_name():
    record = {"id": "xyz", "status": "down"}
    result = normalize_system(record)
    assert result["name"] == "system-xyz"


def test_normalize_container_preserves_fields():
    record = {"id": "c1", "name": "nginx", "system": "s1", "status": "Up 4 weeks", "image": "nginx:latest", "cpu": 0.5, "memory": 12.3, "health": 0}
    result = normalize_container(record)
    assert result["system"] == "s1"
    assert result["status"] == "Up 4 weeks"
    assert result["image"] == "nginx:latest"
    assert result["cpu"] == 0.5


def test_normalize_alert_uses_triggered():
    result = normalize_alert({"id": "a1", "system": "s1", "name": "Disk", "triggered": True, "value": 80, "min": 10})
    assert result["triggered"] is True
    assert result["name"] == "Disk"


def test_normalize_alert_history_marks_unresolved():
    result = normalize_alert_history({"id": "h1", "system": "s1", "resolved": False})
    assert result["resolved"] is False


def test_normalize_system_stat_extracts_stats():
    record = {
        "id": "st1",
        "system": "s1",
        "type": "1m",
        "stats": {"cpu": 0.35, "mp": 14.93, "dp": 7.32, "mu": 1.08},
        "created": "2026-06-13 00:00:00",
    }
    result = normalize_system_stat(record)
    assert result["cpu"] == 0.35
    assert result["mem_percent"] == 14.93
    assert result["disk_percent"] == 7.32
    assert result["type"] == "1m"