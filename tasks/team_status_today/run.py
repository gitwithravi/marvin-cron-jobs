import argparse
import os
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from marvin_core.config import load_yaml
from marvin_core.communication_style import load_communication_style
from marvin_core.db import (
    connect,
    create_task_run,
    finish_task_run,
    insert_report,
    insert_team_status_member_snapshots,
    insert_team_status_task_observations,
    migrate,
)
from marvin_core.env import load_root_env, require_env
from marvin_core.notifications.dispatcher import dispatch_notifications
from marvin_core.openrouter import OpenRouterClient
from marvin_core.paths import ROOT_DIR, project_path
from marvin_core.report import write_markdown_report
from marvin_core.risk import normalize_risk_level
from tasks.team_status_today.analysis import (
    build_factual_payload,
    build_messages,
    compute_risk_level,
    dry_run_analysis,
    group_tasks_by_member,
)
from tasks.team_status_today.client import (
    TeamStatusAPIError,
    TeamStatusAuthError,
    TeamStatusClient,
    TeamStatusServerKeyError,
    today_utc,
)


TASK_DIR = Path(__file__).resolve().parent


PLACEHOLDER_TOKENS = (
    "your-api-key-here",
    "your-api-key",
    "your-key",
    "your-key-here",
    "changeme",
    "change-me",
    "replace-me",
    "replace_me",
    "placeholder",
    "example.com",
    "todo",
)


def _is_placeholder(value: str) -> bool:
    candidate = value.strip()
    if not candidate:
        return True
    lowered = candidate.lower()
    if lowered in {"null", "none", "nil"}:
        return True
    return any(token in lowered for token in PLACEHOLDER_TOKENS)


def _require_real_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            "The team_status_today task refuses to run without it. "
            "A small mercy."
        )
    if _is_placeholder(value):
        raise RuntimeError(
            f"{name} is set to a placeholder value ({value!r}). "
            "The team_status_today task refuses to run with placeholders. "
            "A small mercy."
        )
    return value


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def timestamp_slug(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%d_%H%M%S")


def validate_config(config: dict[str, Any]) -> None:
    required = ["task_name", "model", "database_path", "report_dir"]
    missing = [key for key in required if not config.get(key)]
    if missing:
        raise RuntimeError(f"Missing required task config keys: {', '.join(missing)}")
    if config["model"] == "REPLACE_WITH_OPENROUTER_MODEL_SLUG":
        raise RuntimeError("Set tasks/team_status_today/config.yaml model before live runs")
    for key in ("request_timeout_seconds", "request_max_retries", "request_backoff_factor"):
        if key in config and config[key] is None:
            raise RuntimeError(f"Task config key {key!r} must not be null")


def _relative_report_path(report_path: Path) -> Path:
    if report_path.is_absolute() and report_path.is_relative_to(ROOT_DIR):
        return report_path.relative_to(ROOT_DIR)
    return report_path


def run_task(*, dry_run: bool = False, date: str | None = None) -> Path:
    load_root_env()
    config = load_yaml(TASK_DIR / "config.yaml")
    if dry_run and config.get("model") == "REPLACE_WITH_OPENROUTER_MODEL_SLUG":
        config["model"] = "dry-run"
    validate_config(config)

    started = utc_now()
    observed_at = started.isoformat()
    work_date = date or today_utc()

    conn = connect(config["database_path"])
    migrate(conn)
    run_id = create_task_run(conn, config["task_name"], observed_at)

    try:
        api_url = _require_real_env("TEAM_STATUS_API_URL")
        api_key = _require_real_env("TEAM_STATUS_API_KEY")

        timeout_seconds = int(config.get("request_timeout_seconds", 30))
        max_retries = int(config.get("request_max_retries", 3))
        backoff_factor = float(config.get("request_backoff_factor", 0.5))

        with TeamStatusClient(
            api_url,
            api_key,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            backoff_factor=backoff_factor,
        ) as client:
            members = client.fetch_team_members()
            tasks_by_member: dict[int, list[dict[str, Any]]] = {
                member["id"]: client.fetch_tasks(member["id"], work_date)
                for member in members
            }

        all_tasks = [task for tasks in tasks_by_member.values() for task in tasks]

        insert_team_status_member_snapshots(conn, run_id, observed_at, members)
        insert_team_status_task_observations(conn, run_id, observed_at, all_tasks)

        factual_payload = build_factual_payload(
            task_name=config["task_name"],
            observed_at=observed_at,
            date=work_date,
            members=members,
            tasks_by_member=tasks_by_member,
        )
        risk_level = compute_risk_level(factual_payload)

        if dry_run:
            analysis = dry_run_analysis(factual_payload)
        else:
            communication_style = load_communication_style()
            messages = build_messages(
                prompts_dir=TASK_DIR / "prompts",
                communication_style=communication_style,
                factual_payload=factual_payload,
            )
            openrouter = OpenRouterClient(require_env("OPENROUTER_API_KEY"))
            llm_config = config.get("openrouter") or {}
            analysis = openrouter.chat_json(
                model=config["model"],
                messages=messages,
                temperature=float(llm_config.get("temperature", 0.2)),
                max_tokens=int(llm_config.get("max_tokens", 1200)),
            )
            analysis["risk_level"] = risk_level

        analysis["risk_level"] = normalize_risk_level(analysis.get("risk_level", risk_level))

        report_path = write_markdown_report(
            config["report_dir"],
            timestamp_slug(started),
            title=f"Team Status Today ({work_date})",
            factual_data=factual_payload,
            analysis=analysis,
        )
        notification_results = dispatch_notifications(
            task_name=config["task_name"],
            risk_level=analysis["risk_level"],
            analysis=analysis,
            report_path=_relative_report_path(report_path),
            config=config.get("notifications"),
        )
        if notification_results:
            print(
                "Notifications: "
                + ", ".join(
                    f"{result.channel}={result.status}" for result in notification_results
                )
            )
        insert_report(
            conn,
            run_id,
            config["task_name"],
            utc_now().isoformat(),
            str(_relative_report_path(report_path)),
            config["model"],
            analysis,
        )
        finish_task_run(conn, run_id, utc_now().isoformat(), "success")
        return report_path
    except (TeamStatusAuthError, TeamStatusServerKeyError, TeamStatusAPIError) as exc:
        finish_task_run(conn, run_id, utc_now().isoformat(), "failed", traceback.format_exc())
        raise RuntimeError(f"Team status today task failed: {exc}") from exc
    except Exception as exc:
        finish_task_run(conn, run_id, utc_now().isoformat(), "failed", traceback.format_exc())
        raise RuntimeError(f"Team status today task failed: {exc}") from exc
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run MARVIN team status (today) analysis"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip OpenRouter and use deterministic analysis",
    )
    parser.add_argument(
        "--date",
        default=None,
        help="Override the work date in YYYY-MM-DD (defaults to today UTC)",
    )
    args = parser.parse_args()
    report_path = run_task(dry_run=args.dry_run, date=args.date)
    print(f"Wrote report: {project_path(report_path)}")


if __name__ == "__main__":
    main()
