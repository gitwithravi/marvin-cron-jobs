from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


def project_path(path: str | Path) -> Path:
    candidate = Path(path)
    if candidate.is_absolute():
        return candidate
    return ROOT_DIR / candidate

