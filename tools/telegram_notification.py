import argparse
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from marvin_core.env import load_root_env
from marvin_core.notifications.telegram import TelegramNotificationError, send_telegram_message


def main() -> None:
    parser = argparse.ArgumentParser(description="Send a Telegram notification through MARVIN config")
    parser.add_argument("--message", required=True, help="Message text to send")
    args = parser.parse_args()
    load_root_env()
    try:
        result = send_telegram_message(args.message)
    except TelegramNotificationError as exc:
        print(f"telegram: failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    print(f"{result.channel}: {result.detail}")


if __name__ == "__main__":
    main()
