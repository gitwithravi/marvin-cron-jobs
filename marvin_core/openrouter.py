from typing import Any

import requests


OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterClient:
    def __init__(self, api_key: str, timeout_seconds: int = 60) -> None:
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def chat_json(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> dict[str, Any]:
        response = requests.post(
            OPENROUTER_CHAT_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "X-OpenRouter-Title": "MARVIN Agent",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        if isinstance(content, dict):
            return content

        import json

        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("OpenRouter response content was not a JSON object")
        return parsed

