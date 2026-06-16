import json
from unittest.mock import MagicMock, patch

from marvin_core.db import (
    connect,
    create_task_run,
    insert_vityarthi_support_ticket_observations,
    migrate,
)
from tasks.vityarthi_support_tickets.analysis import (
    build_factual_payload,
    build_messages,
    compute_risk_level,
    dry_run_analysis,
)
from tasks.vityarthi_support_tickets.vityarthi import (
    normalize_ticket,
    normalize_ticket_detail,
    normalize_reply,
)


class TestNormalizeTicket:
    def test_normalize_ticket_extracts_owner_from_user_field(self):
        ticket = {
            "id": 42,
            "subject": "Cannot login",
            "status": "open",
            "priority": "high",
            "category": "auth",
            "created_at": "2026-06-13T10:00:00Z",
            "updated_at": "2026-06-13T11:00:00Z",
            "user": {"id": 5, "name": "Ravi", "email": "ravi@example.com"},
        }
        result = normalize_ticket(ticket)
        assert result["id"] == 42
        assert result["subject"] == "Cannot login"
        assert result["owner_name"] == "Ravi"
        assert result["owner_email"] == "ravi@example.com"

    def test_normalize_ticket_falls_back_to_owner_field(self):
        ticket = {
            "id": 1,
            "subject": "Test",
            "status": "open",
            "owner": {"id": 10, "name": "Admin", "email": "admin@example.com"},
        }
        result = normalize_ticket(ticket)
        assert result["owner_name"] == "Admin"
        assert result["owner_email"] == "admin@example.com"

    def test_normalize_ticket_handles_missing_user(self):
        ticket = {"id": 1, "subject": "Test", "status": "open"}
        result = normalize_ticket(ticket)
        assert result["owner_name"] is None
        assert result["owner_email"] is None


class TestNormalizeTicketDetail:
    def test_normalize_reply_uses_owner_id_for_customer_role(self):
        result = normalize_reply(
            {"id": 1, "user_id": 44, "message": "Help"},
            owner_id=44,
        )
        assert result["role"] == "customer"

    def test_normalize_reply_maps_admin_to_staff(self):
        result = normalize_reply(
            {"id": 1, "message": "Done", "user": {"id": 1, "role": "admin"}},
            owner_id=44,
        )
        assert result["role"] == "staff"

    def test_normalize_ticket_detail_counts_replies_and_attachments(self):
        detail = {
            "id": 10,
            "subject": "Bug",
            "status": "open",
            "priority": "medium",
            "message": "Something broke",
            "created_at": "2026-06-13T00:00:00Z",
            "updated_at": "2026-06-13T01:00:00Z",
            "user": {"id": 1, "name": "A", "email": "a@b.c"},
            "replies": [
                {"id": 1, "user": {"role": "admin"}},
                {"id": 2, "user": {"role": "student"}},
            ],
            "attachments": [{"id": 1}, {"id": 2}, {"id": 3}],
        }
        result = normalize_ticket_detail(detail)
        assert result["reply_count"] == 2
        assert result["attachment_count"] == 3
        assert result["has_staff_reply"] is True
        assert result["owner_name"] == "A"

    def test_normalize_ticket_detail_no_staff_reply(self):
        detail = {
            "id": 11,
            "subject": "Question",
            "status": "open",
            "priority": "low",
            "message": "Help",
            "user": {},
            "replies": [{"id": 1, "user": {"role": "student"}}],
            "attachments": [],
        }
        result = normalize_ticket_detail(detail)
        assert result["has_staff_reply"] is False


class TestBuildFactualPayload:
    def test_build_factual_payload_with_tickets(self):
        ticket_counts = {"open": 5, "replied": 3, "closed": 10, "total": 18}
        open_tickets = [
            {"id": 1, "subject": "Bug A", "status": "open", "priority": "high", "category": "tech", "created_at": "2026-06-13T10:00:00Z", "owner_name": "Alice", "owner_email": "a@b.c", "owner_id": 1},
            {"id": 2, "subject": "Bug B", "status": "open", "priority": "medium", "category": "billing", "created_at": "2026-06-13T09:00:00Z", "owner_name": "Bob", "owner_email": "b@c.d", "owner_id": 2},
            {"id": 3, "subject": "Bug C", "status": "open", "priority": "low", "category": "tech", "created_at": "2026-06-13T08:00:00Z", "owner_name": "Carol", "owner_email": "c@d.e", "owner_id": 3},
            {"id": 4, "subject": "Bug D", "status": "open", "priority": "high", "category": "auth", "created_at": "2026-06-13T07:00:00Z", "owner_name": "Dave", "owner_email": "d@e.f", "owner_id": 4},
        ]
        open_ticket_details = [
            {"id": 1, "message": "Detailed bug A", "reply_count": 0, "has_staff_reply": False},
            {"id": 2, "message": "Detailed bug B", "reply_count": 1, "has_staff_reply": True},
        ]

        payload = build_factual_payload(
            task_name="vityarthi_support_tickets",
            observed_at="2026-06-13T12:00:00Z",
            ticket_counts=ticket_counts,
            open_tickets=open_tickets,
            open_ticket_details=open_ticket_details,
            summary_limit=3,
        )

        assert payload["open_ticket_count"] == 5
        assert payload["replied_ticket_count"] == 3
        assert payload["closed_ticket_count"] == 10
        assert payload["total_ticket_count"] == 18
        assert payload["total_open_tickets"] == 4
        assert payload["has_more_open_tickets_than_summarized"] is True
        assert len(payload["top_recent_open_tickets"]) == 3
        assert payload["top_recent_open_tickets"][0]["subject"] == "Bug A"

    def test_build_factual_payload_no_more_tickets(self):
        ticket_counts = {"open": 2, "replied": 0, "closed": 5, "total": 7}
        open_tickets = [
            {"id": 1, "subject": "Issue 1", "status": "open", "priority": "low", "category": None, "created_at": "2026-06-13T10:00:00Z", "owner_name": None, "owner_email": None, "owner_id": None},
        ]

        payload = build_factual_payload(
            task_name="vityarthi_support_tickets",
            observed_at="2026-06-13T12:00:00Z",
            ticket_counts=ticket_counts,
            open_tickets=open_tickets,
            open_ticket_details=[],
            summary_limit=3,
        )

        assert payload["has_more_open_tickets_than_summarized"] is False
        assert len(payload["top_recent_open_tickets"]) == 1

    def test_build_factual_payload_priority_and_category_breakdown(self):
        ticket_counts = {"open": 3, "replied": 0, "closed": 0, "total": 3}
        open_tickets = [
            {"id": 1, "subject": "A", "status": "open", "priority": "high", "category": "tech", "created_at": "2026-06-13T10:00:00Z", "owner_name": "A", "owner_email": "a@b", "owner_id": 1},
            {"id": 2, "subject": "B", "status": "open", "priority": "high", "category": "billing", "created_at": "2026-06-13T09:00:00Z", "owner_name": "B", "owner_email": "b@c", "owner_id": 2},
            {"id": 3, "subject": "C", "status": "open", "priority": "low", "category": "tech", "created_at": "2026-06-13T08:00:00Z", "owner_name": "C", "owner_email": "c@d", "owner_id": 3},
        ]

        payload = build_factual_payload(
            task_name="vityarthi_support_tickets",
            observed_at="2026-06-13T12:00:00Z",
            ticket_counts=ticket_counts,
            open_tickets=open_tickets,
            open_ticket_details=[],
            summary_limit=3,
        )

        assert payload["open_by_priority"] == {"high": 2, "low": 1}
        assert payload["open_by_category"] == {"tech": 2, "billing": 1}


class TestComputeRiskLevel:
    def test_high_risk_with_urgent_open_tickets(self):
        payload = {
            "open_ticket_count": 3,
            "open_by_priority": {"high": 2, "low": 1},
        }
        assert compute_risk_level(payload) == "high"

    def test_medium_risk_with_many_open_tickets(self):
        payload = {
            "open_ticket_count": 10,
            "open_by_priority": {"low": 10},
        }
        assert compute_risk_level(payload) == "medium"

    def test_low_risk_with_few_open_tickets(self):
        payload = {
            "open_ticket_count": 2,
            "open_by_priority": {"low": 2},
        }
        assert compute_risk_level(payload) == "low"

    def test_low_risk_with_no_open_tickets(self):
        payload = {
            "open_ticket_count": 0,
            "open_by_priority": {},
        }
        assert compute_risk_level(payload) == "low"

    def test_critical_priority_keyword(self):
        payload = {
            "open_ticket_count": 1,
            "open_by_priority": {"critical": 1},
        }
        assert compute_risk_level(payload) == "high"

    def test_urgent_priority_keyword(self):
        payload = {
            "open_ticket_count": 1,
            "open_by_priority": {"urgent": 1},
        }
        assert compute_risk_level(payload) == "high"


class TestDryRunAnalysis:
    def test_dry_run_no_open_tickets(self):
        payload = {
            "open_ticket_count": 0,
            "replied_ticket_count": 0,
            "closed_ticket_count": 5,
            "total_ticket_count": 5,
            "open_by_priority": {},
            "summary_limit": 3,
            "has_more_open_tickets_than_summarized": False,
            "top_recent_open_tickets": [],
        }
        result = dry_run_analysis(payload)
        assert result["risk_level"] == "low"
        assert "No open support tickets" in result["summary"]

    def test_dry_run_with_more_tickets_than_summarized(self):
        payload = {
            "open_ticket_count": 5,
            "replied_ticket_count": 2,
            "closed_ticket_count": 10,
            "total_ticket_count": 17,
            "open_by_priority": {"medium": 5},
            "summary_limit": 3,
            "has_more_open_tickets_than_summarized": True,
            "top_recent_open_tickets": [
                {"id": 1, "subject": "T1", "owner_name": "A"},
            ],
        }
        result = dry_run_analysis(payload)
        assert "didn't have to go through more" in result["summary"]

    def test_dry_run_includes_priority_and_ticket_summary(self):
        payload = {
            "open_ticket_count": 2,
            "replied_ticket_count": 1,
            "closed_ticket_count": 3,
            "total_ticket_count": 6,
            "open_by_priority": {"high": 1, "low": 1},
            "summary_limit": 3,
            "has_more_open_tickets_than_summarized": False,
            "top_recent_open_tickets": [
                {"id": 1, "subject": "Login issue", "owner_name": "Ravi"},
            ],
        }
        result = dry_run_analysis(payload)
        assert any("Open tickets: 2" in f for f in result["notable_facts"])
        assert any("priority 'high'" in f for f in result["notable_facts"])


class TestBuildMessages:
    def test_build_messages_includes_style_and_payload(self, tmp_path):
        prompts = tmp_path / "prompts"
        prompts.mkdir()
        (prompts / "system.md").write_text("system", encoding="utf-8")
        (prompts / "user.md").write_text(
            "Style={communication_style}\nPayload={payload}",
            encoding="utf-8",
        )

        messages = build_messages(
            prompts_dir=prompts,
            communication_style="be sardonic",
            factual_payload={"open_ticket_count": 3},
        )

        assert messages[0] == {"role": "system", "content": "system"}
        assert "be sardonic" in messages[1]["content"]
        assert json.dumps({"open_ticket_count": 3}, indent=2, sort_keys=True) in messages[1]["content"]


class TestDatabaseInsertions:
    def test_insert_support_ticket_observations(self, tmp_path):
        conn = connect(tmp_path / "marvin.sqlite3")
        migrate(conn)

        run_id = create_task_run(conn, "vityarthi_support_tickets", "2026-06-13T00:00:00+00:00")
        ticket_counts = {"open": 2, "replied": 1, "closed": 5, "total": 8}
        open_tickets = [
            {"id": 1, "subject": "Bug", "status": "open", "priority": "high", "category": "tech", "owner_id": 10, "owner_name": "Alice", "owner_email": "a@b.c", "created_at": "2026-06-13T10:00:00Z", "updated_at": "2026-06-13T11:00:00Z"},
            {"id": 2, "subject": "Issue", "status": "open", "priority": "low", "category": "billing", "owner_id": 11, "owner_name": "Bob", "owner_email": "b@c.d", "created_at": "2026-06-13T09:00:00Z", "updated_at": "2026-06-13T10:00:00Z"},
        ]

        insert_vityarthi_support_ticket_observations(conn, run_id, "2026-06-13T00:00:00+00:00", ticket_counts, open_tickets)

        ticket_rows = conn.execute("SELECT * FROM vityarthi_support_ticket_observations").fetchall()
        assert len(ticket_rows) == 2

        count_rows = conn.execute("SELECT * FROM vityarthi_ticket_count_snapshots").fetchall()
        assert len(count_rows) == 1
        assert count_rows[0]["open_count"] == 2
        assert count_rows[0]["replied_count"] == 1
        assert count_rows[0]["closed_count"] == 5
        assert count_rows[0]["total_count"] == 8

        conn.close()


class TestVityarthiClient:
    def test_fetch_ticket_counts_parses_api_response(self):
        from tasks.vityarthi_support_tickets.vityarthi import VityarthiSupportClient

        client = VityarthiSupportClient("https://example.com", "fake-token")

        mock_responses = {
            "open": {"success": True, "data": {"tickets": [], "meta": {"current_page": 1, "per_page": 1, "total": 1, "last_page": 1}}},
            "replied": {"success": True, "data": {"tickets": [], "meta": {"current_page": 1, "per_page": 1, "total": 635, "last_page": 635}}},
            "closed": {"success": True, "data": {"tickets": [], "meta": {"current_page": 1, "per_page": 1, "total": 318, "last_page": 318}}},
        }

        def mock_get(url, params=None, timeout=None):
            status = params["status"]
            resp = MagicMock()
            resp.json.return_value = mock_responses[status]
            resp.raise_for_status.return_value = None
            return resp

        with patch.object(client.session, "get", side_effect=mock_get):
            counts = client.fetch_ticket_counts()

        assert counts == {"open": 1, "replied": 635, "closed": 318, "total": 954}

    def test_fetch_open_tickets_parses_tickets_from_data(self):
        from tasks.vityarthi_support_tickets.vityarthi import VityarthiSupportClient

        client = VityarthiSupportClient("https://example.com", "fake-token")

        api_response = {
            "success": True,
            "data": {
                "tickets": [
                    {"id": 959, "subject": "Python Essentials Certificate", "status": "open", "priority": "medium", "user": {"id": 5646, "name": "Divyanshu", "email": "d@example.com"}},
                ],
                "meta": {"current_page": 1, "per_page": 50, "total": 1, "last_page": 1},
            },
        }

        with patch.object(client.session, "get") as mock_get:
            from unittest.mock import MagicMock
            resp = MagicMock()
            resp.json.return_value = api_response
            resp.raise_for_status.return_value = None
            mock_get.return_value = resp

            tickets = client.fetch_open_tickets(per_page=50)

        assert len(tickets) == 1
        assert tickets[0]["id"] == 959
        assert tickets[0]["subject"] == "Python Essentials Certificate"
        assert tickets[0]["owner_name"] == "Divyanshu"

    def test_post_ticket_reply_posts_message(self):
        from tasks.vityarthi_support_tickets.vityarthi import VityarthiSupportClient

        client = VityarthiSupportClient("https://example.com", "fake-token")

        with patch.object(client.session, "post") as mock_post:
            resp = MagicMock()
            resp.json.return_value = {"success": True, "data": {"id": 5, "message": "Sent"}}
            resp.raise_for_status.return_value = None
            mock_post.return_value = resp

            result = client.post_ticket_reply(99, "Approved reply")

        mock_post.assert_called_once_with(
            "https://example.com/api/v1/system/support/tickets/99/replies",
            json={"message": "Approved reply"},
            timeout=30,
        )
        assert result == {"id": 5, "message": "Sent"}
