import json
import sqlite3
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
import requests

from marvin_core.db import (
    connect,
    create_task_run,
    insert_team_status_member_snapshots,
    insert_team_status_task_observations,
    migrate,
)
from tasks.team_status_today import run as task_run
from tasks.team_status_today.analysis import (
    build_factual_payload,
    build_messages,
    compute_risk_level,
    dry_run_analysis,
    group_tasks_by_member,
)
from tasks.team_status_today.client import (
    TeamStatusAPIError,
    TeamStatusAuthError,
    TeamStatusClient,
    TeamStatusServerKeyError,
    _validate_date,
    normalize_member,
    normalize_task,
    today_utc,
)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


def test_today_utc_returns_iso_date_string():
    value = today_utc()
    assert len(value) == 10
    assert value[4] == "-" and value[7] == "-"


def test_validate_date_rejects_bad_format():
    with pytest.raises(ValueError):
        _validate_date("2026/06/13")
    with pytest.raises(ValueError):
        _validate_date("not-a-date")


def test_normalize_member_falls_back_to_id_name():
    result = normalize_member({"id": 9})
    assert result["id"] == 9
    assert result["name"] == "member-9"
    assert result["raw"] == {"id": 9}


def test_normalize_task_fills_member_and_date_defaults():
    task = normalize_task(
        {"id": 1, "title": "demo", "status": "done", "project_name": "x", "notes": "ok"},
        member_id=3,
        work_date="2026-06-13",
    )
    assert task["member_id"] == 3
    assert task["work_date"] == "2026-06-13"
    assert task["status"] == "done"


def test_normalize_task_keeps_record_date_when_present():
    task = normalize_task(
        {"id": 1, "work_date": "2026-06-12", "status": "blocked"},
        member_id=2,
        work_date="2026-06-13",
    )
    assert task["work_date"] == "2026-06-12"


def _make_client(responses: list[dict[str, Any]]) -> tuple[TeamStatusClient, _MockAdapter]:
    session = requests.Session()
    adapter = _MockAdapter(responses)
    client = TeamStatusClient("https://example.test/api", "test-key", session=session)
    session.mount(
        "https://example.test",
        adapter,
    )
    return client, adapter


class _MockAdapter(requests.adapters.HTTPAdapter):
    def __init__(self, responses: list[dict[str, Any]]) -> None:
        super().__init__()
        self._responses = list(responses)
        self.calls: list[dict[str, Any]] = []

    def send(self, request, **kwargs):  # type: ignore[override]
        url = request.url or ""
        method = request.method
        self.calls.append({"url": url, "method": method, "headers": dict(request.headers)})
        if not self._responses:
            raise AssertionError(f"No mocked response for {method} {url}")
        entry = self._responses.pop(0)
        response = requests.Response()
        response.status_code = entry["status"]
        response._content = json.dumps(entry.get("body", {})).encode("utf-8")
        response.url = url
        response.request = request
        return response


def test_fetch_team_members_sends_api_key_header():
    client, adapter = _make_client([{"status": 200, "body": {"members": [{"id": 1, "name": "Ada"}]}}])
    members = client.fetch_team_members()
    assert members == [{"id": 1, "name": "Ada", "raw": {"id": 1, "name": "Ada"}}]
    assert adapter.calls[0]["method"] == "GET"
    sent_headers = {k.lower(): v for k, v in adapter.calls[0]["headers"].items()}
    assert sent_headers.get("x-api-key") == "test-key"


def test_fetch_tasks_passes_member_id_and_date_query():
    client, adapter = _make_client(
        [{"status": 200, "body": {"tasks": [{"id": 5, "title": "t", "status": "done"}]}}]
    )
    tasks = client.fetch_tasks(7, "2026-06-13")
    assert tasks[0]["member_id"] == 7
    assert tasks[0]["work_date"] == "2026-06-13"
    called = adapter.calls[0]["url"]
    assert "member_id=7" in called
    assert "date=2026-06-13" in called


def test_fetch_members_404_returns_empty():
    client, _ = _make_client([{"status": 404, "body": {}}])
    assert client.fetch_team_members() == []


def test_fetch_members_422_returns_empty():
    client, _ = _make_client([{"status": 422, "body": {}}])
    assert client.fetch_team_members() == []


def test_fetch_tasks_404_returns_empty():
    client, _ = _make_client([{"status": 404, "body": {}}])
    assert client.fetch_tasks(1, "2026-06-13") == []


def test_fetch_members_401_raises_auth_error():
    client, _ = _make_client([{"status": 401, "body": {"error": "bad key"}}])
    with pytest.raises(TeamStatusAuthError):
        client.fetch_team_members()


def test_fetch_tasks_401_raises_auth_error():
    client, _ = _make_client([{"status": 401, "body": {"error": "bad key"}}])
    with pytest.raises(TeamStatusAuthError):
        client.fetch_tasks(1, "2026-06-13")


def test_fetch_members_503_raises_server_key_error():
    client, _ = _make_client([{"status": 503, "body": {"error": "server key missing"}}])
    with pytest.raises(TeamStatusServerKeyError):
        client.fetch_team_members()


def test_fetch_tasks_503_raises_server_key_error():
    client, _ = _make_client([{"status": 503, "body": {"error": "server key missing"}}])
    with pytest.raises(TeamStatusServerKeyError):
        client.fetch_tasks(1, "2026-06-13")


def test_fetch_members_500_raises_generic_api_error():
    client, _ = _make_client([{"status": 500, "body": {"error": "boom"}}])
    with pytest.raises(TeamStatusAPIError):
        client.fetch_team_members()


def test_fetch_members_invalid_json_raises_api_error():
    session = requests.Session()
    client = TeamStatusClient("https://example.test/api", "test-key", session=session)
    session.mount(
        "https://example.test",
        _RawAdapter(b"not-json", 200),
    )
    with pytest.raises(TeamStatusAPIError):
        client.fetch_team_members()


def test_fetch_tasks_requires_date_in_iso_format():
    client, _ = _make_client([])
    with pytest.raises(ValueError):
        client.fetch_tasks(1, "06-13-2026")


# ---------------------------------------------------------------------------
# Retry / network behavior
# ---------------------------------------------------------------------------


class _FlakyAdapter(requests.adapters.HTTPAdapter):
    def __init__(self, behavior: list[Any]) -> None:
        super().__init__(max_retries=0)
        self._behavior = list(behavior)
        self.calls = 0

    def send(self, request, **kwargs):  # type: ignore[override]
        self.calls += 1
        outcome = self._behavior.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        if outcome == "timeout":
            raise requests.exceptions.ReadTimeout("simulated read timeout")
        if outcome == "connect":
            raise requests.exceptions.ConnectionError("simulated connection error")
        response = requests.Response()
        response.status_code = outcome["status"]
        response._content = json.dumps(outcome.get("body", {})).encode("utf-8")
        response.url = request.url
        response.request = request
        return response


def _flaky_client(
    behavior: list[Any],
    *,
    max_retries: int = 3,
    backoff_factor: float = 0.0,
    sleep_recorder: list[float] | None = None,
) -> TeamStatusClient:
    session = requests.Session()
    adapter = _FlakyAdapter(behavior)
    session.mount("https://example.test", adapter)
    session.mount("http://example.test", adapter)
    sleep_fn = (lambda seconds: sleep_recorder.append(seconds)) if sleep_recorder is not None else (lambda _s: None)
    return TeamStatusClient(
        "https://example.test/api",
        "test-key",
        timeout_seconds=1,
        max_retries=max_retries,
        backoff_factor=backoff_factor,
        sleep=sleep_fn,
        session=session,
    )


def test_client_recovers_from_single_read_timeout():
    client = _flaky_client(["timeout", {"status": 200, "body": {"members": [{"id": 1, "name": "Ada"}]}}])
    members = client.fetch_team_members()
    assert members[0]["name"] == "Ada"


def test_client_recovers_from_single_connection_error():
    client = _flaky_client(["connect", {"status": 200, "body": {"members": [{"id": 1, "name": "Ada"}]}}])
    members = client.fetch_team_members()
    assert members[0]["name"] == "Ada"


def test_client_surfaces_api_error_after_persistent_timeouts():
    client = _flaky_client(
        ["timeout", "timeout", "timeout", "timeout"],
        max_retries=3,
    )
    with pytest.raises(TeamStatusAPIError, match=r"after 4 attempts"):
        client.fetch_team_members()


def test_client_does_not_retry_on_unexpected_request_exception():
    client = _flaky_client(
        [
            requests.exceptions.RequestException("weird"),
            {"status": 200, "body": {"members": [{"id": 1, "name": "Ada"}]}},
        ],
    )
    with pytest.raises(TeamStatusAPIError, match="Network error"):
        client.fetch_team_members()


def test_retry_backoff_grows_exponentially():
    sleeps: list[float] = []
    client = _flaky_client(
        ["timeout", "timeout", {"status": 200, "body": {"members": [{"id": 1, "name": "Ada"}]}}],
        max_retries=3,
        backoff_factor=0.5,
        sleep_recorder=sleeps,
    )
    client.fetch_team_members()
    assert sleeps == [0.5, 1.0]


def test_retry_skips_sleep_on_first_success():
    sleeps: list[float] = []
    client = _flaky_client(
        [{"status": 200, "body": {"members": [{"id": 1, "name": "Ada"}]}}],
        sleep_recorder=sleeps,
    )
    client.fetch_team_members()
    assert sleeps == []


def test_401_is_not_retried():
    client, adapter = _make_client([{"status": 401, "body": {"error": "bad key"}}])
    with pytest.raises(TeamStatusAuthError):
        client.fetch_team_members()
    assert len(adapter.calls) == 1


def test_503_is_not_retried():
    client, adapter = _make_client([{"status": 503, "body": {"error": "server key missing"}}])
    with pytest.raises(TeamStatusServerKeyError):
        client.fetch_team_members()
    assert len(adapter.calls) == 1


def test_404_is_not_retried():
    client, adapter = _make_client([{"status": 404, "body": {}}])
    assert client.fetch_team_members() == []
    assert len(adapter.calls) == 1


class _RawAdapter(requests.adapters.HTTPAdapter):
    def __init__(self, body: bytes, status: int) -> None:
        super().__init__()
        self._body = body
        self._status = status

    def send(self, request, **kwargs):  # type: ignore[override]
        response = requests.Response()
        response.status_code = self._status
        response._content = self._body
        response.url = request.url
        response.request = request
        return response


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------


def test_build_factual_payload_groups_tasks_and_counts_statuses():
    members = [
        {"id": 1, "name": "Ada"},
        {"id": 2, "name": "Babbage"},
    ]
    tasks_by_member = {
        1: [
            {"id": 10, "title": "design", "status": "done", "project_name": "p1", "notes": None},
            {"id": 11, "title": "blocked item", "status": "blocked", "project_name": "p1", "notes": "stuck"},
            {"id": 12, "title": "wip", "status": "in_progress", "project_name": "p2", "notes": None},
        ],
        2: [],
    }
    payload = build_factual_payload(
        task_name="team_status_today",
        observed_at="2026-06-13T00:00:00+00:00",
        date="2026-06-13",
        members=members,
        tasks_by_member=tasks_by_member,
    )
    assert payload["member_count"] == 2
    assert payload["task_count"] == 3
    assert payload["status_counts"]["done"] == 1
    assert payload["status_counts"]["blocked"] == 1
    assert payload["status_counts"]["in_progress"] == 1
    assert payload["status_counts"]["planned"] == 0
    assert payload["blocked_task_count"] == 1
    assert payload["blocked_tasks"][0]["member_name"] == "Ada"
    assert payload["members_with_no_tasks"] == [{"id": 2, "name": "Babbage"}]


def test_build_factual_payload_handles_empty_team():
    payload = build_factual_payload(
        task_name="team_status_today",
        observed_at="2026-06-13T00:00:00+00:00",
        date="2026-06-13",
        members=[],
        tasks_by_member={},
    )
    assert payload["member_count"] == 0
    assert payload["task_count"] == 0
    assert payload["blocked_task_count"] == 0
    assert payload["status_counts"] == {"done": 0, "in_progress": 0, "blocked": 0, "planned": 0}


def test_compute_risk_high_when_any_blocked():
    payload = {"status_counts": {"blocked": 1, "done": 5, "in_progress": 0, "planned": 0}, "member_count": 3, "members_with_no_tasks": []}
    assert compute_risk_level(payload) == "high"


def test_compute_risk_critical_when_many_blocked():
    payload = {"status_counts": {"blocked": 3, "done": 1, "in_progress": 0, "planned": 0}, "member_count": 4, "members_with_no_tasks": []}
    assert compute_risk_level(payload) == "critical"


def test_compute_risk_medium_when_in_progress_no_done():
    payload = {"status_counts": {"blocked": 0, "done": 0, "in_progress": 4, "planned": 0}, "member_count": 4, "members_with_no_tasks": []}
    assert compute_risk_level(payload) == "medium"


def test_compute_risk_low_when_done_present():
    payload = {"status_counts": {"blocked": 0, "done": 2, "in_progress": 1, "planned": 1}, "member_count": 3, "members_with_no_tasks": []}
    assert compute_risk_level(payload) == "low"


def test_compute_risk_low_when_no_data():
    assert (
        compute_risk_level(
            {"status_counts": {"done": 0, "in_progress": 0, "blocked": 0, "planned": 0}, "member_count": 0, "members_with_no_tasks": []}
        )
        == "low"
    )


def test_dry_run_analysis_blocked_includes_aside():
    payload = {
        "date": "2026-06-13",
        "status_counts": {"blocked": 1, "done": 2, "in_progress": 0, "planned": 0},
        "member_count": 5,
        "task_count": 3,
        "members_with_no_tasks": [],
        "blocked_tasks": [{"title": "x"}],
    }
    analysis = dry_run_analysis(payload)
    assert analysis["risk_level"] == "high"
    assert "blocked" in analysis["summary"].lower()
    assert any("x" in action for action in analysis["recommended_actions"])


def test_dry_run_analysis_clean_is_low():
    payload = {
        "date": "2026-06-13",
        "status_counts": {"done": 2, "in_progress": 0, "blocked": 0, "planned": 1},
        "member_count": 2,
        "task_count": 3,
        "members_with_no_tasks": [],
    }
    analysis = dry_run_analysis(payload)
    assert analysis["risk_level"] == "low"
    assert analysis["recommended_actions"][0].startswith("No immediate action")


def test_dry_run_analysis_handles_no_tasks_at_all():
    payload = {
        "date": "2026-06-13",
        "status_counts": {"done": 0, "in_progress": 0, "blocked": 0, "planned": 0},
        "member_count": 3,
        "task_count": 0,
        "members_with_no_tasks": [{"id": 1, "name": "Ada"}, {"id": 2, "name": "Babbage"}],
    }
    analysis = dry_run_analysis(payload)
    assert "No tasks" in analysis["summary"] or "Quiet" in analysis["summary"]
    assert analysis["risk_level"] == "low"
    assert any("Ada" in a and "Babbage" in a for a in analysis["recommended_actions"])


def test_build_messages_includes_communication_style_and_payload(tmp_path: Path):
    prompts = tmp_path / "prompts"
    prompts.mkdir()
    (prompts / "system.md").write_text("system", encoding="utf-8")
    (prompts / "user.md").write_text(
        "Style={communication_style}\nPayload={payload}",
        encoding="utf-8",
    )
    messages = build_messages(
        prompts_dir=prompts,
        communication_style="be factual but sardonic",
        factual_payload={"member_count": 1},
    )
    assert messages[0] == {"role": "system", "content": "system"}
    assert "be factual but sardonic" in messages[1]["content"]
    assert json.dumps({"member_count": 1}, indent=2, sort_keys=True) in messages[1]["content"]


def test_group_tasks_by_member_collects_per_member_lists():
    tasks = [
        {"id": 1, "member_id": 1},
        {"id": 2, "member_id": 2},
        {"id": 3, "member_id": 1},
        {"id": 4, "member_id": None},
    ]
    grouped = group_tasks_by_member(tasks)
    assert grouped[1] == [{"id": 1, "member_id": 1}, {"id": 3, "member_id": 1}]
    assert grouped[2] == [{"id": 2, "member_id": 2}]
    assert 4 not in {1, 2}


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------


def test_team_status_db_inserts(tmp_path: Path):
    conn = connect(tmp_path / "marvin.sqlite3")
    migrate(conn)
    run_id = create_task_run(conn, "team_status_today", "2026-06-13T00:00:00+00:00")

    insert_team_status_member_snapshots(
        conn,
        run_id,
        "2026-06-13T00:00:00+00:00",
        [
            {"id": 1, "name": "Ada", "raw": {"id": 1, "name": "Ada"}},
            {"id": 2, "name": "Babbage", "raw": {"id": 2, "name": "Babbage"}},
        ],
    )
    insert_team_status_task_observations(
        conn,
        run_id,
        "2026-06-13T00:00:00+00:00",
        [
            {
                "id": 10,
                "member_id": 1,
                "title": "design",
                "status": "done",
                "work_date": "2026-06-13",
                "project_name": "p1",
                "notes": "shipped",
                "raw": {"id": 10},
            },
            {
                "id": 11,
                "member_id": 2,
                "title": "blocked item",
                "status": "blocked",
                "work_date": "2026-06-13",
                "project_name": "p2",
                "notes": "awaiting upstream",
                "raw": {"id": 11},
            },
        ],
    )

    counts = {
        table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in [
            "team_status_member_snapshots",
            "team_status_task_observations",
        ]
    }
    assert counts == {
        "team_status_member_snapshots": 2,
        "team_status_task_observations": 2,
    }
    conn.close()


def test_team_status_task_insert_dedupes_per_run(tmp_path: Path):
    conn = connect(tmp_path / "marvin.sqlite3")
    migrate(conn)
    run_id = create_task_run(conn, "team_status_today", "2026-06-13T00:00:00+00:00")
    task = {
        "id": 10,
        "member_id": 1,
        "title": "t",
        "status": "done",
        "work_date": "2026-06-13",
        "project_name": "p",
        "notes": None,
        "raw": {"id": 10},
    }
    insert_team_status_task_observations(conn, run_id, "2026-06-13T00:00:00+00:00", [task])
    insert_team_status_task_observations(conn, run_id, "2026-06-13T00:00:00+00:00", [task])
    count = conn.execute("SELECT COUNT(*) FROM team_status_task_observations").fetchone()[0]
    assert count == 1
    conn.close()


# ---------------------------------------------------------------------------
# Env / placeholder validation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "value",
    [
        "",
        "your-api-key-here",
        "YOUR-API-KEY-HERE",
        "changeme",
        "change-me",
        "replace-me",
        "placeholder",
        "https://example.com/api",
        "None",
    ],
)
def test_is_placeholder_detects_known_patterns(value: str):
    assert task_run._is_placeholder(value)


@pytest.mark.parametrize(
    "value",
    [
        "sk-live-abc123",
        "https://tasks.vityarthi.com/api",
        "abc.def.ghi",
    ],
)
def test_is_placeholder_allows_real_values(value: str):
    assert not task_run._is_placeholder(value)


def test_require_real_env_rejects_missing(monkeypatch):
    monkeypatch.delenv("TEAM_STATUS_API_URL", raising=False)
    with pytest.raises(RuntimeError, match="Missing required environment variable"):
        task_run._require_real_env("TEAM_STATUS_API_URL")


def test_require_real_env_rejects_placeholder(monkeypatch):
    monkeypatch.setenv("TEAM_STATUS_API_KEY", "your-api-key-here")
    with pytest.raises(RuntimeError, match="placeholder"):
        task_run._require_real_env("TEAM_STATUS_API_KEY")


def test_require_real_env_accepts_real_value(monkeypatch):
    monkeypatch.setenv("TEAM_STATUS_API_KEY", "sk-live-abc")
    assert task_run._require_real_env("TEAM_STATUS_API_KEY") == "sk-live-abc"


def test_validate_config_rejects_null_retry_setting():
    with pytest.raises(RuntimeError, match="request_max_retries"):
        task_run.validate_config(
            {
                "task_name": "team_status_today",
                "model": "deepseek/deepseek-v4-flash",
                "database_path": "data/marvin.sqlite3",
                "report_dir": "reports/team_status_today",
                "request_max_retries": None,
            }
        )


def test_validate_config_accepts_realistic_retry_settings():
    task_run.validate_config(
        {
            "task_name": "team_status_today",
            "model": "deepseek/deepseek-v4-flash",
            "database_path": "data/marvin.sqlite3",
            "report_dir": "reports/team_status_today",
            "request_timeout_seconds": 30,
            "request_max_retries": 3,
            "request_backoff_factor": 0.5,
        }
    )


# ---------------------------------------------------------------------------
# Run orchestration (integration with mocked client and OpenRouter)
# ---------------------------------------------------------------------------


def _write_minimal_config(task_dir: Path, model: str) -> None:
    cfg = task_dir / "config.yaml"
    cfg.write_text(
        f"""task_name: team_status_today
model: "{model}"
database_path: "data/marvin.sqlite3"
report_dir: "reports/team_status_today"
openrouter:
  temperature: 0.2
  max_tokens: 1200
notifications:
  enabled: false
  risk_threshold: medium
  channels:
    - telegram
  include_report_path: true
""",
        encoding="utf-8",
    )


def test_run_task_dry_run_writes_report(tmp_path: Path, monkeypatch):
    task_dir = tmp_path / "task"
    task_dir.mkdir()
    (task_dir / "prompts").mkdir()
    (task_dir / "prompts" / "system.md").write_text("system", encoding="utf-8")
    (task_dir / "prompts" / "user.md").write_text(
        "Style={communication_style}\nPayload={payload}",
        encoding="utf-8",
    )
    _write_minimal_config(task_dir, "REPLACE_WITH_OPENROUTER_MODEL_SLUG")

    db_path = tmp_path / "marvin.sqlite3"
    report_dir = tmp_path / "reports"
    monkeypatch.setenv("TEAM_STATUS_API_URL", "https://example.test/api")
    monkeypatch.setenv("TEAM_STATUS_API_KEY", "sk-live-xyz")

    members = [{"id": 1, "name": "Ada", "raw": {"id": 1, "name": "Ada"}}]
    tasks = [
        {
            "id": 10,
            "member_id": 1,
            "title": "design",
            "status": "done",
            "project_name": "p1",
            "notes": None,
            "work_date": "2026-06-13",
            "raw": {"id": 10, "status": "done"},
        }
    ]

    def fake_fetch_members(self):
        return [normalize_member(m) for m in members]

    def fake_fetch_tasks(self, member_id, date):
        return [normalize_task(t, member_id=member_id, work_date=date) for t in tasks]

    def fake_load_yaml(path):
        import yaml

        return yaml.safe_load((task_dir / "config.yaml").read_text(encoding="utf-8"))

    def fake_connect(database_path):
        return connect(db_path)

    monkeypatch.setattr(task_run, "load_yaml", fake_load_yaml)
    monkeypatch.setattr(task_run.TeamStatusClient, "fetch_team_members", fake_fetch_members)
    monkeypatch.setattr(task_run.TeamStatusClient, "fetch_tasks", fake_fetch_tasks)
    monkeypatch.setattr(task_run, "connect", fake_connect)
    monkeypatch.setattr(task_run, "TASK_DIR", task_dir)
    monkeypatch.setattr(task_run, "ROOT_DIR", tmp_path)

    def override_project_path(path):
        candidate = Path(path)
        if candidate.is_absolute():
            return candidate
        return tmp_path / candidate

    monkeypatch.setattr(task_run, "project_path", override_project_path)
    cfg = fake_load_yaml(task_dir / "config.yaml")
    cfg["database_path"] = str(db_path)
    cfg["report_dir"] = str(report_dir)
    (task_dir / "config.yaml").write_text(
        f"task_name: {cfg['task_name']}\nmodel: \"{cfg['model']}\"\n"
        f"database_path: \"{db_path}\"\n"
        f"report_dir: \"{report_dir}\"\n"
        "openrouter:\n  temperature: 0.2\n  max_tokens: 1200\n"
        "notifications:\n  enabled: false\n  risk_threshold: medium\n"
        "  channels:\n    - telegram\n  include_report_path: true\n",
        encoding="utf-8",
    )

    report_path = task_run.run_task(dry_run=True, date="2026-06-13")
    assert report_path.exists()
    contents = report_path.read_text(encoding="utf-8")
    assert "Team Status Today" in contents
    assert "low" in contents

    conn = sqlite3.connect(db_path)
    counts = {
        table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in [
            "task_runs",
            "team_status_member_snapshots",
            "team_status_task_observations",
            "reports",
        ]
    }
    assert counts == {
        "task_runs": 1,
        "team_status_member_snapshots": 1,
        "team_status_task_observations": 1,
        "reports": 1,
    }
    conn.close()


def test_run_task_refuses_to_run_with_placeholder_env(tmp_path: Path, monkeypatch):
    task_dir = tmp_path / "task"
    task_dir.mkdir()
    (task_dir / "prompts").mkdir()
    (task_dir / "prompts" / "system.md").write_text("s", encoding="utf-8")
    (task_dir / "prompts" / "user.md").write_text("p", encoding="utf-8")
    _write_minimal_config(task_dir, "REPLACE_WITH_OPENROUTER_MODEL_SLUG")
    monkeypatch.setenv("TEAM_STATUS_API_URL", "https://example.test/api")
    monkeypatch.setenv("TEAM_STATUS_API_KEY", "your-api-key-here")
    monkeypatch.setattr(task_run, "TASK_DIR", task_dir)

    def fake_load_yaml(path):
        import yaml

        return yaml.safe_load((task_dir / "config.yaml").read_text(encoding="utf-8"))

    monkeypatch.setattr(task_run, "load_yaml", fake_load_yaml)
    monkeypatch.setattr(task_run, "connect", lambda _p: connect(tmp_path / "marvin.sqlite3"))

    with pytest.raises(RuntimeError, match="placeholder"):
        task_run.run_task(dry_run=True, date="2026-06-13")
