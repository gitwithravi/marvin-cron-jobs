import pytest
from unittest.mock import patch, MagicMock
from marvin_core.task_registry import discover_tasks
from marvin_core.agent import classify_intent, execute_task, read_report, process_message


def test_discover_tasks():
    tasks = discover_tasks()
    assert isinstance(tasks, list)
    assert len(tasks) > 0
    # Ensure standard task names are found
    task_names = {t["task_name"] for t in tasks}
    assert "uptime_kuma_heartbeat" in task_names
    assert "beszel_server_status" in task_names
    assert "team_status_today" in task_names


def test_execute_nonexistent_task():
    result = execute_task("nonexistent_task_xyz")
    assert result["status"] == "failed"
    assert result["error"] is not None


def test_read_report_nonexistent_task():
    with pytest.raises(FileNotFoundError):
        read_report("nonexistent_task_xyz")


@patch("marvin_core.agent.OpenRouterClient")
def test_classify_intent_mock(mock_client_class, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    # Mock OpenRouter Client response
    mock_client = MagicMock()
    mock_client.chat_json.return_value = {
        "intent": "execute",
        "task_name": "beszel_server_status",
        "params": {}
    }
    mock_client_class.return_value = mock_client

    registry = discover_tasks()
    result = classify_intent("run the beszel check", registry)
    assert result["intent"] == "execute"
    assert result["task_name"] == "beszel_server_status"


@patch("marvin_core.agent.OpenRouterClient")
def test_classify_intent_falls_back_when_openrouter_fails(mock_client_class, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.chat_json.side_effect = RuntimeError("network unavailable")
    mock_client_class.return_value = mock_client

    registry = discover_tasks()
    result = classify_intent("run the beszel server check", registry)

    assert result == {
        "intent": "execute",
        "task_name": "beszel_server_status",
        "params": {},
    }


@patch("marvin_core.agent.OpenRouterClient")
def test_classify_intent_normalizes_invalid_llm_task_name(mock_client_class, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.chat_json.return_value = {
        "intent": "read_report",
        "task_name": "servers",
        "params": None,
    }
    mock_client_class.return_value = mock_client

    registry = discover_tasks()
    result = classify_intent("show server status", registry)

    assert result["intent"] == "read_report"
    assert result["task_name"] == "beszel_server_status"
    assert result["params"] == {}


@patch("marvin_core.agent.OpenRouterClient")
def test_process_message_confirm_includes_params(mock_client_class, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.chat_json.return_value = {
        "intent": "execute",
        "task_name": "team_status_today",
        "params": {"date": "2026-06-12"},
    }
    mock_client_class.return_value = mock_client

    result = process_message("run team status for 2026-06-12")

    assert result["type"] == "confirm"
    assert result["task_name"] == "team_status_today"
    assert result["params"] == {"date": "2026-06-12"}


@patch("marvin_core.agent.read_report")
@patch("marvin_core.agent.OpenRouterClient")
def test_process_message_reads_report_without_formatter_llm(mock_client_class, mock_read_report, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.chat_json.side_effect = RuntimeError("network unavailable")
    mock_client_class.return_value = mock_client
    mock_read_report.return_value = "# Uptime Kuma Heartbeat Report\n\nAll clear."

    result = process_message("show latest uptime kuma report")

    assert result["type"] == "response"
    assert "Uptime Kuma Heartbeat Report" in result["message"]


@patch("marvin_core.agent.read_report")
@patch("marvin_core.agent.OpenRouterClient")
def test_process_message_returns_compact_report_digest(mock_client_class, mock_read_report, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.chat_json.side_effect = [
        {"intent": "read_report", "task_name": "beszel_server_status", "params": {}},
        AssertionError("formatter should not be called for report digests"),
    ]
    mock_client_class.return_value = mock_client
    mock_read_report.return_value = """# Beszel Server Status Report

## Summary

All systems are up.

## Recommended Actions

- Watch disk usage.

## Risk Level

low

## Notable Facts

- All 12 systems are up.

## Factual Data

```json
{"large": "payload"}
```
"""

    result = process_message("are all servers healthy?")

    assert result["type"] == "response"
    assert "All systems are up." in result["message"]
    assert "Factual JSON omitted" in result["message"]
    assert '{"large": "payload"}' not in result["message"]
