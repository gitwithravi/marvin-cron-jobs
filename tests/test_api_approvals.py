import sqlite3

import pytest

from marvin_core import marvin_api
from marvin_core.marvin_api import (
    ApprovalActionRequest,
    SupportReplyWorkflowRequest,
    approve_approval_endpoint,
    create_support_reply_workflow_endpoint,
    get_approval_endpoint,
    list_approvals_endpoint,
    reject_approval_endpoint,
    sync_support_reply_workflows_endpoint,
)


class FakeSupportEngine:
    def suggest(self, _ticket):
        return type(
            "Suggestion",
            (),
            {
                "suggested_reply": "Please verify the payment from your side.",
                "confidence": "medium",
                "requires_human_attention": True,
                "retrieval_backend": "lexical_jsonl",
                "matched_examples": [{"doc_id": "1", "subject": "Payment", "customer_message": "Paid", "staff_reply": "Checking", "score": 0.7}],
                "policy_flags": ["Verify payment before confirming access."],
            },
        )()


class FakeVityarthiClient:
    def __init__(self):
        self.sent = []

    def fetch_review_tickets(self, *, statuses=("open",), per_page=25, include_details=True):
        tickets = [self.fetch_ticket_detail(91)]
        return tickets[:per_page]

    def fetch_ticket_detail(self, ticket_id):
        return {
            "id": ticket_id,
            "ticket_number": f"TKT-{ticket_id}",
            "subject": "Payment pending",
            "message": "I paid but the course is not showing.",
            "status": "open",
            "priority": "high",
            "replies": [],
        }

    def post_ticket_reply(self, ticket_id, reply):
        self.sent.append((ticket_id, reply))
        return {"ticket_id": ticket_id, "reply": reply, "status": "sent"}

    def close(self):
        return None


@pytest.fixture
def test_db(tmp_path, monkeypatch):
    db_path = tmp_path / "marvin.sqlite3"

    def fake_connect(path):
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    client = FakeVityarthiClient()
    monkeypatch.setattr("marvin_core.marvin_api.connect", fake_connect)
    monkeypatch.setattr("marvin_core.marvin_api._support_rag_database_path", lambda: str(db_path))
    monkeypatch.setattr("marvin_core.marvin_api._vityarthi_client", lambda: client)
    monkeypatch.setattr("marvin_core.agents.support_reply.SupportRagEngine", FakeSupportEngine)

    conn = fake_connect(db_path)
    from marvin_core.db import migrate

    migrate(conn)
    conn.close()
    return db_path, client


def test_create_support_reply_workflow_and_approve(test_db):
    _db_path, client = test_db

    created = create_support_reply_workflow_endpoint(SupportReplyWorkflowRequest(ticket_id=91))
    approval = created["approval"]

    assert approval["status"] == "pending"
    assert approval["run"]["status"] == "waiting_approval"
    assert approval["draft_content"]["ticket_id"] == 91

    pending = list_approvals_endpoint()
    assert len(pending["approvals"]) == 1

    approved = approve_approval_endpoint(
        approval["id"],
        ApprovalActionRequest(reviewer="ravi", final_reply="Final approved reply"),
    )
    updated = approved["approval"]

    assert updated["status"] == "approved"
    assert updated["edited_content"]["reply"] == "Final approved reply"
    assert updated["run"]["status"] == "completed"
    assert client.sent == [(91, "Final approved reply")]

    detail = get_approval_endpoint(approval["id"])
    assert detail["approval"]["status"] == "approved"
    assert len(detail["approval"]["steps"]) == 2


def test_reject_support_reply_moves_item_to_history(test_db):
    _db_path, _client = test_db

    created = create_support_reply_workflow_endpoint(SupportReplyWorkflowRequest(ticket_id=99))
    approval = created["approval"]

    rejected = reject_approval_endpoint(
        approval["id"],
        ApprovalActionRequest(reviewer="ravi", reason="Needs manual handling"),
    )

    assert rejected["approval"]["status"] == "rejected"
    assert rejected["approval"]["rejection_reason"] == "Needs manual handling"
    assert rejected["approval"]["run"]["status"] == "cancelled"

    history = list_approvals_endpoint(view="history")
    assert len(history["approvals"]) == 1
    assert history["approvals"][0]["status"] == "rejected"


def test_sync_support_reply_workflows_skips_existing_pending_items(test_db):
    _db_path, _client = test_db

    first = sync_support_reply_workflows_endpoint(limit=25)
    second = sync_support_reply_workflows_endpoint(limit=25)

    assert first["created_count"] == 1
    assert second["created_count"] == 0
    assert second["skipped_ticket_ids"] == [91]
