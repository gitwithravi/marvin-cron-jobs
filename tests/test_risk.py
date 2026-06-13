import pytest

from marvin_core.risk import normalize_risk_level, risk_meets_threshold


def test_risk_threshold_ordering():
    assert risk_meets_threshold("medium", "medium")
    assert risk_meets_threshold("high", "medium")
    assert risk_meets_threshold("critical", "medium")
    assert not risk_meets_threshold("low", "medium")


def test_invalid_risk_level_is_rejected():
    with pytest.raises(ValueError):
        normalize_risk_level("apocalyptic-ish")

