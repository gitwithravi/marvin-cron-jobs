import pytest
from fastapi import HTTPException

from marvin_core import chat_server
from marvin_core.hermes import HermesClient, HermesClientError, HermesConfigError


class _FakeResponse:
    def __init__(self, payload, status_error=None):
        self.payload = payload
        self.status_error = status_error

    def raise_for_status(self):
        if self.status_error:
            raise self.status_error

    def json(self):
        return self.payload


class _FakeSession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        return self.response


def test_hermes_client_builds_openai_compatible_payload_with_auth():
    session = _FakeSession(
        _FakeResponse({"choices": [{"message": {"content": "Hermes response"}}]})
    )
    client = HermesClient(
        base_url="http://hermes.test/v1/",
        model="hermes-model",
        api_key="secret",
        timeout_seconds=12,
        session=session,
    )

    result = client.chat(
        message="continue",
        history=[{"role": "user", "content": "hello"}, {"role": "assistant", "content": "hi"}],
    )

    assert result == "Hermes response"
    assert session.calls == [
        {
            "url": "http://hermes.test/v1/chat/completions",
            "headers": {
                "Content-Type": "application/json",
                "Authorization": "Bearer secret",
            },
            "json": {
                "model": "hermes-model",
                "messages": [
                    {"role": "user", "content": "hello"},
                    {"role": "assistant", "content": "hi"},
                    {"role": "user", "content": "continue"},
                ],
                "temperature": 0.2,
                "max_tokens": 1600,
            },
            "timeout": 12,
        }
    ]


def test_hermes_client_omits_auth_header_without_api_key():
    session = _FakeSession(_FakeResponse({"choices": [{"message": {"content": "ok"}}]}))
    client = HermesClient(
        base_url="http://hermes.test/v1",
        model="hermes-model",
        session=session,
    )

    assert client.chat(message="hello") == "ok"
    assert session.calls[0]["headers"] == {"Content-Type": "application/json"}


def test_hermes_client_requires_base_url_and_model(monkeypatch):
    monkeypatch.delenv("HERMES_BASE_URL", raising=False)
    monkeypatch.setenv("HERMES_MODEL", "hermes-model")

    with pytest.raises(HermesConfigError, match="HERMES_BASE_URL"):
        HermesClient.from_env()

    monkeypatch.setenv("HERMES_BASE_URL", "http://hermes.test/v1")
    monkeypatch.delenv("HERMES_MODEL", raising=False)

    with pytest.raises(HermesConfigError, match="HERMES_MODEL"):
        HermesClient.from_env()


def test_hermes_client_rejects_malformed_response():
    session = _FakeSession(_FakeResponse({"choices": []}))
    client = HermesClient(
        base_url="http://hermes.test/v1",
        model="hermes-model",
        session=session,
    )

    with pytest.raises(HermesClientError, match="message content"):
        client.chat(message="hello")


def test_hermes_endpoint_returns_response(monkeypatch):
    def fake_chat(message, history):
        assert message == "status"
        assert history == [{"role": "user", "content": "hello"}]
        return "agent online"

    monkeypatch.setattr(chat_server, "chat_with_hermes", fake_chat)

    result = chat_server.hermes_chat_endpoint(
        chat_server.HermesChatRequest(
            message="status",
            history=[chat_server.HermesHistoryMessage(role="user", content="hello")],
        )
    )

    assert result == {"type": "response", "message": "agent online"}


def test_hermes_endpoint_maps_upstream_errors(monkeypatch):
    def fake_chat(_message, _history):
        raise HermesClientError("upstream unavailable")

    monkeypatch.setattr(chat_server, "chat_with_hermes", fake_chat)

    with pytest.raises(HTTPException) as exc_info:
        chat_server.hermes_chat_endpoint(chat_server.HermesChatRequest(message="status"))

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "upstream unavailable"
