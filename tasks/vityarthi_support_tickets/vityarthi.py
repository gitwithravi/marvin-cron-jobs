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

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        response = self.session.post(url, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict) and not data.get("success", True):
            raise RuntimeError(f"API error at {url}: {data.get('message', 'unknown error')}")
        return data.get("data", data) if isinstance(data, dict) else {"raw": data}

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
        return self.fetch_tickets(status="open", per_page=per_page)

    def fetch_tickets(self, *, status: str = "open", per_page: int = 10) -> list[dict[str, Any]]:
        page_data = self._get(
            "/api/v1/system/support/tickets",
            params={"status": status, "per_page": per_page},
        )
        if isinstance(page_data, dict):
            tickets = page_data.get("tickets", page_data.get("data", []))
            return [normalize_ticket(t) for t in tickets]
        return []

    def fetch_review_tickets(
        self,
        *,
        statuses: tuple[str, ...] = ("open", "replied"),
        per_page: int = 25,
        include_details: bool = True,
    ) -> list[dict[str, Any]]:
        tickets: list[dict[str, Any]] = []
        for status in statuses:
            tickets.extend(self.fetch_tickets(status=status, per_page=per_page))

        tickets.sort(key=lambda ticket: ticket.get("updated_at") or ticket.get("created_at") or "", reverse=True)
        if not include_details:
            return tickets[:per_page]

        details: list[dict[str, Any]] = []
        for ticket in tickets[:per_page]:
            detail = self.fetch_ticket_detail(ticket["id"])
            details.append(detail or ticket)
        return details

    def fetch_ticket_detail(self, ticket_id: int) -> dict[str, Any] | None:
        try:
            data = self._get(f"/api/v1/system/support/tickets/{ticket_id}")
            return normalize_ticket_detail(data)
        except requests.HTTPError as exc:
            logger.warning("Failed to fetch ticket detail %s: %s", ticket_id, exc)
            return None

    def post_ticket_reply(self, ticket_id: int, message: str) -> dict[str, Any]:
        return self._post(
            f"/api/v1/system/support/tickets/{ticket_id}/replies",
            {"message": message},
        )

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


def normalize_reply(reply: dict[str, Any], owner_id: Any | None = None) -> dict[str, Any]:
    user = reply.get("user") or {}
    if not isinstance(user, dict):
        user = {}
    user_id = reply.get("user_id") or user.get("id")
    role = user.get("role")
    if not role:
        role = "customer" if owner_id is not None and str(user_id) == str(owner_id) else "staff"
    elif role in {"student", "user"}:
        role = "customer"
    elif role in {"admin", "staff", "support"}:
        role = "staff"

    return {
        "id": reply.get("id"),
        "user_id": user_id,
        "user_name": user.get("name"),
        "role": role,
        "message": reply.get("message"),
        "created_at": reply.get("created_at"),
        "updated_at": reply.get("updated_at"),
        "raw": reply,
    }


def normalize_ticket_detail(detail: dict[str, Any]) -> dict[str, Any]:
    user = _extract_user(detail)
    replies = detail.get("replies") or []
    attachments = detail.get("attachments") or []
    owner_id = user.get("id") or detail.get("user_id")
    normalized_replies = [
        normalize_reply(reply, owner_id=owner_id)
        for reply in replies
        if isinstance(reply, dict)
    ]
    return {
        "id": detail.get("id"),
        "ticket_number": detail.get("ticket_number"),
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
        "replies": normalized_replies,
        "has_staff_reply": any(
            r.get("role") == "staff" for r in normalized_replies
        ),
        "raw": detail,
    }
