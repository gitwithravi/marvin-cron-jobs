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
    insert_heartbeat_observations,
    insert_monitor_snapshots,
    insert_report,
    migrate,
)
from marvin_core.env import load_root_env, require_env
from marvin_core.openrouter import OpenRouterClient
from marvin_core.paths import ROOT_DIR, project_path
from marvin_core.report import write_markdown_report
from tasks.uptime_kuma_heartbeat.analysis import (
    build_factual_payload,
    build_messages,
    dry_run_analysis,
)
from tasks.uptime_kuma_heartbeat.kuma import KumaHeartbeatClient


TASK_DIR = Path(__file__).resolve().parent


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def timestamp_slug(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%d_%H%M%S")


def validate_config(config: dict[str, Any]) -> None:
    required = ["task_name", "model", "heartbeat_lookback_hours", "database_path", "report_dir"]
    missing = [key for key in required if not config.get(key)]
    if missing:
        raise RuntimeError(f"Missing required task config keys: {', '.join(missing)}")
    if config["model"] == "REPLACE_WITH_OPENROUTER_MODEL_SLUG":
        raise RuntimeError("Set tasks/uptime_kuma_heartbeat/config.yaml model before live runs")


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
        kuma_url = require_env("UPTIME_KUMA_URL")
        kuma_username = require_env("UPTIME_KUMA_USERNAME")
        kuma_password = require_env("UPTIME_KUMA_PASSWORD")

        with KumaHeartbeatClient(kuma_url, kuma_username, kuma_password) as client:
            monitors, heartbeats = client.fetch(int(config["heartbeat_lookback_hours"]))

        insert_monitor_snapshots(conn, run_id, observed_at, monitors)
        insert_heartbeat_observations(conn, run_id, observed_at, heartbeats)

        factual_payload = build_factual_payload(
            task_name=config["task_name"],
            observed_at=observed_at,
            lookback_hours=int(config["heartbeat_lookback_hours"]),
            monitors=monitors,
            heartbeats=heartbeats,
        )

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

        report_path = write_markdown_report(
            config["report_dir"],
            timestamp_slug(started),
            title="Uptime Kuma Heartbeat Report",
            factual_data=factual_payload,
            analysis=analysis,
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
        raise RuntimeError(f"Uptime Kuma heartbeat task failed: {exc}") from exc
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run MARVIN Uptime Kuma heartbeat analysis")
    parser.add_argument("--dry-run", action="store_true", help="Skip OpenRouter and use deterministic analysis")
    args = parser.parse_args()
    report_path = run_task(dry_run=args.dry_run)
    print(f"Wrote report: {project_path(report_path)}")


if __name__ == "__main__":
    main()
