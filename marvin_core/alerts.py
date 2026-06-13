from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from marvin_core.paths import project_path
from marvin_core.todos import build_reminder_digest, list_todos


ALERT_DIR: str | Path = "alert"


def _alert_dir() -> Path:
    path = project_path(ALERT_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _timestamp_slug() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _write_latest_pointer(output_dir: Path, alert_path: Path) -> None:
    latest = output_dir / "latest.md"
    latest.unlink(missing_ok=True)
    try:
        latest.symlink_to(alert_path.name)
    except OSError:
        latest.write_text(alert_path.read_text(encoding="utf-8"), encoding="utf-8")


def read_latest_alert() -> dict[str, Any]:
    latest = project_path(ALERT_DIR) / "latest.md"
    if not latest.exists():
        return {
            "exists": False,
            "message": "Generating your alert. Please check back in sometime.",
            "file_name": None,
            "created_at": None,
        }

    resolved = latest.resolve()
    return {
        "exists": True,
        "message": latest.read_text(encoding="utf-8"),
        "file_name": resolved.name,
        "created_at": datetime.fromtimestamp(resolved.stat().st_mtime, tz=timezone.utc).isoformat(),
    }


def generate_alert() -> dict[str, Any]:
    output_dir = _alert_dir()
    digest = build_reminder_digest()
    todos = list_todos(include_done=False)
    timestamp = _timestamp_slug()
    alert_path = output_dir / f"alert-{timestamp}.md"
    lines = [
        "# MARVIN Alert",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        f"Source: {digest.get('source', 'unknown')}",
        "",
        "## What Needs Attention",
        "",
        str(digest.get("message") or "No alert generated.").strip(),
        "",
        "## Open Todos Snapshot",
        "",
    ]
    if todos:
        for todo in todos:
            tags = ", ".join(tag["name"] for tag in todo["tags"])
            due = f", due {todo['due_date']}" if todo.get("due_date") else ""
            lines.append(f"- [{todo['priority']}] {todo['title']} ({todo['status']}; {tags}{due})")
    else:
        lines.append("- No open todos.")
    lines.append("")
    alert_path.write_text("\n".join(lines), encoding="utf-8")
    _write_latest_pointer(output_dir, alert_path)
    return read_latest_alert()


def ensure_alert_generation() -> dict[str, Any]:
    if read_latest_alert()["exists"]:
        return {"started": False}
    generate_alert()
    return {"started": True}
