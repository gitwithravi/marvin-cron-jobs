import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)


class VityarthiSupportClient:
    def __init__(self, base_url: str, api_token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_token}",
            "Accept": "application/json",
        })

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        response = self.session.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        if not data.get("success", False):
            raise RuntimeError(f"API error at {url}: {data.get('message', 'unknown error')}")
        return data.get("data", data)

    def fetch_ticket_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for status in ("open", "replied", "closed"):
            page_data = self._get(
                "/api/v1/system/support/tickets",
                params={"status": status, "per_page": 1},
            )
            if isinstance(page_data, dict):
                meta = page_data.get("meta", {})
                counts[status] = meta.get("total", 0) if isinstance(meta, dict) else 0
            else:
                counts[status] = 0
        counts["total"] = sum(counts.values())
        return counts

    def fetch_open_tickets(self, per_page: int = 10) -> list[dict[str, Any]]:
        page_data = self._get(
            "/api/v1/system/support/tickets",
            params={"status": "open", "per_page": per_page},
        )
        if isinstance(page_data, dict):
            tickets = page_data.get("tickets", page_data.get("data", []))
            return [normalize_ticket(t) for t in tickets]
        return []

    def fetch_ticket_detail(self, ticket_id: int) -> dict[str, Any] | None:
        try:
            data = self._get(f"/api/v1/system/support/tickets/{ticket_id}")
            return normalize_ticket_detail(data)
        except requests.HTTPError as exc:
            logger.warning("Failed to fetch ticket detail %s: %s", ticket_id, exc)
            return None

    def close(self) -> None:
        self.session.close()


def _extract_user(ticket: dict[str, Any]) -> dict[str, Any]:
    user = ticket.get("user") or ticket.get("owner") or {}
    return user if isinstance(user, dict) else {}


def normalize_ticket(ticket: dict[str, Any]) -> dict[str, Any]:
    user = _extract_user(ticket)
    return {
        "id": ticket.get("id"),
        "subject": ticket.get("subject"),
        "status": ticket.get("status"),
        "priority": ticket.get("priority"),
        "category": ticket.get("category"),
        "created_at": ticket.get("created_at"),
        "updated_at": ticket.get("updated_at"),
        "owner_id": user.get("id"),
        "owner_name": user.get("name"),
        "owner_email": user.get("email"),
        "raw": ticket,
    }


def normalize_ticket_detail(detail: dict[str, Any]) -> dict[str, Any]:
    user = _extract_user(detail)
    replies = detail.get("replies") or []
    attachments = detail.get("attachments") or []
    return {
        "id": detail.get("id"),
        "subject": detail.get("subject"),
        "status": detail.get("status"),
        "priority": detail.get("priority"),
        "category": detail.get("category"),
        "message": detail.get("message"),
        "created_at": detail.get("created_at"),
        "updated_at": detail.get("updated_at"),
        "owner_id": user.get("id"),
        "owner_name": user.get("name"),
        "owner_email": user.get("email"),
        "reply_count": len(replies),
        "attachment_count": len(attachments),
        "has_staff_reply": any(
            r.get("user", {}).get("role") == "admin" for r in replies if isinstance(r, dict)
        ),
        "raw": detail,
    }