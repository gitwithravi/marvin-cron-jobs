import json
from collections import Counter
from pathlib import Path
from typing import Any


def build_factual_payload(
    *,
    task_name: str,
    observed_at: str,
    alert_history_lookback_hours: int,
    systems: list[dict[str, Any]],
    containers: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    alert_history: list[dict[str, Any]],
    system_stats: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    system_status_counts = Counter(s.get("status", "unknown") for s in systems)
    container_status_counts = Counter(c.get("status", "unknown") for c in containers)
    triggered_alert_count = sum(1 for a in alerts if a.get("triggered"))
    unresolved_history = [h for h in alert_history if not h.get("resolved")]

    system_summaries = []
    for system in systems:
        system_id = system.get("id", "")
        stats = system_stats.get(system_id, [])
        latest_stat = stats[0] if stats else None
        info = system.get("info") or {}
        system_summaries.append({
            "id": system_id,
            "name": system.get("name"),
            "host": system.get("host"),
            "status": system.get("status"),
            "info_cpu": info.get("cpu"),
            "info_mem_percent": info.get("mp"),
            "info_disk_percent": info.get("dp"),
            "latest_stat": latest_stat,
            "stat_count": len(stats),
        })

    container_summaries = []
    for container in containers:
        container_summaries.append({
            "id": container.get("id"),
            "name": container.get("name"),
            "system": container.get("system"),
            "status": container.get("status"),
            "image": container.get("image"),
            "cpu": container.get("cpu"),
            "memory": container.get("memory"),
            "health": container.get("health"),
        })

    alert_summaries = []
    for alert in alerts:
        alert_summaries.append({
            "id": alert.get("id"),
            "system": alert.get("system"),
            "name": alert.get("name"),
            "triggered": alert.get("triggered"),
            "value": alert.get("value"),
            "min": alert.get("min"),
        })

    alert_history_summaries = []
    for entry in alert_history:
        alert_history_summaries.append({
            "id": entry.get("id"),
            "system": entry.get("system"),
            "alert": entry.get("alert"),
            "type": entry.get("type"),
            "value": entry.get("value"),
            "resolved": entry.get("resolved"),
            "created": entry.get("created"),
        })

    return {
        "task_name": task_name,
        "observed_at": observed_at,
        "alert_history_lookback_hours": alert_history_lookback_hours,
        "system_count": len(systems),
        "container_count": len(containers),
        "system_status_counts": dict(system_status_counts),
        "container_status_counts": dict(container_status_counts),
        "triggered_alert_count": triggered_alert_count,
        "unresolved_alert_history_count": len(unresolved_history),
        "systems": system_summaries,
        "containers": container_summaries,
        "alerts": alert_summaries,
        "alert_history": alert_history_summaries,
    }


def compute_risk_level(factual_payload: dict[str, Any]) -> str:
    system_status_counts = factual_payload.get("system_status_counts", {})
    triggered_alert_count = factual_payload.get("triggered_alert_count", 0)
    unresolved_history_count = factual_payload.get("unresolved_alert_history_count", 0)

    down_count = system_status_counts.get("down", 0)
    if isinstance(down_count, str):
        down_count = int(down_count) if down_count.isdigit() else 0

    if down_count > 0 and triggered_alert_count > 0:
        return "critical"

    if down_count > 0:
        return "high"

    if triggered_alert_count > 0:
        return "medium"

    if unresolved_history_count > 0:
        return "medium"

    return "low"


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
    risk_level = compute_risk_level(factual_payload)
    down_count = factual_payload.get("system_status_counts", {}).get("down", 0)
    triggered_alert_count = factual_payload.get("triggered_alert_count", 0)

    if down_count and triggered_alert_count:
        summary = f"{down_count} system(s) are down with {triggered_alert_count} triggered alert(s). The infrastructure has opinions about reliability, and they are negative."
        actions = [
            "Inspect down systems in Beszel and verify whether outages are expected.",
            "Review triggered alerts for threshold breaches and correlate with down systems.",
        ]
    elif down_count:
        summary = f"{down_count} system(s) are currently down. No triggered alerts, which either means alerting is misconfigured or the silence is suspicious."
        actions = ["Inspect down systems in Beszel and confirm whether outages are expected."]
    elif triggered_alert_count:
        summary = f"All systems nominally up, but {triggered_alert_count} triggered alert(s) require attention. Up does not mean fine."
        actions = ["Review triggered alerts in Beszel for threshold breaches on otherwise-up systems."]
    else:
        summary = "All systems are up with no triggered alerts. A rare moment of operational competence."
        actions = ["No immediate action required. Continue monitoring."]

    notable_facts = [
        f"Collected {factual_payload.get('system_count', 0)} system(s).",
        f"Collected {factual_payload.get('container_count', 0)} container(s).",
        f"Triggered alerts: {triggered_alert_count}.",
    ]

    unresolved = factual_payload.get("unresolved_alert_history_count", 0)
    if unresolved:
        notable_facts.append(f"Unresolved alert history entries: {unresolved}.")

    return {
        "summary": summary,
        "recommended_actions": actions,
        "risk_level": risk_level,
        "notable_facts": notable_facts,
    }