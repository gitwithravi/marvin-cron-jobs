import argparse
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from marvin_core.email_capture import process_imap_emails
from marvin_core.env import load_root_env, require_env


def main() -> None:
    parser = argparse.ArgumentParser(description="Poll IMAP inbox and process unread emails into MARVIN todos")
    parser.add_argument("--no-mark-read", action="store_true", help="Do not mark emails as read after processing")
    parser.add_argument("--folder", default="INBOX", help="IMAP folder to poll (default: INBOX)")
    args = parser.parse_args()

    load_root_env()
    results = process_imap_emails(
        host=require_env("MARVIN_IMAP_HOST"),
        username=require_env("MARVIN_IMAP_USERNAME"),
        password=require_env("MARVIN_IMAP_PASSWORD"),
        port=int(require_env("MARVIN_IMAP_PORT")),
        folder=args.folder,
        mark_read=not args.no_mark_read,
    )

    if not results:
        print("No unread emails found.")
        return

    created = [r for r in results if r.get("success")]
    failed = [r for r in results if not r.get("success")]
    print(f"Processed {len(results)} email(s): {len(created)} created, {len(failed)} failed")
    for r in created:
        dup = " (duplicate)" if r.get("duplicate") else ""
        print(f"  [{r.get('priority', '?')}] {r.get('title', '?')}{dup}")
    for r in failed:
        print(f"  FAILED: {r.get('from', '?')} — {r.get('error', '?')}", file=sys.stderr)


if __name__ == "__main__":
    main()
