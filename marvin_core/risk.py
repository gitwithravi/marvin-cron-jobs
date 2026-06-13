from typing import Any


RISK_ORDER = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


def normalize_risk_level(value: Any) -> str:
    risk = str(value or "low").strip().lower()
    if risk not in RISK_ORDER:
        raise ValueError(f"Invalid risk level: {value}")
    return risk


def risk_meets_threshold(risk_level: str, threshold: str) -> bool:
    risk = normalize_risk_level(risk_level)
    minimum = normalize_risk_level(threshold)
    return RISK_ORDER[risk] >= RISK_ORDER[minimum]

