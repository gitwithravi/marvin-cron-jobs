import json
import sqlite3
from unittest.mock import patch, MagicMock
import pytest
from fastapi import HTTPException

from marvin_core.marvin_api import get_runs_endpoint, get_run_endpoint, generate_run_summary_endpoint
from marvin_core.db import connect, migrate, create_task_run, insert_task_run_payload, insert_marvin_summary

@pytest.fixture
def test_db(tmp_path, monkeypatch):
    db_path = tmp_path / "marvin.sqlite3"
    
    def fake_connect(path):
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    monkeypatch.setattr("marvin_core.marvin_api.connect", fake_connect)
    
    conn = fake_connect(db_path)
    migrate(conn)
    conn.close()
    return db_path

def test_api_list_runs(test_db):
    conn = connect(test_db)
    run_id1 = create_task_run(conn, "uptime_kuma_heartbeat", "2026-06-15T12:00:00")
    insert_task_run_payload(conn, run_id1, "uptime_kuma_heartbeat", "2026-06-15T12:00:00", "low", {"monitors": []}, {"summary": "all ok"})
    
    run_id2 = create_task_run(conn, "beszel_server_status", "2026-06-15T12:05:00")
    insert_task_run_payload(conn, run_id2, "beszel_server_status", "2026-06-15T12:05:00", "medium", {"systems": []}, {"summary": "warning"})
    conn.close()
    
    # List all runs
    data = get_runs_endpoint()
    assert len(data) == 2
    assert data[0]["task_name"] == "beszel_server_status"
    assert data[1]["task_name"] == "uptime_kuma_heartbeat"
    
    # Filter by task
    data = get_runs_endpoint(task_name="uptime_kuma_heartbeat")
    assert len(data) == 1
    assert data[0]["task_name"] == "uptime_kuma_heartbeat"

def test_api_run_detail(test_db):
    conn = connect(test_db)
    run_id = create_task_run(conn, "uptime_kuma_heartbeat", "2026-06-15T12:00:00")
    insert_task_run_payload(conn, run_id, "uptime_kuma_heartbeat", "2026-06-15T12:00:00", "low", {"monitors": [1]}, {"summary": "all ok"})
    conn.close()
    
    data = get_run_endpoint(run_id)
    assert data["id"] == run_id
    assert data["task_name"] == "uptime_kuma_heartbeat"
    assert data["factual_payload"] == {"monitors": [1]}
    assert data["deterministic_analysis"] == {"summary": "all ok"}
    assert data["summary"] is None

def test_api_generate_and_cache_summary(test_db, monkeypatch):
    conn = connect(test_db)
    run_id = create_task_run(conn, "uptime_kuma_heartbeat", "2026-06-15T12:00:00")
    insert_task_run_payload(conn, run_id, "uptime_kuma_heartbeat", "2026-06-15T12:00:00", "low", {"monitors": [1]}, {"summary": "all ok"})
    conn.close()
    
    # Mock OpenRouter Client response
    mock_or_client = MagicMock()
    mock_or_client.chat_json.return_value = {
        "summary": "LLM generated summary",
        "recommended_actions": ["Relax"],
        "notable_facts": ["Facts"],
        "risk_level": "low"
    }
    
    monkeypatch.setenv("OPENROUTER_API_KEY", "fake-key")
    
    # Patch OpenRouterClient
    with patch("marvin_core.marvin_api.OpenRouterClient", return_value=mock_or_client):
        # First request generates the summary via LLM
        data1 = generate_run_summary_endpoint(run_id)
        assert data1["summary"] == "LLM generated summary"
        assert mock_or_client.chat_json.call_count == 1
        
        # Second request should return cached result and not call OpenRouter Client
        data2 = generate_run_summary_endpoint(run_id)
        assert data2["summary"] == "LLM generated summary"
        assert mock_or_client.chat_json.call_count == 1  # count stays 1
