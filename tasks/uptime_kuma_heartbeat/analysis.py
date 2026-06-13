import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


STATUS_LABELS = {
    0: "down",
    1: "up",
    2: "pending",
    3: "maintenance",
}


def status_label(status: Any) -> str:
    return STATUS_LABELS.get(status, str(status))


def build_factual_payload(
    *,
    task_name: str,
    observed_at: str,
    lookback_hours: int,
    monitors: list[dict[str, Any]],
    heartbeats: list[dict[str, Any]],
) -> dict[str, Any]:
    heartbeats_by_monitor: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for heartbeat in heartbeats:
        heartbeats_by_monitor[heartbeat["monitor_id"]].append(heartbeat)

    monitor_summaries = []
    for monitor in monitors:
        monitor_beats = sorted(
            heartbeats_by_monitor.get(monitor["id"], []),
            key=lambda item: item.get("time") or "",
            reverse=True,
        )
        latest_heartbeat = monitor_beats[0] if monitor_beats else None
        current_status = monitor.get("status")
        if current_status is None and latest_heartbeat:
            current_status = latest_heartbeat.get("status")
        status_counts = Counter(status_label(beat.get("status")) for beat in monitor_beats)
        pings = [beat["ping"] for beat in monitor_beats if isinstance(beat.get("ping"), int | float)]
        monitor_summaries.append(
            {
                "id": monitor["id"],
                "name": monitor["name"],
                "type": monitor.get("type"),
                "url": monitor.get("url"),
                "current_status": status_label(current_status),
                "heartbeat_count": len(monitor_beats),
                "status_counts": dict(status_counts),
                "latest_heartbeat": latest_heartbeat,
                "average_ping_ms": round(sum(pings) / len(pings), 2) if pings else None,
                "max_ping_ms": max(pings) if pings else None,
            }
        )

    fleet_counts = Counter(item["current_status"] for item in monitor_summaries)
    return {
        "task_name": task_name,
        "observed_at": observed_at,
        "lookback_hours": lookback_hours,
        "monitor_count": len(monitors),
        "heartbeat_count": len(heartbeats),
        "fleet_status_counts": dict(fleet_counts),
        "monitors": monitor_summaries,
    }


def build_messages(
    *,
    prompts_dir: Path,
    communication_style: str,
    factual_payload: dict[str, Any],
) -> list[dict[str, str]]:
    system_prompt = (prompts_dir / "system.md").read_text(encoding="utf-8")
    user_template = (prompts_dir / "user.md").read_text(encoding="utf-8")
    return [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": user_template.format(
                communication_style=communication_style,
                payload=json.dumps(factual_payload, indent=2, sort_keys=True, default=str),
            ),
        },
    ]


def dry_run_analysis(factual_payload: dict[str, Any]) -> dict[str, Any]:
    down_count = factual_payload.get("fleet_status_counts", {}).get("down", 0)
    risk_level = "high" if down_count else "low"
    if down_count:
        summary = f"{down_count} monitor(s) are currently down in the collected Uptime Kuma data."
        actions = ["Inspect the down monitors in Uptime Kuma and confirm whether the outage is expected."]
    else:
        summary = "All collected monitors are currently reporting as up or non-down."
        actions = ["No immediate action required based on the collected heartbeat data."]

    return {
        "summary": summary,
        "recommended_actions": actions,
        "risk_level": risk_level,
        "notable_facts": [
            f"Collected {factual_payload.get('monitor_count', 0)} monitor(s).",
            f"Collected {factual_payload.get('heartbeat_count', 0)} heartbeat row(s).",
        ],
    }
