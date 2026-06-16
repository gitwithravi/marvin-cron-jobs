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
