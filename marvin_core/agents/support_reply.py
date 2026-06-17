from __future__ import annotations

from typing import Any

from marvin_core.db import (
    connect,
    create_agent_approval,
    create_agent_run,
    create_agent_run_step,
    get_agent_approval,
    get_support_rag_suggestion,
    has_pending_agent_approval,
    insert_support_rag_suggestion,
    migrate,
    update_agent_approval,
    update_agent_run,
    update_support_rag_suggestion,
)
from marvin_core.support_rag import SupportRagEngine, build_ticket_query, utc_now_iso
from tasks.vityarthi_support_tickets.vityarthi import VityarthiSupportClient


def _target_label(ticket: dict[str, Any]) -> str:
    subject = (ticket.get("subject") or "Untitled ticket").strip()
    ticket_number = (ticket.get("ticket_number") or f"Ticket {ticket['id']}").strip()
    return f"{ticket_number} - {subject}"


def create_support_reply_approval(
    *,
    database_path: str,
    ticket: dict[str, Any],
    client: VityarthiSupportClient | None = None,
) -> dict[str, Any]:
    if client is None:
        raise RuntimeError("Support reply approval requires a configured Vityarthi client")

    if not ticket.get("subject") and not ticket.get("message"):
        fetched = client.fetch_ticket_detail(int(ticket["id"]))
        if not fetched:
            raise LookupError(f"Ticket {ticket['id']} was not found")
        ticket = fetched

    engine = SupportRagEngine()
    suggestion = engine.suggest(ticket)
    now = utc_now_iso()

    with connect(database_path) as conn:
        migrate(conn)
        support_suggestion = insert_support_rag_suggestion(
            conn,
            ticket_id=int(ticket["id"]),
            ticket_number=ticket.get("ticket_number"),
            subject=ticket.get("subject"),
            customer_message=build_ticket_query(ticket),
            suggested_reply=suggestion.suggested_reply,
            confidence=suggestion.confidence,
            requires_human_attention=suggestion.requires_human_attention,
            retrieval_backend=suggestion.retrieval_backend,
            matched_examples=suggestion.matched_examples,
            policy_flags=suggestion.policy_flags,
            source={"ticket": ticket, "generated_at": now},
            created_at=now,
        )

        agent_run = create_agent_run(
            conn,
            workflow_name="support_reply",
            subject_type="support_ticket",
            subject_id=str(ticket["id"]),
            target_label=_target_label(ticket),
            metadata={
                "ticket_id": int(ticket["id"]),
                "ticket_number": ticket.get("ticket_number"),
                "support_suggestion_id": support_suggestion["id"],
            },
            created_at=now,
            status="waiting_approval",
        )
        create_agent_run_step(
            conn,
            agent_run_id=agent_run["id"],
            step_name="generate_support_reply",
            status="completed",
            input_data={"ticket_id": int(ticket["id"])},
            output_data={"support_suggestion_id": support_suggestion["id"]},
            created_at=now,
        )
        approval = create_agent_approval(
            conn,
            agent_run_id=agent_run["id"],
            kind="support_reply",
            target_label=_target_label(ticket),
            summary_text=ticket.get("subject") or "Support reply awaiting approval",
            draft_content={
                "ticket_id": int(ticket["id"]),
                "ticket_number": ticket.get("ticket_number"),
                "support_suggestion_id": support_suggestion["id"],
                "subject": ticket.get("subject"),
                "reply": support_suggestion["suggested_reply"],
                "confidence": support_suggestion["confidence"],
            },
            evidence={
                "ticket": ticket,
                "matched_examples": support_suggestion["matched_examples"],
                "policy_flags": support_suggestion["policy_flags"],
                "requires_human_attention": support_suggestion["requires_human_attention"],
                "retrieval_backend": support_suggestion["retrieval_backend"],
            },
            created_at=now,
        )
        approval["run"] = agent_run
        approval["support_suggestion"] = support_suggestion
        return approval


def sync_support_reply_approvals(
    *,
    database_path: str,
    tickets: list[dict[str, Any]],
    client: VityarthiSupportClient,
) -> dict[str, Any]:
    created: list[dict[str, Any]] = []
    skipped_ticket_ids: list[int] = []

    with connect(database_path) as conn:
        migrate(conn)
        existing_ticket_ids = {
            int(ticket["id"])
            for ticket in tickets
            if ticket.get("id") is not None
            and has_pending_agent_approval(
                conn,
                kind="support_reply",
                subject_type="support_ticket",
                subject_id=str(ticket["id"]),
            )
        }

    for ticket in tickets:
        ticket_id = ticket.get("id")
        if ticket_id is None:
            continue
        ticket_id = int(ticket_id)
        if ticket_id in existing_ticket_ids:
            skipped_ticket_ids.append(ticket_id)
            continue
        detail = ticket if ticket.get("replies") is not None else client.fetch_ticket_detail(ticket_id)
        if not detail:
            skipped_ticket_ids.append(ticket_id)
            continue
        created.append(
            create_support_reply_approval(
                database_path=database_path,
                ticket=detail,
                client=client,
            )
        )

    return {
        "created": created,
        "created_count": len(created),
        "skipped_ticket_ids": skipped_ticket_ids,
    }


def approve_support_reply(
    *,
    database_path: str,
    approval_id: int,
    reviewer: str,
    final_reply: str | None,
    client: VityarthiSupportClient,
) -> dict[str, Any]:
    now = utc_now_iso()
    with connect(database_path) as conn:
        migrate(conn)
        approval = get_agent_approval(conn, approval_id)
        if approval is None:
            raise LookupError(f"Agent approval {approval_id} was not found")
        if approval["status"] != "pending":
            raise ValueError("Only pending approvals can be approved")
        if approval["kind"] != "support_reply":
            raise ValueError(f"Approval {approval_id} is not a support reply approval")

        draft = approval["draft_content"]
        support_suggestion_id = int(draft["support_suggestion_id"])
        suggestion = get_support_rag_suggestion(conn, support_suggestion_id)
        if suggestion is None:
            raise LookupError(f"Support RAG suggestion {support_suggestion_id} was not found")

        reply = (final_reply or suggestion["suggested_reply"]).strip()
        if not reply:
            raise ValueError("Final reply cannot be empty")

        upstream = client.post_ticket_reply(int(draft["ticket_id"]), reply)
        updated_suggestion = update_support_rag_suggestion(
            conn,
            suggestion_id=support_suggestion_id,
            status="sent",
            final_reply=reply,
            sent_at=now,
            updated_at=now,
        )
        updated_approval = update_agent_approval(
            conn,
            approval_id=approval_id,
            status="approved",
            edited_content={"reply": reply},
            reviewer=reviewer,
            reviewed_at=now,
            updated_at=now,
        )
        run = update_agent_run(
            conn,
            agent_run_id=approval["agent_run_id"],
            status="completed",
            metadata={"approved_approval_id": approval_id},
            completed_at=now,
            updated_at=now,
        )
        create_agent_run_step(
            conn,
            agent_run_id=approval["agent_run_id"],
            step_name="send_support_reply",
            status="completed",
            input_data={"approval_id": approval_id, "reply": reply},
            output_data={"upstream": upstream},
            created_at=now,
        )
        updated_approval["run"] = run
        updated_approval["support_suggestion"] = updated_suggestion
        updated_approval["upstream"] = upstream
        return updated_approval


def reject_support_reply(
    *,
    database_path: str,
    approval_id: int,
    reviewer: str,
    reason: str | None,
) -> dict[str, Any]:
    now = utc_now_iso()
    with connect(database_path) as conn:
        migrate(conn)
        approval = get_agent_approval(conn, approval_id)
        if approval is None:
            raise LookupError(f"Agent approval {approval_id} was not found")
        if approval["status"] != "pending":
            raise ValueError("Only pending approvals can be rejected")
        if approval["kind"] != "support_reply":
            raise ValueError(f"Approval {approval_id} is not a support reply approval")

        draft = approval["draft_content"]
        support_suggestion_id = int(draft["support_suggestion_id"])
        updated_suggestion = update_support_rag_suggestion(
            conn,
            suggestion_id=support_suggestion_id,
            status="ignored",
            updated_at=now,
        )
        updated_approval = update_agent_approval(
            conn,
            approval_id=approval_id,
            status="rejected",
            rejection_reason=reason,
            reviewer=reviewer,
            reviewed_at=now,
            updated_at=now,
        )
        run = update_agent_run(
            conn,
            agent_run_id=approval["agent_run_id"],
            status="cancelled",
            metadata={"rejected_approval_id": approval_id},
            completed_at=now,
            updated_at=now,
        )
        create_agent_run_step(
            conn,
            agent_run_id=approval["agent_run_id"],
            step_name="reject_support_reply",
            status="completed",
            input_data={"approval_id": approval_id, "reason": reason},
            output_data=None,
            created_at=now,
        )
        updated_approval["run"] = run
        updated_approval["support_suggestion"] = updated_suggestion
        return updated_approval
