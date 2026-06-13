import os
from pathlib import Path

from dotenv import load_dotenv

from marvin_core.paths import ROOT_DIR


def load_root_env(env_path: Path | None = None) -> None:
    load_dotenv(env_path or ROOT_DIR / ".env")


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

