from dataclasses import dataclass
from pathlib import Path
from typing import Any

from marvin_core.notifications.telegram import send_telegram_message
from marvin_core.risk import normalize_risk_level, risk_meets_threshold


@dataclass(frozen=True)
class NotificationResult:
    channel: str
    status: str
    detail: str


def should_dispatch_notifications(risk_level: str, config: dict[str, Any]) -> bool:
    if not config.get("enabled", False):
        return False
    threshold = config.get("risk_threshold", "high")
    return risk_meets_threshold(risk_level, threshold)


def build_notification_message(
    *,
    task_name: str,
    risk_level: str,
    summary: str,
    report_path: str | Path | None = None,
) -> str:
    lines = [
        f"MARVIN alert: {task_name}",
        f"Risk: {normalize_risk_level(risk_level)}",
        "",
        summary.strip() or "No summary returned. A bold strategy from the machine.",
    ]
    if report_path:
        lines.extend(["", f"Report: {report_path}"])
    return "\n".join(lines)


def dispatch_notifications(
    *,
    task_name: str,
    risk_level: str,
    analysis: dict[str, Any],
    report_path: str | Path | None,
    config: dict[str, Any] | None,
) -> list[NotificationResult]:
    notification_config = config or {}
    risk = normalize_risk_level(risk_level)
    if not should_dispatch_notifications(risk, notification_config):
        return []

    channels = notification_config.get("channels") or []
    if isinstance(channels, str):
        channels = [channels]

    message = build_notification_message(
        task_name=task_name,
        risk_level=risk,
        summary=str(analysis.get("summary", "")),
        report_path=report_path if notification_config.get("include_report_path", True) else None,
    )

    results: list[NotificationResult] = []
    for channel in channels:
        if channel == "telegram":
            telegram_result = send_telegram_message(message)
            results.append(
                NotificationResult(
                    channel=telegram_result.channel,
                    status="sent" if telegram_result.delivered else "failed",
                    detail=telegram_result.detail,
                )
            )
        elif channel == "console":
            print(message)
            results.append(NotificationResult(channel="console", status="sent", detail="printed"))
        else:
            raise ValueError(f"Unsupported notification channel: {channel}")

    return results

