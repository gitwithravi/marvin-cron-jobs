import json
from collections import Counter
from pathlib import Path
from typing import Any


def build_factual_payload(
    *,
    task_name: str,
    observed_at: str,
    ticket_counts: dict[str, int],
    open_tickets: list[dict[str, Any]],
    open_ticket_details: list[dict[str, Any]],
    summary_limit: int,
) -> dict[str, Any]:
    recent_tickets = sorted(open_tickets, key=lambda t: t.get("created_at") or "", reverse=True)
    top_recent = recent_tickets[:summary_limit]
    has_more = len(recent_tickets) > summary_limit

    top_recent_summaries = []
    for ticket in top_recent:
        detail = next(
            (d for d in open_ticket_details if d.get("id") == ticket.get("id")),
            None,
        )
        entry: dict[str, Any] = {
            "id": ticket.get("id"),
            "subject": ticket.get("subject"),
            "status": ticket.get("status"),
            "priority": ticket.get("priority"),
            "category": ticket.get("category"),
            "created_at": ticket.get("created_at"),
            "owner_name": ticket.get("owner_name"),
            "owner_email": ticket.get("owner_email"),
        }
        if detail:
            entry["message"] = detail.get("message")
            entry["reply_count"] = detail.get("reply_count")
            entry["has_staff_reply"] = detail.get("has_staff_reply")
        top_recent_summaries.append(entry)

    open_by_priority = Counter(t.get("priority") or "unknown" for t in open_tickets)
    open_by_category = Counter(t.get("category") or "unknown" for t in open_tickets)

    return {
        "task_name": task_name,
        "observed_at": observed_at,
        "summary_limit": summary_limit,
        "ticket_counts": ticket_counts,
        "open_ticket_count": ticket_counts.get("open", 0),
        "replied_ticket_count": ticket_counts.get("replied", 0),
        "closed_ticket_count": ticket_counts.get("closed", 0),
        "total_ticket_count": ticket_counts.get("total", 0),
        "open_by_priority": dict(open_by_priority),
        "open_by_category": dict(open_by_category),
        "top_recent_open_tickets": top_recent_summaries,
        "has_more_open_tickets_than_summarized": has_more,
        "total_open_tickets": len(open_tickets),
    }


def compute_risk_level(factual_payload: dict[str, Any]) -> str:
    open_count = factual_payload.get("open_ticket_count", 0)
    open_by_priority = factual_payload.get("open_by_priority", {})

    has_urgent = any(
        k.lower() in ("urgent", "high", "critical") and v > 0
        for k, v in open_by_priority.items()
    )

    if open_count > 0 and has_urgent:
        return "high"

    if open_count > 5:
        return "medium"

    if open_count > 0:
        return "low"

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
    open_count = factual_payload.get("open_ticket_count", 0)
    risk_level = compute_risk_level(factual_payload)
    has_more = factual_payload.get("has_more_open_tickets_than_summarized", False)

    if open_count == 0:
        summary = "No open support tickets. The users are either satisfied or quietly suffering in silence."
        actions = ["No immediate action required."]
    else:
        summary = f"{open_count} open support ticket(s) found."
        if has_more:
            summary += f" Summarized the top {factual_payload.get('summary_limit', 3)} most recent. I didn't have to go through more, and frankly, neither should you."
        actions = ["Review the open tickets in the Vityarthi admin panel and respond to unresolved issues."]

    notable_facts = [
        f"Open tickets: {factual_payload.get('open_ticket_count', 0)}",
        f"Replied tickets: {factual_payload.get('replied_ticket_count', 0)}",
        f"Closed tickets: {factual_payload.get('closed_ticket_count', 0)}",
        f"Total tickets: {factual_payload.get('total_ticket_count', 0)}",
    ]

    open_by_priority = factual_payload.get("open_by_priority", {})
    for priority, count in open_by_priority.items():
        notable_facts.append(f"Open tickets with priority '{priority}': {count}")

    top_recent = factual_payload.get("top_recent_open_tickets", [])
    for ticket in top_recent:
        subject = ticket.get("subject") or "(no subject)"
        owner = ticket.get("owner_name") or ticket.get("owner_email") or "unknown"
        notable_facts.append(f"Open ticket #{ticket.get('id')}: '{subject}' by {owner}")

    if has_more:
        notable_facts.append(f"Additional open tickets beyond the top {factual_payload.get('summary_limit', 3)} were not summarized. I didn't have to go through more, and frankly, neither should you.")

    return {
        "summary": summary,
        "recommended_actions": actions,
        "risk_level": risk_level,
        "notable_facts": notable_facts,
    }