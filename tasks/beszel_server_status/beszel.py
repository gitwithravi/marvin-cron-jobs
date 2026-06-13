import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)


class BeszelClient:
    def __init__(self, base_url: str, email: str | None = None, password: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.token: str | None = None
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def authenticate(self) -> None:
        if not self.email or not self.password:
            return
        response = self.session.post(
            f"{self.base_url}/api/collections/users/auth-with-password",
            json={"identity": self.email, "password": self.password},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        self.token = data.get("token")
        if self.token:
            self.session.headers["Authorization"] = f"Bearer {self.token}"

    def _get_list(
        self,
        collection: str,
        page: int = 1,
        per_page: int = 100,
        filter_expr: str | None = None,
        sort: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"page": page, "perPage": per_page}
        if filter_expr:
            params["filter"] = filter_expr
        if sort:
            params["sort"] = sort
        response = self.session.get(
            f"{self.base_url}/api/collections/{collection}/records",
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def _fetch_all(self, collection: str, sort: str | None = None, filter_expr: str | None = None) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        page = 1
        while True:
            data = self._get_list(collection, page=page, per_page=100, sort=sort, filter_expr=filter_expr)
            items = data.get("items", [])
            records.extend(items)
            total = data.get("totalItems", 0) or len(items)
            if len(records) >= total or not items:
                break
            page += 1
        return records

    def fetch_systems(self) -> list[dict[str, Any]]:
        records = self._fetch_all("systems", sort="-updated")
        return [normalize_system(r) for r in records]

    def fetch_containers(self) -> list[dict[str, Any]]:
        try:
            records = self._fetch_all("containers", sort="-updated")
        except requests.HTTPError as exc:
            logger.warning("Failed to fetch containers: %s", exc)
            return []
        return [normalize_container(r) for r in records]

    def fetch_alerts(self) -> list[dict[str, Any]]:
        records = self._fetch_all("alerts", sort="-updated")
        return [normalize_alert(r) for r in records]

    def fetch_alert_history(self, lookback_hours: int = 24) -> list[dict[str, Any]]:
        since = (datetime.now(timezone.utc) - timedelta(hours=lookback_hours)).strftime("%Y-%m-%d %H:%M:%S")
        filter_expr = f'created >= "{since}"'
        try:
            records = self._fetch_all("alerts_history", sort="-created", filter_expr=filter_expr)
        except requests.HTTPError as exc:
            logger.warning("Failed to fetch alert history: %s", exc)
            return []
        return [normalize_alert_history(r) for r in records]

    def fetch_system_stats(self, system_id: str, lookback_hours: int = 1) -> list[dict[str, Any]]:
        since = (datetime.now(timezone.utc) - timedelta(hours=lookback_hours)).strftime("%Y-%m-%d %H:%M:%S")
        filter_expr = f'system = "{system_id}" && created >= "{since}"'
        try:
            records = self._fetch_all("system_stats", sort="-created", filter_expr=filter_expr)
        except requests.HTTPError as exc:
            logger.warning("Failed to fetch system stats for %s: %s", system_id, exc)
            return []
        return [normalize_system_stat(r) for r in records]

    def close(self) -> None:
        self.session.close()


def normalize_system(record: dict[str, Any]) -> dict[str, Any]:
    info = record.get("info") or {}
    return {
        "id": record.get("id"),
        "name": record.get("name") or f"system-{record.get('id')}",
        "host": record.get("host"),
        "status": record.get("status"),
        "port": record.get("port"),
        "info": info,
        "created": record.get("created"),
        "updated": record.get("updated"),
        "raw": record,
    }


def normalize_container(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record.get("id"),
        "name": record.get("name") or f"container-{record.get('id')}",
        "system": record.get("system"),
        "status": record.get("status"),
        "image": record.get("image"),
        "cpu": record.get("cpu"),
        "memory": record.get("memory"),
        "health": record.get("health"),
        "ports": record.get("ports"),
        "updated": record.get("updated"),
        "raw": record,
    }


def normalize_alert(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record.get("id"),
        "system": record.get("system"),
        "name": record.get("name"),
        "triggered": record.get("triggered"),
        "value": record.get("value"),
        "min": record.get("min"),
        "created": record.get("created"),
        "updated": record.get("updated"),
        "raw": record,
    }


def normalize_alert_history(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record.get("id"),
        "system": record.get("system"),
        "alert": record.get("alert"),
        "type": record.get("type"),
        "value": record.get("value"),
        "resolved": record.get("resolved"),
        "created": record.get("created"),
        "updated": record.get("updated"),
        "raw": record,
    }


def normalize_system_stat(record: dict[str, Any]) -> dict[str, Any]:
    stats = record.get("stats") or {}
    return {
        "id": record.get("id"),
        "system": record.get("system"),
        "type": record.get("type"),
        "cpu": stats.get("cpu"),
        "mem_percent": stats.get("mp"),
        "mem_used_gb": stats.get("mu"),
        "disk_percent": stats.get("dp"),
        "disk_used_gb": stats.get("du"),
        "disk_write": stats.get("dw"),
        "load_avg": stats.get("la"),
        "network_io": stats.get("ni"),
        "stats_raw": stats,
        "created": record.get("created"),
        "updated": record.get("updated"),
        "raw": record,
    }