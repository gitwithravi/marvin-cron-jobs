import argparse
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
    insert_vityarthi_support_ticket_observations,
    migrate,
)
from marvin_core.env import load_root_env, require_env
from marvin_core.notifications.dispatcher import dispatch_notifications
from marvin_core.openrouter import OpenRouterClient
from marvin_core.paths import ROOT_DIR, project_path
from marvin_core.report import write_markdown_report
from marvin_core.risk import normalize_risk_level
from tasks.vityarthi_support_tickets.analysis import (
    build_factual_payload,
    build_messages,
    compute_risk_level,
    dry_run_analysis,
)
from tasks.vityarthi_support_tickets.vityarthi import VityarthiSupportClient


TASK_DIR = Path(__file__).resolve().parent


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def timestamp_slug(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%d_%H%M%S")


def validate_config(config: dict[str, Any]) -> None:
    required = ["task_name", "model", "base_url", "open_ticket_summary_limit", "database_path", "report_dir"]
    missing = [key for key in required if not config.get(key)]
    if missing:
        raise RuntimeError(f"Missing required task config keys: {', '.join(missing)}")
    if config["model"] == "REPLACE_WITH_OPENROUTER_MODEL_SLUG":
        raise RuntimeError("Set tasks/vityarthi_support_tickets/config.yaml model before live runs")


def run_task(*, dry_run: bool = False) -> Path:
    load_root_env()
    config = load_yaml(TASK_DIR / "config.yaml")
    if dry_run and config.get("model") == "REPLACE_WITH_OPENROUTER_MODEL_SLUG":
        config["model"] = "dry-run"
    validate_config(config)

    started = utc_now()
    observed_at = started.isoformat()
    conn = connect(config["database_path"])
    migrate(conn)
    run_id = create_task_run(conn, config["task_name"], observed_at)

    try:
        base_url = config["base_url"]
        api_token = require_env("VITYARTHI_SYSTEM_API_TOKEN")

        client = VityarthiSupportClient(base_url, api_token)

        ticket_counts = client.fetch_ticket_counts()
        summary_limit = int(config["open_ticket_summary_limit"])
        open_tickets = client.fetch_open_tickets(per_page=max(summary_limit, 50))

        open_ticket_details: list[dict[str, Any]] = []
        for ticket in open_tickets[:summary_limit]:
            detail = client.fetch_ticket_detail(ticket["id"])
            if detail:
                open_ticket_details.append(detail)

        client.close()

        insert_vityarthi_support_ticket_observations(
            conn, run_id, observed_at, ticket_counts, open_tickets
        )

        factual_payload = build_factual_payload(
            task_name=config["task_name"],
            observed_at=observed_at,
            ticket_counts=ticket_counts,
            open_tickets=open_tickets,
            open_ticket_details=open_ticket_details,
            summary_limit=summary_limit,
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
                max_tokens=int(llm_config.get("max_tokens", 1500)),
            )
            analysis["risk_level"] = risk_level

        analysis["risk_level"] = normalize_risk_level(analysis.get("risk_level", risk_level))

        report_path = write_markdown_report(
            config["report_dir"],
            timestamp_slug(started),
            title="Vityarthi Support Tickets Report",
            factual_data=factual_payload,
            analysis=analysis,
        )
        notification_results = dispatch_notifications(
            task_name=config["task_name"],
            risk_level=analysis["risk_level"],
            analysis=analysis,
            report_path=report_path.relative_to(ROOT_DIR) if report_path.is_relative_to(ROOT_DIR) else report_path,
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
            str(report_path.relative_to(ROOT_DIR) if report_path.is_relative_to(ROOT_DIR) else report_path),
            config["model"],
            analysis,
        )
        finish_task_run(conn, run_id, utc_now().isoformat(), "success")
        return report_path
    except Exception as exc:
        finish_task_run(conn, run_id, utc_now().isoformat(), "failed", traceback.format_exc())
        raise RuntimeError(f"Vityarthi support tickets task failed: {exc}") from exc
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run MARVIN Vityarthi support tickets analysis")
    parser.add_argument("--dry-run", action="store_true", help="Skip OpenRouter and use deterministic analysis")
    args = parser.parse_args()
    report_path = run_task(dry_run=args.dry_run)
    print(f"Wrote report: {project_path(report_path)}")


if __name__ == "__main__":
    main()