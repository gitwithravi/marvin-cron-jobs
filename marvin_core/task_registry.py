import os
from pathlib import Path
from typing import Any
import yaml
from marvin_core.paths import ROOT_DIR


def discover_tasks() -> list[dict[str, Any]]:
    tasks_dir = ROOT_DIR / "tasks"
    if not tasks_dir.exists():
        return []

    registry = []

    # Sort entries for deterministic output
    for entry in sorted(tasks_dir.iterdir()):
        if not entry.is_dir() or entry.name.startswith("__"):
            continue

        config_path = entry / "config.yaml"
        if not config_path.exists():
            continue

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f) or {}
        except Exception:
            config = {}

        task_name = config.get("task_name", entry.name)

        # Format display name
        display_name = " ".join(
            part.capitalize()
            for part in task_name.replace("_", " ").replace("-", " ").split()
        )

        # Read description from system prompt
        system_prompt_path = entry / "prompts" / "system.md"
        description = ""
        if system_prompt_path.exists():
            try:
                content = system_prompt_path.read_text(encoding="utf-8").strip()
                # Get the first line as it usually contains the agent's role/description
                first_line = content.split("\n")[0].strip()
                if "You are MARVIN, an " in first_line:
                    description = first_line.replace("You are MARVIN, an ", "").strip()
                    # Capitalize first letter
                    description = description[0].upper() + description[1:]
                elif "You are MARVIN, " in first_line:
                    description = first_line.replace("You are MARVIN, ", "").strip()
                    description = description[0].upper() + description[1:]
                else:
                    description = first_line
            except Exception:
                pass

        # Fallback descriptions if prompt parsing failed or was incomplete
        if not description or len(description) < 10:
            if task_name == "uptime_kuma_heartbeat":
                description = "Polls Uptime Kuma for monitor status and recent heartbeats"
            elif task_name == "beszel_server_status":
                description = "Monitors server infrastructure and system statistics via Beszel"
            elif task_name == "team_status_today":
                description = "Reviews daily team task status and work updates"
            else:
                description = f"Orchestrates and analyzes {display_name} operations"

        # Check if task supports a date argument
        run_file = entry / "run.py"
        read_report_params = ["latest"]
        if run_file.exists():
            try:
                run_content = run_file.read_text(encoding="utf-8")
                if "date: str" in run_content or "date=" in run_content or "args.date" in run_content:
                    read_report_params.append("date")
            except Exception:
                pass

        registry.append({
            "task_name": task_name,
            "display_name": display_name,
            "description": description,
            "actions": ["execute", "read_report"],
            "read_report_params": read_report_params,
        })

    return registry
