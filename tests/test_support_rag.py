import json

from marvin_core.db import (
    connect,
    get_support_rag_suggestion,
    insert_support_rag_suggestion,
    migrate,
    update_support_rag_suggestion,
)
from marvin_core.support_rag import (
    LexicalSupportStore,
    SupportRagEngine,
    build_examples_from_csv,
    infer_support_category,
    write_examples_jsonl,
)


def write_csv(path, content):
    path.write_text(content.strip() + "\n", encoding="utf-8")


def test_build_examples_pairs_customer_context_with_staff_reply(tmp_path):
    tickets_path = tmp_path / "support_tickets_export_2026.csv"
    replies_path = tmp_path / "support_ticket_replies_export_2026.csv"
    write_csv(
        tickets_path,
        """
id,ticket_number,user_id,subject,status,priority,created_at,updated_at
15,TKT-15,22730,Payment not reflecting,closed,high,2025-07-08 14:25:34,2025-07-10 18:18:06
16,TKT-16,1,Testing ticket,closed,medium,2025-07-08 14:25:34,2025-07-10 18:18:06
""",
    )
    write_csv(
        replies_path,
        """
id,ticket_id,user_id,message,created_at,updated_at
1,15,22730,I paid but the course is not showing,2025-07-08 14:25:34,2025-07-08 14:25:34
2,15,1,"Hi, unfortunately the payment was not captured and the amount will be refunded in 5 to 7 working days.",2025-07-10 18:18:06,2025-07-10 18:18:06
3,16,1,Testing new ticket,2025-07-08 14:25:34,2025-07-08 14:25:34
4,16,2,Yo this is reply man,2025-07-10 18:18:06,2025-07-10 18:18:06
""",
    )

    examples = build_examples_from_csv(tickets_path=tickets_path, replies_path=replies_path)

    assert len(examples) == 1
    assert examples[0].ticket_id == "15"
    assert examples[0].category == "payment_refund"
    assert "I paid" in examples[0].customer_message
    assert "payment was not captured" in examples[0].staff_reply


def test_lexical_store_retrieves_matching_payment_example(tmp_path):
    tickets_path = tmp_path / "support_tickets_export_2026.csv"
    replies_path = tmp_path / "support_ticket_replies_export_2026.csv"
    write_csv(
        tickets_path,
        """
id,ticket_number,user_id,subject,status,priority,created_at,updated_at
15,TKT-15,22730,Payment not reflecting,closed,high,2025-07-08 14:25:34,2025-07-10 18:18:06
20,TKT-20,300,Certificate date changed,closed,medium,2025-07-08 14:25:34,2025-07-10 18:18:06
""",
    )
    write_csv(
        replies_path,
        """
id,ticket_id,user_id,message,created_at,updated_at
1,15,22730,I paid but the course is not showing,2025-07-08 14:25:34,2025-07-08 14:25:34
2,15,1,"Hi, unfortunately the payment was not captured and the amount will be refunded in 5 to 7 working days.",2025-07-10 18:18:06,2025-07-10 18:18:06
3,20,300,My certificate date is updated after download,2025-07-08 14:25:34,2025-07-08 14:25:34
4,20,1,"Hi, downloading the certificate regenerates it after course structure changes.",2025-07-10 18:18:06,2025-07-10 18:18:06
""",
    )
    examples = build_examples_from_csv(tickets_path=tickets_path, replies_path=replies_path)
    store = LexicalSupportStore(examples)

    matches = store.search("payment completed but course purchase is pending", category="payment_refund")

    assert matches
    assert matches[0].ticket_id == "15"
    assert matches[0].category == "payment_refund"


def test_support_engine_uses_jsonl_fallback_and_flags_payment(tmp_path):
    tickets_path = tmp_path / "support_tickets_export_2026.csv"
    replies_path = tmp_path / "support_ticket_replies_export_2026.csv"
    examples_path = tmp_path / "examples.jsonl"
    write_csv(
        tickets_path,
        """
id,ticket_number,user_id,subject,status,priority,created_at,updated_at
15,TKT-15,22730,Payment not reflecting,closed,high,2025-07-08 14:25:34,2025-07-10 18:18:06
""",
    )
    write_csv(
        replies_path,
        """
id,ticket_id,user_id,message,created_at,updated_at
1,15,22730,I paid but the course is not showing,2025-07-08 14:25:34,2025-07-08 14:25:34
2,15,1,"Hi, unfortunately the payment was not captured and the amount will be refunded in 5 to 7 working days.",2025-07-10 18:18:06,2025-07-10 18:18:06
""",
    )
    examples = build_examples_from_csv(tickets_path=tickets_path, replies_path=replies_path)
    write_examples_jsonl(examples, examples_path)
    engine = SupportRagEngine(examples_path=examples_path, kb_dir=tmp_path / "missing", prefer_qdrant=False)

    suggestion = engine.suggest(
        {
            "id": 99,
            "subject": "Purchase pending",
            "message": "I paid for the Java course but it is not showing in my courses.",
            "replies": [],
        }
    )

    assert suggestion.retrieval_backend == "lexical_jsonl"
    assert suggestion.matched_examples
    assert suggestion.requires_human_attention is True
    assert any("payment" in flag.lower() for flag in suggestion.policy_flags)
    assert "payment" in suggestion.suggested_reply.lower()


def test_support_rag_audit_persistence(tmp_path):
    conn = connect(tmp_path / "marvin.sqlite3")
    migrate(conn)

    stored = insert_support_rag_suggestion(
        conn,
        ticket_id=99,
        ticket_number="TKT-99",
        subject="Payment",
        customer_message="I paid",
        suggested_reply="Please verify the payment.",
        confidence="medium",
        requires_human_attention=True,
        retrieval_backend="lexical_jsonl",
        matched_examples=[{"ticket_id": "15", "score": 0.5}],
        policy_flags=["Verify payment."],
        source={"ticket": {"id": 99}},
        created_at="2026-06-16T00:00:00+00:00",
    )

    assert stored["id"] > 0
    assert stored["matched_examples"][0]["ticket_id"] == "15"

    updated = update_support_rag_suggestion(
        conn,
        suggestion_id=stored["id"],
        status="sent",
        final_reply="Final reply",
        sent_at="2026-06-16T00:01:00+00:00",
        updated_at="2026-06-16T00:01:00+00:00",
    )

    fetched = get_support_rag_suggestion(conn, stored["id"])
    assert updated["status"] == "sent"
    assert fetched["final_reply"] == "Final reply"
    assert json.dumps(fetched["source"])


def test_infer_support_category():
    assert infer_support_category("Quiz auto submitted", "Need reattempt") == "exam_quiz"
    assert infer_support_category("Certificate date issue", "Download changed date") == "certificate"
