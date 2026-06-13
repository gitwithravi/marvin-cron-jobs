from datetime import datetime, timedelta, timezone
from typing import Any

from uptime_kuma_api import UptimeKumaApi


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    if hasattr(value, "__dict__"):
        return dict(value.__dict__)
    raise TypeError(f"Cannot convert {type(value).__name__} to dict")


class KumaHeartbeatClient:
    def __init__(self, url: str, username: str, password: str) -> None:
        self.url = url
        self.username = username
        self.password = password
        self.api = UptimeKumaApi(url)

    def __enter__(self) -> "KumaHeartbeatClient":
        self.api.login(self.username, self.password)
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.api.disconnect()

    def fetch(self, lookback_hours: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        monitors = [_as_dict(monitor) for monitor in self.api.get_monitors()]
        since = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
        heartbeats: list[dict[str, Any]] = []

        for monitor in monitors:
            monitor_id = monitor["id"]
            beats = self.api.get_monitor_beats(monitor_id, 24 * lookback_hours)
            for beat in beats:
                normalized = normalize_heartbeat(monitor_id, _as_dict(beat))
                if not normalized.get("time") or parse_kuma_time(normalized["time"]) >= since:
                    heartbeats.append(normalized)

        return [normalize_monitor(monitor) for monitor in monitors], heartbeats


def parse_kuma_time(value: str) -> datetime:
    cleaned = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(cleaned)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def normalize_monitor(monitor: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": monitor.get("id"),
        "name": monitor.get("name") or f"monitor-{monitor.get('id')}",
        "type": monitor.get("type"),
        "url": monitor.get("url") or monitor.get("hostname"),
        "status": monitor.get("status"),
        "active": monitor.get("active"),
        "raw": monitor,
    }


def normalize_heartbeat(monitor_id: int, heartbeat: dict[str, Any]) -> dict[str, Any]:
    return {
        "monitor_id": monitor_id,
        "time": heartbeat.get("time") or heartbeat.get("dateTime") or heartbeat.get("createdDate"),
        "status": heartbeat.get("status"),
        "ping": heartbeat.get("ping"),
        "message": heartbeat.get("msg") or heartbeat.get("message"),
        "duration": heartbeat.get("duration"),
        "raw": heartbeat,
    }

