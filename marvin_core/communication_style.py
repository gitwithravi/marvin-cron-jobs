from pathlib import Path

from marvin_core.paths import ROOT_DIR


def load_communication_style(path: Path | None = None) -> str:
    style_path = path or ROOT_DIR / "communication_style.md"
    if not style_path.exists():
        raise FileNotFoundError(f"Missing communication_style.md at {style_path}")
    return style_path.read_text(encoding="utf-8").strip()

