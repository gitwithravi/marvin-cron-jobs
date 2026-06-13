import logging
import time
from datetime import datetime, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)


TEAM_MEMBERS_PATH = "/team-members"
TASKS_PATH = "/tasks"


VALID_TASK_STATUSES = {"done", "in_progress", "blocked", "planned"}


DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_MAX_RETRIES = 3
DEFAULT_BACKOFF_FACTOR = 0.5


RETRYABLE_EXCEPTIONS = (
    requests.exceptions.Timeout,
    requests.exceptions.ConnectionError,
)


class TeamStatusAPIError(RuntimeError):
    """Raised when the team status API call fails for a fatal reason."""


class TeamStatusAuthError(TeamStatusAPIError):
    """Raised when the API key is rejected (401)."""


class TeamStatusServerKeyError(TeamStatusAPIError):
    """Raised when the server reports its own key is not configured (503)."""


class TeamStatusClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
        max_retries: int = DEFAULT_MAX_RETRIES,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
        sleep: Any = time.sleep,
        session: requests.Session | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self._sleep = sleep
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                "X-API-Key": api_key,
                "Accept": "application/json",
            }
        )

    def close(self) -> None:
        self.session.close()

    def __enter__(self) -> "TeamStatusClient":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.close()

    def fetch_team_members(self) -> list[dict[str, Any]]:
        url = f"{self.base_url}{TEAM_MEMBERS_PATH}"
        payload = self._get_json(url, params=None, resource="team members")
        members = payload.get("members", []) if isinstance(payload, dict) else []
        if not isinstance(members, list):
            raise TeamStatusAPIError("Team members response did not contain a list under 'members'")
        return [normalize_member(member) for member in members if isinstance(member, dict)]

    def fetch_tasks(self, member_id: int, date: str) -> list[dict[str, Any]]:
        if member_id is None:
            raise ValueError("member_id is required to fetch tasks")
        _validate_date(date)
        url = f"{self.base_url}{TASKS_PATH}"
        payload = self._get_json(
            url,
            params={"member_id": int(member_id), "date": date},
            resource=f"tasks for member {member_id} on {date}",
        )
        tasks = payload.get("tasks", []) if isinstance(payload, dict) else []
        if not isinstance(tasks, list):
            raise TeamStatusAPIError("Tasks response did not contain a list under 'tasks'")
        normalized: list[dict[str, Any]] = []
        for task in tasks:
            if not isinstance(task, dict):
                continue
            normalized.append(normalize_task(task, member_id=int(member_id), work_date=date))
        return normalized

    def _get_json(
        self,
        url: str,
        params: dict[str, Any] | None,
        resource: str,
    ) -> dict[str, Any]:
        attempts = self.max_retries + 1
        last_exc: BaseException | None = None
        for attempt in range(1, attempts + 1):
            try:
                response = self.session.get(url, params=params, timeout=self.timeout_seconds)
            except RETRYABLE_EXCEPTIONS as exc:
                last_exc = exc
                if attempt < attempts:
                    backoff = self.backoff_factor * (2 ** (attempt - 1))
                    logger.warning(
                        "Network error fetching %s (attempt %d/%d): %s. Retrying in %.2fs.",
                        resource,
                        attempt,
                        attempts,
                        exc,
                        backoff,
                    )
                    self._sleep(backoff)
                    continue
                raise TeamStatusAPIError(
                    f"Network error fetching {resource} after {attempts} attempts: {exc}"
                ) from exc
            except requests.RequestException as exc:
                raise TeamStatusAPIError(f"Network error fetching {resource}: {exc}") from exc

            return self._handle_response(response, resource)

        if last_exc is not None:
            raise TeamStatusAPIError(
                f"Network error fetching {resource} after {attempts} attempts: {last_exc}"
            ) from last_exc
        raise TeamStatusAPIError(f"Network error fetching {resource}: no attempts made")

    def _handle_response(
        self,
        response: requests.Response,
        resource: str,
    ) -> dict[str, Any]:
        status = response.status_code
        if status == 200:
            try:
                return response.json()
            except ValueError as exc:
                raise TeamStatusAPIError(
                    f"Invalid JSON response fetching {resource}: {exc}"
                ) from exc

        if status == 401:
            raise TeamStatusAuthError(
                f"Team status API rejected the API key while fetching {resource} (HTTP 401)"
            )

        if status == 503:
            raise TeamStatusServerKeyError(
                f"Team status API reports its server-side key is not configured (HTTP 503)"
            )

        if status in (404, 422):
            logger.info("No data for %s (HTTP %s) - treating as empty result", resource, status)
            return {}

        detail = _safe_response_detail(response)
        raise TeamStatusAPIError(
            f"Unexpected HTTP {status} fetching {resource}: {detail}"
        )


def normalize_member(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record.get("id"),
        "name": record.get("name") or f"member-{record.get('id')}",
        "raw": record,
    }


def normalize_task(
    record: dict[str, Any],
    *,
    member_id: int,
    work_date: str,
) -> dict[str, Any]:
    status = record.get("status")
    if status is not None and status not in VALID_TASK_STATUSES:
        logger.warning("Unknown task status %r on task %s - keeping as-is", status, record.get("id"))
    return {
        "id": record.get("id"),
        "member_id": member_id,
        "title": record.get("title"),
        "status": status,
        "work_date": record.get("work_date") or work_date,
        "project_name": record.get("project_name"),
        "notes": record.get("notes"),
        "raw": record,
    }


def _validate_date(value: str) -> None:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except (TypeError, ValueError) as exc:
        raise ValueError(f"date must be YYYY-MM-DD, got {value!r}") from exc


def today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _safe_response_detail(response: requests.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        body = response.text[:200]
    if isinstance(body, dict):
        return str(body.get("error") or body.get("message") or body)
    return str(body)[:200]
