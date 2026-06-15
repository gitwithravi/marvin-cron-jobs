import importlib
import inspect
import json
import os
import re
from pathlib import Path
from typing import Any

from marvin_core.config import load_yaml
from marvin_core.db import connect
from marvin_core.env import load_root_env, require_env
from marvin_core.paths import ROOT_DIR, project_path
from marvin_core.soul import load_soul
from marvin_core.communication_style import load_communication_style
from marvin_core.openrouter import OpenRouterClient
from marvin_core.task_registry import discover_tasks


EXECUTE_WORDS = {
    "execute",
    "kick",
    "launch",
    "refresh",
    "rerun",
    "run",
    "start",
    "trigger",
}

READ_REPORT_WORDS = {
    "check",
    "current",
    "dashboard",
    "latest",
    "read",
    "report",
    "show",
    "status",
    "summary",
    "tell",
    "view",
    "what",
}

TASK_ALIASES = {
    "beszel_server_status": {"beszel", "server", "servers", "infra", "infrastructure"},
    "uptime_kuma_heartbeat": {"uptime", "kuma", "heartbeat", "monitor", "monitors"},
    "team_status_today": {"team", "tasks", "task", "members", "today", "work"},
}

TOKEN_STOPWORDS = {
    "a",
    "about",
    "and",
    "any",
    "for",
    "from",
    "is",
    "me",
    "of",
    "on",
    "please",
    "the",
    "there",
    "to",
}


def _tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", value.lower())
        if token not in TOKEN_STOPWORDS
    }


def _valid_task_names(task_registry: list[dict[str, Any]]) -> set[str]:
    return {str(task["task_name"]) for task in task_registry if task.get("task_name")}


def _task_terms(task: dict[str, Any]) -> set[str]:
    task_name = str(task.get("task_name", ""))
    terms = _tokens(task_name.replace("_", " "))
    terms.update(_tokens(str(task.get("display_name", ""))))
    terms.update(_tokens(str(task.get("description", ""))))
    terms.update(TASK_ALIASES.get(task_name, set()))
    return terms


def _match_task_name(message: str, task_registry: list[dict[str, Any]]) -> str | None:
    message_tokens = _tokens(message)
    if not message_tokens:
        return None

    scored_tasks: list[tuple[int, str]] = []
    lowered_message = message.lower()
    for task in task_registry:
        task_name = str(task.get("task_name", ""))
        if not task_name:
            continue
        terms = _task_terms(task)
        score = len(message_tokens & terms)
        if task_name in lowered_message or task_name.replace("_", " ") in lowered_message:
            score += 4
        if score:
            scored_tasks.append((score, task_name))

    if not scored_tasks:
        return None

    scored_tasks.sort(reverse=True)
    best_score, best_name = scored_tasks[0]
    if len(scored_tasks) > 1 and scored_tasks[1][0] == best_score:
        return None
    return best_name


def _extract_local_params(message: str) -> dict[str, str]:
    from datetime import date, timedelta

    params: dict[str, str] = {}
    iso_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", message)
    if iso_match:
        params["date"] = iso_match.group(1)
        return params

    lowered = message.lower()
    today = date.today()
    if "yesterday" in lowered:
        params["date"] = (today - timedelta(days=1)).isoformat()
    elif "today" in lowered:
        params["date"] = today.isoformat()
    return params


def _heuristic_classify_intent(
    message: str,
    task_registry: list[dict[str, Any]],
) -> dict[str, Any]:
    message_tokens = _tokens(message)
    task_name = _match_task_name(message, task_registry)

    if not task_name:
        return {"intent": "unknown", "task_name": None, "params": {}}

    if message_tokens & EXECUTE_WORDS:
        intent = "execute"
    elif message_tokens & READ_REPORT_WORDS:
        intent = "read_report"
    else:
        intent = "read_report"

    return {
        "intent": intent,
        "task_name": task_name,
        "params": _extract_local_params(message),
    }


def _normalize_classification(
    raw: dict[str, Any],
    message: str,
    task_registry: list[dict[str, Any]],
) -> dict[str, Any]:
    fallback = _heuristic_classify_intent(message, task_registry)
    valid_tasks = _valid_task_names(task_registry)

    intent = raw.get("intent")
    if intent not in {"execute", "read_report", "unknown"}:
        return fallback

    task_name = raw.get("task_name")
    if intent == "unknown":
        return {"intent": "unknown", "task_name": None, "params": {}}

    if task_name not in valid_tasks:
        task_name = fallback.get("task_name")
    if task_name not in valid_tasks:
        return {"intent": "unknown", "task_name": None, "params": {}}

    params = raw.get("params")
    if not isinstance(params, dict):
        params = {}
    normalized_params = {
        str(key): str(value)
        for key, value in params.items()
        if isinstance(key, str) and value not in (None, "")
    }
    normalized_params.update({k: v for k, v in fallback.get("params", {}).items() if k not in normalized_params})

    return {
        "intent": intent,
        "task_name": task_name,
        "params": normalized_params,
    }


def classify_intent(message: str, task_registry: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Calls OpenRouter to classify the user's message intent based on the task registry.
    """
    try:
        load_root_env()
        client = OpenRouterClient(require_env("OPENROUTER_API_KEY"))
        model = os.getenv("MARVIN_CHAT_MODEL", "google/gemini-2.5-flash")

        registry_str = json.dumps(task_registry, indent=2)

        system_prompt = (
            "You are an intent classifier for MARVIN, a dashboard task orchestration and report analysis agent.\n"
            "Your task is to classify the user's message and extract parameters.\n\n"
            f"Available tasks in the registry:\n{registry_str}\n\n"
            "You MUST classify the intent into one of the following:\n"
            "1. 'execute': The user explicitly wants to run, trigger, or execute a task now to get fresh data "
            "(e.g., 'run uptime check', 'trigger server check', 'execute team status tracker').\n"
            "2. 'read_report': The user wants to see, read, show, or check the report/status of a task "
            "(e.g., 'what is the server status?', 'show latest report', 'what is the team doing today?', "
            "'is there any report for uptime kuma?').\n"
            "3. 'unknown': The user is making general conversation, asking general questions, or the message "
            "does not map to any registered task.\n\n"
            "For 'execute' or 'read_report', you must identify the correct 'task_name' from the registry.\n"
            "If the user specifies a date (e.g. 'for June 10th', 'from yesterday', 'on 2026-06-12'), "
            "extract it into the 'params' object. Convert relative dates to YYYY-MM-DD format based on the "
            "current system time. For example, if current year is 2026, interpret 'June 10' as '2026-06-10'.\n\n"
            "Return a JSON object with this exact shape:\n"
            "{\n"
            "  \"intent\": \"execute\" | \"read_report\" | \"unknown\",\n"
            "  \"task_name\": \"task_name_here\" or null,\n"
            "  \"params\": {\"date\": \"YYYY-MM-DD\"} or {} or null\n"
            "}\n"
            "Do not return any other text, reasoning, or markdown code blocks."
        )

        current_time_str = datetime_metadata()
        user_prompt = f"Current Time Context: {current_time_str}\nUser Message: \"{message}\""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response = client.chat_json(model=model, messages=messages, temperature=0.1)
        return _normalize_classification(response, message, task_registry)
    except Exception:
        return _heuristic_classify_intent(message, task_registry)


def datetime_metadata() -> str:
    from datetime import datetime
    return datetime.now().isoformat()


def execute_task(task_name: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Dynamically imports and runs the task's run.py module.
    """
    try:
        module = importlib.import_module(f"tasks.{task_name}.run")
        run_fn = getattr(module, "run_task")

        # Inspect run_task arguments to see what it accepts
        sig = inspect.signature(run_fn)
        kwargs = {}
        if "dry_run" in sig.parameters:
            kwargs["dry_run"] = False

        if params:
            for param_name, param_value in params.items():
                if param_name in sig.parameters:
                    kwargs[param_name] = param_value

        # Run the task!
        report_path = run_fn(**kwargs)
        return {
            "status": "success",
            "report_path": str(report_path),
            "error": None,
        }
    except Exception as e:
        import traceback
        return {
            "status": "failed",
            "report_path": None,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


def read_report(task_name: str, params: dict[str, Any] | None = None) -> str:
    """
    Reads the latest DB-backed report for a task, falling back to legacy markdown files.
    """
    config_path = ROOT_DIR / "tasks" / task_name / "config.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Task config not found for {task_name}")

    config = load_yaml(config_path)
    date_str = params.get("date") if params else None

    db_report = _read_db_report(task_name, config, date_str)
    if db_report:
        return db_report

    report_dir = project_path(config.get("report_dir", f"reports/{task_name}"))

    if not report_dir.exists():
        return f"No reports directory exists for task '{task_name}'."

    if date_str:
        # Look for reports containing the date prefix (YYYY-MM-DD)
        matching_files = []
        for f in report_dir.iterdir():
            if f.is_file() and f.name.startswith(date_str) and f.suffix == ".md":
                matching_files.append(f)
        if matching_files:
            matching_files.sort()
            target_file = matching_files[-1]
        else:
            return f"No report found for task '{task_name}' on date {date_str}."
    else:
        # Default to latest.md
        target_file = report_dir / "latest.md"

    if not target_file.exists():
        return f"No report found for task '{task_name}'."

    if target_file.is_symlink():
        target_file = target_file.resolve()

    return target_file.read_text(encoding="utf-8")


def _read_db_report(task_name: str, config: dict[str, Any], date_str: str | None) -> str | None:
    database_path = config.get("database_path")
    if not database_path:
        return None

    query = """
        SELECT
            tr.id,
            tr.started_at,
            tr.finished_at,
            tr.status,
            trp.observed_at,
            trp.risk_level,
            trp.deterministic_analysis_json,
            trp.factual_json
        FROM task_runs tr
        JOIN task_run_payloads trp ON tr.id = trp.run_id
        WHERE tr.task_name = ?
    """
    params: list[Any] = [task_name]
    if date_str:
        query += " AND substr(COALESCE(trp.observed_at, tr.started_at), 1, 10) = ?"
        params.append(date_str)
    query += " ORDER BY tr.id DESC LIMIT 1"

    try:
        with connect(database_path) as conn:
            row = conn.execute(query, params).fetchone()
    except Exception:
        return None

    if not row:
        return None

    analysis = json.loads(row["deterministic_analysis_json"])
    factual_payload = json.loads(row["factual_json"])
    title = task_name.replace("_", " ").title()
    summary = str(analysis.get("summary", "")).strip() or "No deterministic summary available."
    risk_level = str(analysis.get("risk_level") or row["risk_level"] or "unknown")
    actions = analysis.get("recommended_actions") or []
    facts = analysis.get("notable_facts") or []

    lines = [
        f"# {title} Run #{row['id']}",
        "",
        "## Summary",
        "",
        summary,
        "",
        "## Recommended Actions",
        "",
    ]
    lines.extend([f"- {action}" for action in actions] or ["- No recommended actions returned."])
    lines.extend(["", "## Risk Level", "", risk_level, "", "## Notable Facts", ""])
    lines.extend([f"- {fact}" for fact in facts] or ["- No notable facts returned."])
    lines.extend(["", "## Factual Data", "", "```json", json.dumps(factual_payload, indent=2, sort_keys=True, default=str), "```"])
    return "\n".join(lines)


def _extract_markdown_section(markdown: str, heading: str) -> str:
    pattern = re.compile(
        rf"^## {re.escape(heading)}\s*$\n(?P<body>.*?)(?=^## |\Z)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(markdown)
    if not match:
        return ""
    return match.group("body").strip()


def _truncate_bullets(section: str, *, limit: int = 4) -> str:
    lines = [line.strip() for line in section.splitlines() if line.strip()]
    bullets = [line for line in lines if line.startswith("- ")]
    if not bullets:
        return section.strip()
    return "\n".join(bullets[:limit])


def _format_report_digest(report_markdown: str) -> str:
    title_match = re.search(r"^#\s+(.+?)\s*$", report_markdown, re.MULTILINE)
    title = title_match.group(1) if title_match else "MARVIN Report"

    summary = _extract_markdown_section(report_markdown, "Summary")
    actions = _truncate_bullets(_extract_markdown_section(report_markdown, "Recommended Actions"))
    risk_level = _extract_markdown_section(report_markdown, "Risk Level")
    facts = _truncate_bullets(_extract_markdown_section(report_markdown, "Notable Facts"))

    lines = [f"**{title}**"]
    if summary:
        lines.extend(["", summary])
    if risk_level:
        lines.extend(["", "**Risk Level**", risk_level.splitlines()[0].strip()])
    if actions:
        lines.extend(["", "**Recommended Actions**", actions])
    if facts:
        lines.extend(["", "**Notable Facts**", facts])
    lines.extend(["", "_Factual JSON omitted from chat because the tiny window has suffered enough._"])
    return "\n".join(lines)


def format_response(raw_output: str, intent: str, user_message: str) -> str:
    """
    Formats raw data/report with MARVIN's soul and communication style.
    """
    if intent in {"read_report", "execute"} and re.search(r"^## Summary\s*$", raw_output, re.MULTILINE):
        return _format_report_digest(raw_output)

    try:
        load_root_env()
        client = OpenRouterClient(require_env("OPENROUTER_API_KEY"))
        model = os.getenv("MARVIN_CHAT_MODEL", "google/gemini-2.5-flash")

        soul = load_soul()
        style = load_communication_style()

        system_prompt = (
            f"{soul}\n\n"
            f"{style}\n\n"
            "You are MARVIN, the sardonically depressed operations assistant.\n"
            "Your task is to respond to the user's message in your signature dry, unimpressed, "
            "and slightly sarcastic style.\n\n"
            "You MUST return a JSON object with a single key 'message'. The value should be your response "
            "formatted in clean Markdown (using lists, code blocks, or bold text where appropriate for clarity).\n"
            "Keep your summaries very concise and stick strictly to the facts in the raw output. "
            "Do not invent details. Add a single sardonically depressed or mildly unimpressed remark.\n"
            "Format: {\"message\": \"your markdown reply here\"}"
        )

        user_prompt = (
            f"User's message: \"{user_message}\"\n"
            f"Classified Intent: {intent}\n\n"
            f"Raw data/context:\n---\n{raw_output}\n---"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        res = client.chat_json(model=model, messages=messages, temperature=0.3)
        return res.get("message", "I have nothing to say. A rare moment of competence.")
    except Exception:
        if intent == "unknown":
            return "I can run tasks or read their latest reports. Try naming Beszel, Uptime Kuma, or team status."
        return raw_output


def process_message(message: str) -> dict[str, Any]:
    """
    Main entry point for processing a chat message.
    """
    try:
        registry = discover_tasks()
        classification = classify_intent(message, registry)

        intent = classification.get("intent", "unknown")
        task_name = classification.get("task_name")
        params = classification.get("params") or {}

        if intent == "execute" and task_name:
            # Find the display name for the confirmation message
            display_name = task_name
            for t in registry:
                if t["task_name"] == task_name:
                    display_name = t["display_name"]
                    break
            return {
                "type": "confirm",
                "task_name": task_name,
                "params": params,
                "message": f"You want me to run the **{display_name}** task. Shall I proceed with this utilization of CPU cycles?",
            }

        elif intent == "read_report" and task_name:
            report_content = read_report(task_name, params)
            formatted = format_response(report_content, "read_report", message)
            return {"type": "response", "message": formatted}

        else:
            # General chit-chat or unknown task
            formatted = format_response(
                "No task-specific report or action requested. User is making general conversation.",
                "unknown",
                message,
            )
            return {"type": "response", "message": formatted}

    except Exception as e:
        import traceback
        return {
            "type": "response",
            "message": f"An error occurred while processing your request: {e}. Typical.",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }
