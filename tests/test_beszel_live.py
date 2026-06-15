from marvin_core.beszel_live import build_beszel_live_payload


class FakeBeszelClient:
    def __init__(self):
        self.closed = False

    def authenticate(self):
        pass

    def close(self):
        self.closed = True

    def fetch_systems(self):
        return [
            {
                "id": "s1",
                "name": "prod-web",
                "host": "10.0.0.1",
                "status": "up",
                "info": {"cpu": 5.4, "mp": 32.2, "dp": 71.9},
                "updated": "2026-06-15 09:10:00",
            },
            {
                "id": "s2",
                "name": "prod-db",
                "host": "10.0.0.2",
                "status": "down",
                "info": {},
                "updated": "2026-06-15 09:09:00",
            },
        ]

    def fetch_containers(self):
        return [
            {
                "id": "c1",
                "name": "nginx",
                "system": "s1",
                "status": "running",
                "image": "nginx:latest",
            }
        ]

    def fetch_alerts(self):
        return [
            {
                "id": "a1",
                "system": "s2",
                "name": "Disk",
                "triggered": True,
                "value": 91,
                "min": 80,
            },
            {
                "id": "a2",
                "system": "s1",
                "name": "CPU",
                "triggered": False,
                "value": 12,
                "min": 90,
            },
        ]

    def fetch_alert_history(self, lookback_hours=24):
        return [
            {
                "id": "h1",
                "system": "s2",
                "alert": "a1",
                "type": "disk",
                "value": "91",
                "resolved": False,
                "created": "2026-06-15 09:00:00",
            }
        ]

    def fetch_system_stats(self, system_id, lookback_hours=1):
        if system_id == "s1":
            return [
                {
                    "id": "st2",
                    "system": "s1",
                    "cpu": 18.456,
                    "mem_percent": 40.12,
                    "disk_percent": 72.0,
                    "created": "2026-06-15 09:02:00",
                },
                {
                    "id": "st1",
                    "system": "s1",
                    "cpu": 10.111,
                    "mem_percent": 35.0,
                    "disk_percent": 71.5,
                    "created": "2026-06-15 09:01:00",
                },
            ]
        return []


def test_build_beszel_live_payload_summarizes_live_state():
    payload = build_beszel_live_payload(client=FakeBeszelClient())

    assert payload["summary"]["systemCount"] == 2
    assert payload["summary"]["containerCount"] == 1
    assert payload["summary"]["triggeredAlertCount"] == 1
    assert payload["summary"]["unresolvedAlertHistoryCount"] == 1
    assert payload["summary"]["systemStatusCounts"] == {"up": 1, "down": 1}
    assert payload["alerts"][0]["systemName"] == "prod-db"
    assert payload["containers"][0]["systemName"] == "prod-web"
    assert payload["fetchedAt"]


def test_build_beszel_live_payload_groups_system_details_and_sorts_series():
    payload = build_beszel_live_payload(client=FakeBeszelClient())
    web = payload["systems"][0]
    db = payload["systems"][1]

    assert web["name"] == "prod-web"
    assert web["containers"][0]["name"] == "nginx"
    assert web["alerts"][0]["name"] == "CPU"
    assert [point["created"] for point in web["series"]] == [
        "2026-06-15 09:01:00",
        "2026-06-15 09:02:00",
    ]
    assert web["latest"]["cpu"] == 18.46
    assert db["latest"]["cpu"] is None
