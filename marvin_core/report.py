from pathlib import Path
from typing import Any

from marvin_core.paths import project_path
from marvin_core.risk import normalize_risk_level


def write_markdown_report(
    report_dir: str | Path,
    timestamp_slug: str,
    *,
    title: str,
    factual_data: dict[str, Any],
    analysis: dict[str, Any],
) -> Path:
    output_dir = project_path(report_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{timestamp_slug}.md"
    risk_level = normalize_risk_level(analysis.get("risk_level", "low"))

    lines = [
        f"# {title}",
        "",
        "## Summary",
        "",
        str(analysis.get("summary", "")).strip() or "No summary returned.",
        "",
        "## Recommended Actions",
        "",
    ]

    actions = analysis.get("recommended_actions") or []
    if actions:
        lines.extend([f"- {action}" for action in actions])
    else:
        lines.append("- No recommended actions returned.")

    lines.extend(
        [
            "",
            "## Risk Level",
            "",
            risk_level,
            "",
            "## Notable Facts",
            "",
        ]
    )

    facts = analysis.get("notable_facts") or []
    if facts:
        lines.extend([f"- {fact}" for fact in facts])
    else:
        lines.append("- No notable facts returned.")

    lines.extend(["", "## Factual Data", "", "```json"])

    import json

    lines.append(json.dumps(factual_data, indent=2, sort_keys=True, default=str))
    lines.extend(["```", ""])
    path.write_text("\n".join(lines), encoding="utf-8")
    latest_link = output_dir / "latest.md"
    latest_link.unlink(missing_ok=True)
    latest_link.symlink_to(path.name)
    return path
