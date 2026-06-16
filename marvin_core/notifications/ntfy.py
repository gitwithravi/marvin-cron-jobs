import base64
import os
from dataclasses import dataclass

import requests

from marvin_core.env import require_env


class NtfyNotificationError(RuntimeError):
    pass


@dataclass(frozen=True)
class NtfyResult:
    channel: str
    delivered: bool
    detail: str


def _auth_header(username: str | None, password: str | None, token: str | None) -> str | None:
    if token:
        return f"Bearer {token}"
    if username and password:
        encoded = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
        return f"Basic {encoded}"
    return None


def send_ntfy_message(
    message: str,
    *,
    title: str = "MARVIN Email Capture",
    priority: int = 3,
    tags: list[str] | None = None,
    timeout_seconds: int = 30,
) -> NtfyResult:
    base_url = require_env("NTFY_BASE_URL").rstrip("/")
    topic = require_env("NTFY_TOPIC").strip("/")
    headers = {
        "Title": title,
        "Priority": str(priority),
        "Tags": ",".join(tags or ["email", "inbox"]),
    }
    try:
        auth = _auth_header(
            os.getenv("NTFY_USERNAME") or None,
            os.getenv("NTFY_PASSWORD") or None,
            os.getenv("NTFY_ACCESS_TOKEN") or None,
        )
        if auth:
            headers["Authorization"] = auth
        response = requests.post(
            f"{base_url}/{topic}",
            data=message.encode("utf-8"),
            headers=headers,
            timeout=timeout_seconds,
        )
        response.raise_for_status()
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        detail = exc.response.text[:200] if exc.response is not None else str(exc)
        raise NtfyNotificationError(f"ntfy send failed with HTTP {status}: {detail}") from exc
    except requests.RequestException as exc:
        raise NtfyNotificationError(f"ntfy send failed: {exc}") from exc
    return NtfyResult(channel="ntfy", delivered=True, detail="sent")
