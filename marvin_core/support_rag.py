from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Literal

from marvin_core.env import load_root_env
from marvin_core.hermes import HermesClient, HermesClientError, HermesConfigError
from marvin_core.openrouter import OpenRouterClient
from marvin_core.paths import project_path


DEFAULT_EXAMPLES_PATH = project_path("data/support_rag_examples.jsonl")
DEFAULT_COLLECTION = "vityarthi_support_replies_v1"
DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
HASH_EMBEDDING_DIM = 384

SUPPORT_CATEGORIES: dict[str, tuple[str, ...]] = {
    "payment_refund": (
        "payment",
        "paid",
        "purchase",
        "refund",
        "transaction",
        "upi",
        "amount",
        "receipt",
        "failed",
        "pending",
        "captured",
    ),
    "course_access": (
        "access",
        "my course",
        "mycourse",
        "course not",
        "not showing",
        "not reflecting",
        "purchased",
        "enroll",
        "registered",
    ),
    "certificate": ("certificate", "certification"),
    "login_account": ("login", "password", "otp", "account", "email", "mobile"),
    "video_content": ("video", "lecture", "content", "module", "class", "lesson"),
    "exam_quiz": ("exam", "quiz", "test", "assessment", "reattempt", "submitted", "proctoring"),
    "download_app": ("download", "app", "pdf", "ide", "editor"),
}

LOW_VALUE_REPLY_PATTERNS = (
    "ok",
    "okay",
    "done",
    "yes",
    "no",
    "approved",
    "same has been approved",
    "your request has been approved",
    "thank you",
    "thanks",
)

TEST_SUBJECT_PATTERNS = (
    "testing ticket",
    "testing the tick",
    "test ticket",
    "random test",
)


@dataclass(frozen=True)
class SupportRagExample:
    doc_id: str
    ticket_id: str
    ticket_number: str | None
    subject: str
    category: str
    status: str
    priority: str
    customer_message: str
    staff_reply: str
    created_at: str | None
    staff_reply_id: str | None
    source: str

    @property
    def searchable_text(self) -> str:
        return "\n".join(
            part
            for part in (
                f"Subject: {self.subject}",
                f"Category: {self.category}",
                f"Customer issue: {self.customer_message}",
            )
            if part
        )


@dataclass(frozen=True)
class RetrievalMatch:
    doc_id: str
    score: float
    ticket_id: str
    subject: str
    category: str
    customer_message: str
    staff_reply: str


@dataclass(frozen=True)
class SupportSuggestion:
    suggested_reply: str
    confidence: Literal["low", "medium", "high"]
    matched_examples: list[dict[str, Any]]
    policy_flags: list[str]
    requires_human_attention: bool
    retrieval_backend: str


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def tokenize(value: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]+", value.lower())
        if len(token) > 2
    ]


def infer_support_category(*parts: str | None) -> str:
    text = " ".join(normalize_text(part).lower() for part in parts if part)
    if not text:
        return "unknown"

    best_category = "unknown"
    best_score = 0
    for category, terms in SUPPORT_CATEGORIES.items():
        score = sum(1 for term in terms if term in text)
        if score > best_score:
            best_category = category
            best_score = score
    return best_category


def latest_csv(kb_dir: Path, pattern: str) -> Path:
    matches = sorted(kb_dir.glob(pattern))
    if not matches:
        raise FileNotFoundError(f"No CSV matching {pattern} found in {kb_dir}")
    return matches[-1]


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _is_test_ticket(subject: str, messages: Iterable[str]) -> bool:
    haystack = " ".join([subject, *messages]).lower()
    return any(pattern in haystack for pattern in TEST_SUBJECT_PATTERNS)


def _is_low_value_reply(reply: str) -> bool:
    clean = normalize_text(reply).lower().strip(".! ")
    if len(clean) < 18:
        return True
    return clean in LOW_VALUE_REPLY_PATTERNS


def _stable_doc_id(ticket_id: str, staff_reply_id: str | None, staff_reply: str) -> str:
    source = f"{ticket_id}:{staff_reply_id or ''}:{staff_reply}"
    return hashlib.sha1(source.encode("utf-8")).hexdigest()


def build_examples_from_csv(
    *,
    tickets_path: Path,
    replies_path: Path,
) -> list[SupportRagExample]:
    tickets = {row["id"]: row for row in read_csv_rows(tickets_path)}
    replies_by_ticket: dict[str, list[dict[str, str]]] = {}
    for reply in read_csv_rows(replies_path):
        replies_by_ticket.setdefault(reply["ticket_id"], []).append(reply)

    examples: list[SupportRagExample] = []
    for ticket_id, ticket in tickets.items():
        replies = sorted(
            replies_by_ticket.get(ticket_id, []),
            key=lambda row: row.get("created_at") or "",
        )
        owner_id = ticket.get("user_id")
        subject = normalize_text(ticket.get("subject"))
        all_messages = [normalize_text(reply.get("message")) for reply in replies]
        if _is_test_ticket(subject, all_messages):
            continue

        customer_messages: list[str] = []
        for reply in replies:
            message = normalize_text(reply.get("message"))
            if not message:
                continue
            is_customer = reply.get("user_id") == owner_id
            if is_customer:
                customer_messages.append(message)
                continue

            if _is_low_value_reply(message):
                continue

            context = " ".join(customer_messages).strip()
            if not context:
                context = " ".join(
                    normalize_text(item.get("message"))
                    for item in replies
                    if item.get("user_id") == owner_id
                ).strip()
            if len(context) < 8:
                continue

            category = infer_support_category(subject, context, message)
            examples.append(
                SupportRagExample(
                    doc_id=_stable_doc_id(ticket_id, reply.get("id"), message),
                    ticket_id=ticket_id,
                    ticket_number=ticket.get("ticket_number") or None,
                    subject=subject,
                    category=category,
                    status=ticket.get("status") or "unknown",
                    priority=ticket.get("priority") or "unknown",
                    customer_message=context,
                    staff_reply=message,
                    created_at=reply.get("created_at") or ticket.get("created_at"),
                    staff_reply_id=reply.get("id") or None,
                    source=str(tickets_path.parent),
                )
            )

    examples.sort(key=lambda item: (item.category, item.subject, item.ticket_id, item.doc_id))
    return examples


def load_kb_examples(kb_dir: str | Path = "kb") -> list[SupportRagExample]:
    kb_path = project_path(kb_dir)
    tickets_path = latest_csv(kb_path, "support_tickets_export_*.csv")
    replies_path = latest_csv(kb_path, "support_ticket_replies_export_*.csv")
    return build_examples_from_csv(tickets_path=tickets_path, replies_path=replies_path)


def write_examples_jsonl(examples: Iterable[SupportRagExample], output_path: str | Path) -> int:
    path = project_path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8") as handle:
        for example in examples:
            handle.write(json.dumps(asdict(example), sort_keys=True, ensure_ascii=False) + "\n")
            count += 1
    return count


def read_examples_jsonl(path: str | Path = DEFAULT_EXAMPLES_PATH) -> list[SupportRagExample]:
    jsonl_path = project_path(path)
    if not jsonl_path.exists():
        return []
    examples: list[SupportRagExample] = []
    with jsonl_path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            examples.append(SupportRagExample(**json.loads(line)))
    return examples


class LocalEmbeddingProvider:
    def __init__(self, model_name: str | None = None) -> None:
        model_name = model_name or os.getenv("SUPPORT_RAG_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
        self.model_name = model_name
        self._model: Any | None = None
        self.backend = "hash"
        try:
            from fastembed import TextEmbedding

            self._model = TextEmbedding(model_name=model_name)
            self.backend = "fastembed"
        except Exception:
            self._model = None

    @property
    def dimension(self) -> int:
        if self._model is None:
            return HASH_EMBEDDING_DIM
        vector = next(iter(self.embed(["dimension probe"])))
        return len(vector)

    def embed(self, texts: list[str]) -> list[list[float]]:
        if self._model is not None:
            return [list(vector) for vector in self._model.embed(texts)]
        return [_hash_embedding(text) for text in texts]


def _hash_embedding(text: str) -> list[float]:
    vector = [0.0] * HASH_EMBEDDING_DIM
    for token in tokenize(text):
        digest = hashlib.sha1(token.encode("utf-8")).digest()
        bucket = int.from_bytes(digest[:4], "big") % HASH_EMBEDDING_DIM
        sign = -1.0 if digest[4] % 2 else 1.0
        vector[bucket] += sign
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


class QdrantSupportStore:
    def __init__(
        self,
        *,
        collection_name: str = DEFAULT_COLLECTION,
        embedding_provider: LocalEmbeddingProvider | None = None,
    ) -> None:
        self.collection_name = collection_name
        self.embedding_provider = embedding_provider or LocalEmbeddingProvider()
        self.client = self._build_client()

    def _build_client(self) -> Any:
        try:
            from qdrant_client import QdrantClient
        except Exception as exc:
            raise RuntimeError("qdrant-client is not installed") from exc

        url = os.getenv("SUPPORT_RAG_QDRANT_URL", "").strip()
        api_key = os.getenv("SUPPORT_RAG_QDRANT_API_KEY", "").strip() or None
        if url:
            return QdrantClient(url=url, api_key=api_key)

        qdrant_path = project_path(os.getenv("SUPPORT_RAG_QDRANT_PATH", "data/qdrant_support_rag"))
        qdrant_path.mkdir(parents=True, exist_ok=True)
        return QdrantClient(path=str(qdrant_path))

    def recreate_collection(self) -> None:
        from qdrant_client.models import Distance, VectorParams

        self.client.recreate_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=self.embedding_provider.dimension,
                distance=Distance.COSINE,
            ),
        )

    def upsert_examples(self, examples: list[SupportRagExample]) -> int:
        from qdrant_client.models import PointStruct

        if not examples:
            return 0

        self.recreate_collection()
        vectors = self.embedding_provider.embed([example.searchable_text for example in examples])
        points = [
            PointStruct(
                id=int(example.doc_id[:16], 16),
                vector=vector,
                payload=asdict(example) | {"searchable_text": example.searchable_text},
            )
            for example, vector in zip(examples, vectors)
        ]
        self.client.upsert(collection_name=self.collection_name, points=points)
        return len(points)

    def search(self, query: str, *, limit: int = 5, category: str | None = None) -> list[RetrievalMatch]:
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        vector = self.embedding_provider.embed([query])[0]
        matches: list[RetrievalMatch] = []

        if category and category != "unknown":
            cat_filter = Filter(
                must=[FieldCondition(key="category", match=MatchValue(value=category))]
            )
            cat_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=vector,
                limit=limit,
                query_filter=cat_filter,
                with_payload=True,
            )
            for result in cat_results:
                payload = result.payload or {}
                matches.append(_payload_to_match(payload, float(result.score)))

        if len(matches) < limit:
            remaining = limit - len(matches)
            seen_ids = {m.doc_id for m in matches}
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=vector,
                limit=remaining * 3,
                with_payload=True,
            )
            for result in results:
                payload = result.payload or {}
                match = _payload_to_match(payload, float(result.score))
                if match.doc_id not in seen_ids:
                    seen_ids.add(match.doc_id)
                    matches.append(match)
                    if len(matches) >= limit:
                        break

        return matches


def _payload_to_match(payload: dict[str, Any], score: float) -> RetrievalMatch:
    return RetrievalMatch(
        doc_id=str(payload.get("doc_id") or ""),
        score=score,
        ticket_id=str(payload.get("ticket_id") or ""),
        subject=str(payload.get("subject") or ""),
        category=str(payload.get("category") or "unknown"),
        customer_message=str(payload.get("customer_message") or ""),
        staff_reply=str(payload.get("staff_reply") or ""),
    )


class LexicalSupportStore:
    def __init__(self, examples: list[SupportRagExample]) -> None:
        self.examples = examples
        self.backend = "lexical_jsonl"

    def search(self, query: str, *, limit: int = 5, category: str | None = None) -> list[RetrievalMatch]:
        query_tokens = set(tokenize(query))
        if not query_tokens:
            return []

        def _score_example(example: SupportRagExample) -> float:
            example_tokens = set(tokenize(example.searchable_text))
            if not example_tokens:
                return 0.0
            overlap = len(query_tokens & example_tokens)
            if overlap == 0:
                return 0.0
            return overlap / max(len(query_tokens), 1)

        in_category: list[RetrievalMatch] = []
        other: list[RetrievalMatch] = []
        for example in self.examples:
            base_score = _score_example(example)
            if base_score <= 0:
                continue
            score = base_score
            if category and example.category == category:
                score += 0.25
            match = RetrievalMatch(
                doc_id=example.doc_id,
                score=round(score, 4),
                ticket_id=example.ticket_id,
                subject=example.subject,
                category=example.category,
                customer_message=example.customer_message,
                staff_reply=example.staff_reply,
            )
            if category and example.category == category:
                in_category.append(match)
            elif category and category != "unknown":
                other.append(match)
            else:
                in_category.append(match)

        in_category.sort(key=lambda item: item.score, reverse=True)
        other.sort(key=lambda item: item.score, reverse=True)

        merged = in_category[:limit]
        if len(merged) < limit:
            merged.extend(other[: limit - len(merged)])
        return merged


def build_ticket_query(ticket: dict[str, Any]) -> str:
    parts = [
        normalize_text(str(ticket.get("subject") or "")),
        normalize_text(str(ticket.get("message") or "")),
    ]
    for reply in ticket.get("replies") or []:
        if not isinstance(reply, dict):
            continue
        role = str(reply.get("role") or "").lower()
        if role in {"customer", "student", "user"}:
            parts.append(normalize_text(str(reply.get("message") or "")))
    return "\n".join(part for part in parts if part)


def policy_flags_for_ticket(ticket: dict[str, Any], category: str) -> list[str]:
    flags: list[str] = []
    query = build_ticket_query(ticket).lower()
    if category == "payment_refund" or any(term in query for term in ("payment", "refund", "upi", "transaction")):
        flags.append("Verify payment capture/refund status before claiming the issue is resolved.")
    if category == "course_access" or "access" in query:
        flags.append("Verify course enrollment/access state before promising access has been restored.")
    if category == "certificate" or "certificate" in query:
        flags.append("Verify certificate/progress state before asking the student to regenerate it.")
    if any(term in query for term in ("urgent", "deadline", "exam", "quiz", "reattempt")):
        flags.append("Human review required for academic evaluation or deadline-sensitive requests.")
    return flags


def confidence_from_matches(matches: list[RetrievalMatch], flags: list[str]) -> Literal["low", "medium", "high"]:
    if not matches:
        return "low"
    top_score = matches[0].score
    if top_score >= 0.65 and len(flags) <= 1:
        return "high"
    if top_score >= 0.25:
        return "medium"
    return "low"


class SupportRagEngine:
    def __init__(
        self,
        *,
        examples_path: str | Path = DEFAULT_EXAMPLES_PATH,
        kb_dir: str | Path = "kb",
        collection_name: str = DEFAULT_COLLECTION,
        prefer_qdrant: bool = True,
    ) -> None:
        self.examples_path = project_path(examples_path)
        self.kb_dir = project_path(kb_dir)
        self.collection_name = collection_name
        self.prefer_qdrant = prefer_qdrant

    def load_examples(self) -> list[SupportRagExample]:
        examples = read_examples_jsonl(self.examples_path)
        if examples:
            return examples
        if self.kb_dir.exists():
            return load_kb_examples(self.kb_dir)
        return []

    def retrieve(self, ticket: dict[str, Any], *, limit: int = 5) -> tuple[list[RetrievalMatch], str]:
        query = build_ticket_query(ticket)
        category = infer_support_category(ticket.get("subject"), query)

        if self.prefer_qdrant:
            try:
                store = QdrantSupportStore(collection_name=self.collection_name)
                matches = store.search(query, limit=limit, category=category)
                if matches:
                    return matches, "qdrant"
            except Exception:
                pass

        examples = self.load_examples()
        store = LexicalSupportStore(examples)
        return store.search(query, limit=limit, category=category), store.backend

    def suggest(self, ticket: dict[str, Any], *, limit: int = 5) -> SupportSuggestion:
        matches, backend = self.retrieve(ticket, limit=limit)
        category = infer_support_category(ticket.get("subject"), build_ticket_query(ticket))
        flags = policy_flags_for_ticket(ticket, category)
        confidence = confidence_from_matches(matches, flags)
        matched_examples = [asdict(match) for match in matches]
        model_reply = self._generate_with_llm(ticket, matches, flags)
        suggested_reply = model_reply or self._fallback_reply(ticket, matches, flags)
        requires_human_attention = confidence == "low" or bool(flags)
        return SupportSuggestion(
            suggested_reply=suggested_reply,
            confidence=confidence,
            matched_examples=matched_examples,
            policy_flags=flags,
            requires_human_attention=requires_human_attention,
            retrieval_backend=backend,
        )

    def _generate_with_llm(
        self,
        ticket: dict[str, Any],
        matches: list[RetrievalMatch],
        flags: list[str],
    ) -> str | None:
        load_root_env()
        if not matches:
            return None

        messages = build_generation_messages(ticket=ticket, matches=matches, flags=flags)
        try:
            openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
            model = os.getenv("SUPPORT_RAG_MODEL", "").strip() or os.getenv("MARVIN_CHAT_MODEL", "").strip()
            if openrouter_key and model:
                client = OpenRouterClient(openrouter_key)
                result = client.chat_json(
                    model=model,
                    messages=messages,
                    temperature=float(os.getenv("SUPPORT_RAG_TEMPERATURE", "0.2")),
                    max_tokens=int(os.getenv("SUPPORT_RAG_MAX_TOKENS", "700")),
                )
                reply = normalize_text(str(result.get("suggested_reply") or ""))
                return reply or None

            client = HermesClient.from_env()
            text = client.chat(
                message=messages[-1]["content"],
                history=messages[:-1],
                temperature=float(os.getenv("SUPPORT_RAG_TEMPERATURE", "0.2")),
                max_tokens=int(os.getenv("SUPPORT_RAG_MAX_TOKENS", "700")),
            )
            parsed = _parse_json_object(text)
            reply = normalize_text(str(parsed.get("suggested_reply") or ""))
            return reply or None
        except Exception:
            return None

    def _fallback_reply(
        self,
        ticket: dict[str, Any],
        matches: list[RetrievalMatch],
        flags: list[str],
    ) -> str:
        if not matches:
            return (
                "Hi, thanks for sharing the details. I need to review this ticket once with the "
                "latest account/course state before giving you a final update."
            )

        base = matches[0].staff_reply.strip()
        prefix = "Hi, "
        if re.match(r"^(hi|hello)\b", base.lower()):
            prefix = ""
        reply = f"{prefix}{base}" if prefix else base
        if flags:
            reply += "\n\nInternal check before sending: " + " ".join(flags)
        return reply


def _parse_json_object(text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Expected JSON object")
    return parsed


def build_generation_messages(
    *,
    ticket: dict[str, Any],
    matches: list[RetrievalMatch],
    flags: list[str],
) -> list[dict[str, str]]:
    examples = [
        {
            "score": match.score,
            "category": match.category,
            "historical_subject": match.subject,
            "historical_customer_issue": match.customer_message,
            "historical_staff_reply": match.staff_reply,
        }
        for match in matches
    ]
    payload = {
        "current_ticket": ticket,
        "retrieved_examples": examples,
        "policy_flags": flags,
    }
    return [
        {
            "role": "system",
            "content": (
                "You draft concise Vityarthi support replies. Use only the current ticket and "
                "retrieved examples. Do not claim payment capture, refunds, enrollment, certificate "
                "state, approvals, or account changes unless the current ticket context explicitly "
                "contains that verified fact. If verification is needed, ask for it briefly. "
                "Return valid JSON only with key suggested_reply."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(payload, indent=2, sort_keys=True, default=str),
        },
    ]


def index_support_kb(
    *,
    kb_dir: str | Path = "kb",
    examples_path: str | Path = DEFAULT_EXAMPLES_PATH,
    collection_name: str = DEFAULT_COLLECTION,
    use_qdrant: bool = True,
) -> dict[str, Any]:
    examples = load_kb_examples(kb_dir)
    jsonl_count = write_examples_jsonl(examples, examples_path)
    qdrant_count = 0
    qdrant_error: str | None = None

    if use_qdrant:
        try:
            store = QdrantSupportStore(collection_name=collection_name)
            qdrant_count = store.upsert_examples(examples)
        except Exception as exc:
            qdrant_error = str(exc)

    return {
        "examples": len(examples),
        "jsonl_examples": jsonl_count,
        "examples_path": str(project_path(examples_path)),
        "qdrant_examples": qdrant_count,
        "qdrant_error": qdrant_error,
        "collection_name": collection_name,
    }
