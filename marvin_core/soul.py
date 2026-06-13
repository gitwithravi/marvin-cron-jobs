from pathlib import Path

from marvin_core.paths import ROOT_DIR


def load_soul(path: Path | None = None) -> str:
    soul_path = path or ROOT_DIR / "SOUL.md"
    if not soul_path.exists():
        raise FileNotFoundError(f"Missing SOUL.md at {soul_path}")
    return soul_path.read_text(encoding="utf-8").strip()

