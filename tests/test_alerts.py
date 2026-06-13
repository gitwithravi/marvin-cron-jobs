from marvin_core import alerts


def test_read_latest_alert_when_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(alerts, "ALERT_DIR", tmp_path / "alert")

    latest = alerts.read_latest_alert()

    assert latest["exists"] is False
    assert "Generating your alert" in latest["message"]


def test_generate_alert_writes_timestamped_file_and_latest(monkeypatch, tmp_path):
    monkeypatch.setattr(alerts, "ALERT_DIR", tmp_path / "alert")
    monkeypatch.setattr(
        alerts,
        "build_reminder_digest",
        lambda: {"message": "Do the important thing.", "source": "fallback"},
    )
    monkeypatch.setattr(alerts, "list_todos", lambda include_done=False: [])

    latest = alerts.generate_alert()
    files = list((tmp_path / "alert").glob("alert-*.md"))

    assert latest["exists"] is True
    assert len(files) == 1
    assert latest["file_name"] == files[0].name
    assert (tmp_path / "alert" / "latest.md").exists()
    assert "Do the important thing." in latest["message"]
