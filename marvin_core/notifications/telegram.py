from dataclasses import dataclass
from typing import Any

import requests

from marvin_core.env import require_env


TELEGRAM_SEND_MESSAGE_URL = "https://api.telegram.org/bot{token}/sendMessage"


class TelegramNotificationError(RuntimeError):
    """Raised when Telegram notification delivery fails without leaking credentials."""


@dataclass(frozen=True)
class TelegramResult:
    channel: str
    delivered: bool
    detail: str


def validate_bot_token(token: str) -> None:
    if ":" not in token or token.startswith("@") or token.endswith("_bot"):
        raise TelegramNotificationError(
            "Invalid TELEGRAM_BOT_TOKEN. Use the BotFather token, not the bot username. "
            "Expected format looks like '123456789:AA...'."
        )


def _telegram_error_detail(response: requests.Response) -> str:
    try:
        payload: Any = response.json()
    except ValueError:
        return response.text[:200]
    if isinstance(payload, dict):
        return str(payload.get("description") or payload)
    return str(payload)


def send_telegram_message(message: str, *, timeout_seconds: int = 30) -> TelegramResult:
    token = require_env("TELEGRAM_BOT_TOKEN")
    chat_id = require_env("TELEGRAM_CHAT_ID")
    validate_bot_token(token)
    try:
        response = requests.post(
            TELEGRAM_SEND_MESSAGE_URL.format(token=token),
            json={
                "chat_id": chat_id,
                "text": message,
                "disable_web_page_preview": True,
            },
            timeout=timeout_seconds,
        )
        response.raise_for_status()
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        detail = _telegram_error_detail(exc.response) if exc.response is not None else str(exc)
        raise TelegramNotificationError(
            f"Telegram send failed with HTTP {status}: {detail}"
        ) from exc
    except requests.RequestException as exc:
        raise TelegramNotificationError(f"Telegram send failed: {exc}") from exc
    return TelegramResult(channel="telegram", delivered=True, detail="sent")
