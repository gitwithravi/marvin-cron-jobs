from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Protocol

from marvin_core.env import require_env
from tasks.beszel_server_status.beszel import BeszelClient


class BeszelClientProtocol(Protocol):
    def authenticate(self) -> None: ...

    def fetch_systems(self) -> list[dict[str, Any]]: ...

    def fetch_containers(self) -> list[dict[str, Any]]: ...

    def fetch_alerts(self) -> list[dict[str, Any]]: ...

    def fetch_alert_history(self, lookback_hours: int = 24) -> list[dict[str, Any]]: ...

    def fetch_system_stats(self, system_id: str, lookback_hours: int = 1) -> list[dict[str, Any]]: ...

    def close(self) -> None: ...


def _round_metric(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    return None


def _system_name_map(systems: list[dict[str, Any]]) -> dict[str, str]:
    return {
        str(system.get("id")): str(system.get("name") or f"system-{system.get('id')}")
        for system in systems
        if system.get("id") is not None
    }


def build_beszel_live_payload(
    *,
    client: BeszelClientProtocol,
    alert_history_lookback_hours: int = 24,
    system_stats_lookback_hours: int = 1,
) -> dict[str, Any]:
    systems = client.fetch_systems()
    containers = client.fetch_containers()
    alerts = client.fetch_alerts()
    alert_history = client.fetch_alert_history(alert_history_lookback_hours)

    stats_by_system: dict[str, list[dict[str, Any]]] = {}
    for system in systems:
        system_id = system.get("id")
        if not system_id:
            continue
        stats = client.fetch_system_stats(str(system_id), system_stats_lookback_hours)
        stats_by_system[str(system_id)] = sorted(
            stats,
            key=lambda stat: str(stat.get("created") or stat.get("updated") or ""),
        )

    system_names = _system_name_map(systems)
    containers_by_system: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for container in containers:
        containers_by_system[str(container.get("system"))].append(container)

    alerts_by_system: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for alert in alerts:
        alerts_by_system[str(alert.get("system"))].append(alert)

    status_counts = Counter(str(system.get("status") or "unknown") for system in systems)
    container_status_counts = Counter(str(container.get("status") or "unknown") for container in containers)
    triggered_alerts = [alert for alert in alerts if alert.get("triggered")]
    unresolved_history = [entry for entry in alert_history if not entry.get("resolved")]

    system_payloads = []
    for system in systems:
        system_id = str(system.get("id") or "")
        stats = stats_by_system.get(system_id, [])
        latest_stat = stats[-1] if stats else None
        info = system.get("info") or {}
        system_payloads.append(
            {
                "id": system_id,
                "name": system.get("name") or f"system-{system_id}",
                "host": system.get("host"),
                "status": system.get("status") or "unknown",
                "updated": system.get("updated"),
                "latest": {
                    "cpu": _round_metric(latest_stat.get("cpu") if latest_stat else info.get("cpu")),
                    "memory": _round_metric(
                        latest_stat.get("mem_percent") if latest_stat else info.get("mp")
                    ),
                    "disk": _round_metric(
                        latest_stat.get("disk_percent") if latest_stat else info.get("dp")
                    ),
                    "load": _round_metric(latest_stat.get("load_avg") if latest_stat else None),
                },
                "series": [
                    {
                        "created": stat.get("created") or stat.get("updated"),
                        "cpu": _round_metric(stat.get("cpu")),
                        "memory": _round_metric(stat.get("mem_percent")),
                        "disk": _round_metric(stat.get("disk_percent")),
                    }
                    for stat in stats
                ],
                "containers": containers_by_system.get(system_id, []),
                "alerts": alerts_by_system.get(system_id, []),
            }
        )

    return {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "systemCount": len(systems),
            "containerCount": len(containers),
            "triggeredAlertCount": len(triggered_alerts),
            "unresolvedAlertHistoryCount": len(unresolved_history),
            "systemStatusCounts": dict(status_counts),
            "containerStatusCounts": dict(container_status_counts),
        },
        "systems": system_payloads,
        "containers": [
            {
                **container,
                "systemName": system_names.get(str(container.get("system"))),
            }
            for container in containers
        ],
        "alerts": [
            {
                **alert,
                "systemName": system_names.get(str(alert.get("system"))),
            }
            for alert in alerts
        ],
        "alertHistory": [
            {
                **entry,
                "systemName": system_names.get(str(entry.get("system"))),
            }
            for entry in alert_history
        ],
        "windows": {
            "alertHistoryHours": alert_history_lookback_hours,
            "systemStatsHours": system_stats_lookback_hours,
        },
    }


def fetch_beszel_live_payload() -> dict[str, Any]:
    client = BeszelClient(
        require_env("BESZEL_URL"),
        require_env("BESZEL_EMAIL"),
        require_env("BESZEL_PASSWORD"),
    )
    try:
        client.authenticate()
        return build_beszel_live_payload(client=client)
    finally:
        client.close()
