import os
from typing import Any

import requests


class HermesConfigError(RuntimeError):
    pass


class HermesClientError(RuntimeError):
    pass


def _env_timeout() -> int:
    raw_value = os.getenv("HERMES_TIMEOUT_SECONDS", "60")
    try:
        return int(raw_value)
    except ValueError as exc:
        raise HermesConfigError("HERMES_TIMEOUT_SECONDS must be an integer") from exc


class HermesClient:
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str | None = None,
        timeout_seconds: int = 60,
        session: requests.Session | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()

    @classmethod
    def from_env(cls) -> "HermesClient":
        base_url = os.getenv("HERMES_BASE_URL", "").strip()
        model = os.getenv("HERMES_MODEL", "").strip()
        api_key = os.getenv("HERMES_API_KEY", "").strip() or None

        if not base_url:
            raise HermesConfigError("HERMES_BASE_URL is not configured")
        if not model:
            raise HermesConfigError("HERMES_MODEL is not configured")

        return cls(
            base_url=base_url,
            model=model,
            api_key=api_key,
            timeout_seconds=_env_timeout(),
        )

    def chat(
        self,
        *,
        message: str,
        history: list[dict[str, str]] | None = None,
        temperature: float = 0.2,
        max_tokens: int = 1600,
    ) -> str:
        messages = list(history or [])
        messages.append({"role": "user", "content": message})

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            response = self.session.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as exc:
            raise HermesClientError(f"Hermes request failed: {exc}") from exc
        except ValueError as exc:
            raise HermesClientError("Hermes returned invalid JSON") from exc

        return _extract_message_content(data)


def _extract_message_content(data: dict[str, Any]) -> str:
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HermesClientError("Hermes response did not include message content") from exc

    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        if parts:
            return "\n".join(parts)

    raise HermesClientError("Hermes message content was not text")


def chat_with_hermes(message: str, history: list[dict[str, str]] | None = None) -> str:
    return HermesClient.from_env().chat(message=message, history=history)
