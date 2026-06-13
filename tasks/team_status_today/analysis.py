import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


VALID_STATUSES = ("done", "in_progress", "blocked", "planned")


def build_factual_payload(
    *,
    task_name: str,
    observed_at: str,
    date: str,
    members: list[dict[str, Any]],
    tasks_by_member: dict[int, list[dict[str, Any]]],
) -> dict[str, Any]:
    member_summaries: list[dict[str, Any]] = []
    status_counts: Counter[str] = Counter()
    blocked_task_summaries: list[dict[str, Any]] = []
    members_with_no_tasks: list[dict[str, Any]] = []

    for member in members:
        member_id = member["id"]
        member_tasks = tasks_by_member.get(member_id, [])
        member_status_counts = Counter(
            (task.get("status") or "unknown") for task in member_tasks
        )
        for status, count in member_status_counts.items():
            status_counts[status] += count

        member_task_summaries = [
            {
                "id": task.get("id"),
                "title": task.get("title"),
                "status": task.get("status"),
                "project_name": task.get("project_name"),
                "notes": task.get("notes"),
            }
            for task in member_tasks
        ]

        member_summaries.append(
            {
                "id": member_id,
                "name": member.get("name"),
                "task_count": len(member_tasks),
                "status_counts": dict(member_status_counts),
                "tasks": member_task_summaries,
            }
        )

        if not member_tasks:
            members_with_no_tasks.append(
                {"id": member_id, "name": member.get("name")}
            )

        for task in member_tasks:
            if task.get("status") == "blocked":
                blocked_task_summaries.append(
                    {
                        "id": task.get("id"),
                        "title": task.get("title"),
                        "member_id": member_id,
                        "member_name": member.get("name"),
                        "project_name": task.get("project_name"),
                        "notes": task.get("notes"),
                    }
                )

    return {
        "task_name": task_name,
        "observed_at": observed_at,
        "date": date,
        "member_count": len(members),
        "task_count": sum(status_counts.values()),
        "status_counts": {status: status_counts.get(status, 0) for status in VALID_STATUSES},
        "extra_status_counts": {
            status: count
            for status, count in status_counts.items()
            if status not in VALID_STATUSES
        },
        "members": member_summaries,
        "members_with_no_tasks": members_with_no_tasks,
        "blocked_task_count": len(blocked_task_summaries),
        "blocked_tasks": blocked_task_summaries,
    }


def compute_risk_level(factual_payload: dict[str, Any]) -> str:
    status_counts = factual_payload.get("status_counts", {}) or {}
    blocked = int(status_counts.get("blocked", 0) or 0)
    in_progress = int(status_counts.get("in_progress", 0) or 0)
    done = int(status_counts.get("done", 0) or 0)
    planned = int(status_counts.get("planned", 0) or 0)
    member_count = int(factual_payload.get("member_count", 0) or 0)
    members_with_no_tasks = factual_payload.get("members_with_no_tasks") or []

    if blocked > 0 and (blocked * 2 >= max(1, member_count) or blocked >= 3):
        return "critical"

    if blocked > 0:
        return "high"

    if in_progress > 0 and done == 0:
        return "medium"

    if planned > 0 and done == 0 and in_progress == 0 and member_count > 0:
        if len(members_with_no_tasks) >= max(1, member_count // 2):
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
    status_counts = factual_payload.get("status_counts", {}) or {}
    blocked = int(status_counts.get("blocked", 0) or 0)
    in_progress = int(status_counts.get("in_progress", 0) or 0)
    done = int(status_counts.get("done", 0) or 0)
    planned = int(status_counts.get("planned", 0) or 0)
    member_count = int(factual_payload.get("member_count", 0) or 0)
    members_with_no_tasks = factual_payload.get("members_with_no_tasks") or []
    task_count = int(factual_payload.get("task_count", 0) or 0)

    if blocked > 0:
        if risk_level == "critical":
            summary = (
                f"{blocked} task(s) blocked across the team. Work has found new ways to be un-done, "
                "and the count is starting to qualify as a pattern."
            )
        else:
            summary = (
                f"{blocked} task(s) blocked today. The work has opinions, and they are not favorable."
            )
    elif in_progress > 0 and done == 0:
        summary = (
            f"{in_progress} task(s) in progress and nothing finished yet. "
            "The day is still young, allegedly."
        )
    elif done > 0:
        summary = (
            f"{done} task(s) done, {in_progress} in progress, {planned} planned. "
            "A respectable output, considering."
        )
    elif task_count == 0 and member_count > 0:
        summary = (
            "No tasks reported for any team member today. "
            "Either the day is suspiciously quiet or the pipeline forgot to mention it."
        )
    else:
        summary = "Nothing to report. A rare moment of operational calm."

    actions: list[str] = []
    if blocked > 0:
        blocked_titles = [
            task.get("title")
            for task in (factual_payload.get("blocked_tasks") or [])
            if task.get("title")
        ]
        if blocked_titles:
            actions.append(
                "Follow up on blocked tasks (" + ", ".join(blocked_titles) + ") and confirm unblock paths."
            )
        else:
            actions.append("Follow up on blocked tasks with their owners and confirm unblock paths.")
    if in_progress > 0:
        actions.append("Check in on in-progress tasks for status and remaining work.")
    if members_with_no_tasks:
        names = ", ".join(
            str(member.get("name") or f"member-{member.get('id')}")
            for member in members_with_no_tasks
        )
        actions.append(f"Verify with {names} whether they have tasks to log for today.")
    if not actions:
        actions.append("No immediate action required based on the collected data.")

    notable_facts = [
        f"Date: {factual_payload.get('date')}.",
        f"Members in roster: {member_count}.",
        f"Total tasks reported: {task_count}.",
        f"Status counts: {dict(status_counts)}.",
    ]
    if members_with_no_tasks:
        notable_facts.append(
            f"Members with no tasks: {len(members_with_no_tasks)}."
        )

    return {
        "summary": summary,
        "recommended_actions": actions,
        "risk_level": risk_level,
        "notable_facts": notable_facts,
    }


def group_tasks_by_member(tasks: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for task in tasks:
        member_id = task.get("member_id")
        if member_id is None:
            continue
        grouped[int(member_id)].append(task)
    return grouped
