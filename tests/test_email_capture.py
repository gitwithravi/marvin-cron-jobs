import pytest

from marvin_core import email_capture, todos


def use_tmp_db(monkeypatch, tmp_path):
    db_path = tmp_path / "marvin.sqlite3"
    monkeypatch.setattr(email_capture, "DATABASE_PATH", db_path)
    monkeypatch.setattr(todos, "DATABASE_PATH", db_path)
    monkeypatch.setenv("MARVIN_ALLOWED_FORWARDERS", "ravi@vitbhopal.ac.in")
    monkeypatch.setenv("LLM_EMAIL_CAPTURE_ENABLED", "false")
    monkeypatch.setenv("MARVIN_EMAIL_STORAGE_PATH", str(tmp_path / "email-capture"))
    monkeypatch.setattr(email_capture, "send_ntfy_message", lambda *_args, **_kwargs: None)
    return db_path


def payload(**overrides):
    data = {
        "from": "ravi@vitbhopal.ac.in",
        "to": "marvin@vitbhopal.dev",
        "subject": "Fwd: Pending invoice approval",
        "messageId": "<invoice-1@example.com>",
        "date": "2026-06-16T10:30:00+05:30",
        "headers": {"content-type": "text/plain"},
        "textBody": "Please do this tomorrow before lunch.\n\n---------- Forwarded message ---------\nFrom: vendor@example.com\nPending invoice approval.",
        "htmlBody": None,
        "rawEmail": "Subject: Fwd: Pending invoice approval\n\nbody",
        "attachments": [],
    }
    data.update(overrides)
    return data


def test_email_capture_creates_inbox_todo(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    result = email_capture.process_email_capture(payload())
    created = todos.list_todos(source="email", include_done=True)

    assert result["success"] is True
    assert result["duplicate"] is False
    assert len(created) == 1
    assert created[0]["status"] == "inbox"
    assert created[0]["source"] == "email"
    assert created[0]["reviewed"] is False
    assert created[0]["source_ref_id"] == result["emailCaptureId"]


def test_email_capture_rejects_unauthorized_sender(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    with pytest.raises(email_capture.EmailCaptureUnauthorized):
        email_capture.process_email_capture(payload(**{"from": "stranger@example.com"}))

    assert todos.list_todos(include_done=True) == []
    captures = email_capture.list_email_captures()
    assert captures[0]["status"] == "rejected"


def test_email_capture_urgent_alias_sets_priority(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    result = email_capture.process_email_capture(payload(to="marvin+urgent@vitbhopal.dev"))
    created = todos.list_todos(source="email", include_done=True)

    assert result["priority"] == "urgent"
    assert created[0]["priority"] == "urgent"


def test_email_capture_project_alias_sets_project(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    result = email_capture.process_email_capture(payload(to="marvin+vityarthi@vitbhopal.dev"))
    created = todos.list_todos(source="email", include_done=True)

    assert result["project"] == "vityarthi"
    assert created[0]["project"] == "vityarthi"


def test_email_capture_user_note_sets_due_date(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    email_capture.process_email_capture(payload())
    created = todos.list_todos(source="email", include_done=True)

    assert created[0]["due_date"] == "2026-06-17"


def test_email_capture_duplicate_does_not_create_second_todo(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    first = email_capture.process_email_capture(payload())
    second = email_capture.process_email_capture(payload())
    created = todos.list_todos(source="email", include_done=True)

    assert first["taskId"] == second["taskId"]
    assert second["duplicate"] is True
    assert len(created) == 1


def test_email_capture_ntfy_failure_does_not_block_todo(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    def fail_ntfy(*_args, **_kwargs):
        raise email_capture.NtfyNotificationError("ntfy down")

    monkeypatch.setattr(email_capture, "send_ntfy_message", fail_ntfy)

    result = email_capture.process_email_capture(payload())
    capture = email_capture.get_email_capture(result["emailCaptureId"])

    assert result["success"] is True
    assert capture is not None
    assert capture["notificationStatus"] == "failed"
    assert "ntfy down" in capture["notificationError"]


RAW_EMAIL_BYTES = (
    b"From: sender@example.com\r\n"
    b"To: marvin+vityarthi@vitbhopal.dev\r\n"
    b"Subject: Test email\r\n"
    b"Message-ID: <test-id@example.com>\r\n"
    b"Date: Mon, 16 Jun 2026 10:30:00 +0530\r\n"
    b"Content-Type: text/plain; charset=utf-8\r\n"
    b"\r\n"
    b"Hello MARVIN, please review this."
)


def test_parse_email_bytes_extracts_headers():
    result = email_capture._parse_email_bytes(RAW_EMAIL_BYTES)

    assert result["from"] == "sender@example.com"
    assert result["to"] == "marvin+vityarthi@vitbhopal.dev"
    assert result["subject"] == "Test email"
    assert result["messageId"] == "<test-id@example.com>"
    assert "16 Jun 2026" in result["date"]
    assert "content-type" in {k.lower() for k in result["headers"]}


def test_parse_email_bytes_extracts_text_body():
    result = email_capture._parse_email_bytes(RAW_EMAIL_BYTES)

    assert result["textBody"] == "Hello MARVIN, please review this."
    assert result["htmlBody"] is None


def test_parse_email_bytes_includes_raw_email():
    result = email_capture._parse_email_bytes(RAW_EMAIL_BYTES)

    assert "From: sender@example.com" in result["rawEmail"]
    assert "Hello MARVIN" in result["rawEmail"]


def test_parse_email_bytes_handles_empty_body():
    raw = b"From: a@b.com\r\nTo: c@d.com\r\nSubject: empty\r\n\r\n"
    result = email_capture._parse_email_bytes(raw)

    assert result["from"] == "a@b.com"
    assert not result["textBody"]


def test_parse_email_bytes_empty_attachments():
    result = email_capture._parse_email_bytes(RAW_EMAIL_BYTES)

    assert result["attachments"] == []


def test_process_imap_emails_creates_todos(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    def fake_fetch(_host, _username, _password, _port, _folder, _mark_read):
        return [
            {
                "from": "ravi@vitbhopal.ac.in",
                "to": "marvin@vitbhopal.dev",
                "subject": "Fwd: IMAP test",
                "messageId": "<imap-1@example.com>",
                "date": "2026-06-16T10:30:00+05:30",
                "headers": {"content-type": "text/plain"},
                "textBody": "Review this from IMAP.",
                "htmlBody": None,
                "rawEmail": "Subject: Fwd: IMAP test\n\nbody",
                "attachments": [],
            }
        ]

    monkeypatch.setattr(email_capture, "fetch_imap_emails", fake_fetch)

    results = email_capture.process_imap_emails(
        host="imap.example.com",
        username="marvin",
        password="secret",
    )

    assert len(results) == 1
    assert results[0]["success"] is True
    assert results[0]["duplicate"] is False

    created = todos.list_todos(source="email", include_done=True)
    assert len(created) == 1
    assert created[0]["title"] == "Review email: IMAP test"


def test_process_imap_emails_handles_rejected_sender(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    def fake_fetch(*_args, **_kwargs):
        return [
            {
                "from": "stranger@example.com",
                "to": "marvin@vitbhopal.dev",
                "subject": "Spam",
                "messageId": "<spam-1@example.com>",
                "date": "2026-06-16T10:30:00+05:30",
                "headers": {},
                "textBody": "spam",
                "htmlBody": None,
                "rawEmail": "raw",
                "attachments": [],
            }
        ]

    monkeypatch.setattr(email_capture, "fetch_imap_emails", fake_fetch)

    results = email_capture.process_imap_emails(
        host="imap.example.com",
        username="marvin",
        password="secret",
    )

    assert len(results) == 1
    assert results[0]["success"] is False
    assert "stranger@example.com" == results[0]["from"]
    assert len(todos.list_todos(source="email", include_done=True)) == 0


def test_process_imap_emails_no_emails(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)
    monkeypatch.setattr(email_capture, "fetch_imap_emails", lambda *_a, **_kw: [])

    results = email_capture.process_imap_emails(
        host="imap.example.com",
        username="marvin",
        password="secret",
    )

    assert results == []


def test_process_imap_emails_mixed_results(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    def fake_fetch(*_args, **_kwargs):
        return [
            {
                "from": "ravi@vitbhopal.ac.in",
                "to": "marvin@vitbhopal.dev",
                "subject": "Good email",
                "messageId": "<good-1@example.com>",
                "date": "2026-06-16T10:30:00+05:30",
                "headers": {},
                "textBody": "Valid task.",
                "htmlBody": None,
                "rawEmail": "raw",
                "attachments": [],
            },
            {
                "from": "hacker@evil.com",
                "to": "marvin@vitbhopal.dev",
                "subject": "Bad email",
                "messageId": "<bad-1@example.com>",
                "date": "2026-06-16T10:30:00+05:30",
                "headers": {},
                "textBody": "phish",
                "htmlBody": None,
                "rawEmail": "raw",
                "attachments": [],
            },
        ]

    monkeypatch.setattr(email_capture, "fetch_imap_emails", fake_fetch)

    results = email_capture.process_imap_emails(
        host="imap.example.com",
        username="marvin",
        password="secret",
    )

    assert len(results) == 2
    assert results[0]["success"] is True
    assert results[1]["success"] is False
    created = todos.list_todos(source="email", include_done=True)
    assert len(created) == 1
