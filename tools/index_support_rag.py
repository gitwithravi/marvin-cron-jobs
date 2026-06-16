import argparse
import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from marvin_core.support_rag import index_support_kb


def main() -> None:
    parser = argparse.ArgumentParser(description="Index Vityarthi support ticket exports for RAG suggestions")
    parser.add_argument("--kb-dir", default="kb", help="Directory containing support ticket CSV exports")
    parser.add_argument("--no-qdrant", action="store_true", help="Only write the JSONL fallback index")
    args = parser.parse_args()

    result = index_support_kb(kb_dir=args.kb_dir, use_qdrant=not args.no_qdrant)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
