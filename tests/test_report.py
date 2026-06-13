from marvin_core.report import write_markdown_report
import pytest


def test_write_markdown_report(tmp_path):
    path = write_markdown_report(
        tmp_path,
        "2026-06-13_000000",
        title="Example",
        factual_data={"monitor_count": 1},
        analysis={
            "summary": "All good.",
            "recommended_actions": ["No action."],
            "risk_level": "low",
            "notable_facts": ["One monitor."],
        },
    )

    content = path.read_text(encoding="utf-8")
    assert "# Example" in content
    assert "All good." in content
    assert '"monitor_count": 1' in content


def test_write_markdown_report_rejects_invalid_risk(tmp_path):
    with pytest.raises(ValueError):
        write_markdown_report(
            tmp_path,
            "2026-06-13_000000",
            title="Example",
            factual_data={"monitor_count": 1},
            analysis={
                "summary": "All good.",
                "recommended_actions": ["No action."],
                "risk_level": "confusing",
                "notable_facts": ["One monitor."],
            },
        )
