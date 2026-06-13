from marvin_core.notifications.dispatcher import (
    build_notification_message,
    dispatch_notifications,
    should_dispatch_notifications,
)
from marvin_core.notifications.telegram import TelegramNotificationError, validate_bot_token
import pytest


def test_should_dispatch_notifications_uses_threshold():
    config = {"enabled": True, "risk_threshold": "medium"}

    assert not should_dispatch_notifications("low", config)
    assert should_dispatch_notifications("medium", config)
    assert should_dispatch_notifications("high", config)


def test_dispatch_console_channel(capsys):
    results = dispatch_notifications(
        task_name="example",
        risk_level="medium",
        analysis={"summary": "Something is unhappy."},
        report_path="reports/example.md",
        config={"enabled": True, "risk_threshold": "medium", "channels": ["console"]},
    )

    captured = capsys.readouterr()
    assert results[0].channel == "console"
    assert results[0].status == "sent"
    assert "Risk: medium" in captured.out
    assert "reports/example.md" in captured.out


def test_dispatch_skips_below_threshold():
    results = dispatch_notifications(
        task_name="example",
        risk_level="low",
        analysis={"summary": "Everything is fine, regrettably."},
        report_path=None,
        config={"enabled": True, "risk_threshold": "medium", "channels": ["console"]},
    )

    assert results == []


def test_build_notification_message_can_omit_report_path():
    message = build_notification_message(
        task_name="example",
        risk_level="high",
        summary="The service is down.",
        report_path=None,
    )

    assert "MARVIN alert: example" in message
    assert "Risk: high" in message
    assert "Report:" not in message


def test_validate_bot_token_rejects_username():
    with pytest.raises(TelegramNotificationError):
        validate_bot_token("ravi_marvin_notify_bot")


def test_validate_bot_token_accepts_botfather_shape():
    validate_bot_token("123456789:AA_REPLACE_WITH_BOTFATHER_TOKEN")
