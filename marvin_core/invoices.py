import base64
import json
import os
import re
import shutil
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from marvin_core.db import connect, migrate
from marvin_core.env import load_root_env, require_env
from marvin_core.openrouter import OpenRouterClient
from marvin_core.paths import project_path


DATABASE_PATH = "data/marvin.sqlite3"
UPLOAD_DIR = "data/invoice_uploads/tmp"
ARCHIVE_DIR = "data/invoices"
DEFAULT_INVOICE_MODEL = "google/gemini-2.5-flash"
DEFAULT_PDF_ENGINE = "cloudflare-ai"

INVOICE_SCHEMA = {
    "name": "invoice_extraction",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "invoice_no": {
                "type": ["string", "null"],
                "description": "Invoice number exactly as shown on the invoice.",
            },
            "invoice_date": {
                "type": ["string", "null"],
                "description": "Invoice date in YYYY-MM-DD format. Use null when missing.",
            },
            "invoice_from": {
                "type": ["string", "null"],
                "description": "Vendor, merchant, or issuer name.",
            },
            "amount_usd": {
                "type": ["number", "null"],
                "description": "Final invoice amount only when the invoice amount is in USD.",
            },
            "amount_inr": {
                "type": ["number", "null"],
                "description": "Final invoice amount only when the invoice amount is in INR.",
            },
            "currency_detected": {
                "type": ["string", "null"],
                "description": "Detected invoice currency such as USD or INR.",
            },
            "confidence": {
                "type": "number",
                "description": "Confidence from 0 to 1 for the extracted fields.",
            },
            "warnings": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Short warnings for fields that need human attention.",
            },
        },
        "required": [
            "invoice_no",
            "invoice_date",
            "invoice_from",
            "amount_usd",
            "amount_inr",
            "currency_detected",
            "confidence",
            "warnings",
        ],
        "additionalProperties": False,
    },
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    conn = connect(DATABASE_PATH)
    migrate(conn)
    return conn


def _upload_root() -> Path:
    path = project_path(UPLOAD_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _draft_path(draft_id: str) -> Path:
    if not re.fullmatch(r"[a-f0-9-]{36}", draft_id):
        raise ValueError("Invalid invoice draft id.")
    return _upload_root() / f"{draft_id}.pdf"


def _validate_pdf_filename(filename: str) -> str:
    clean = Path(filename).name.strip() or "invoice.pdf"
    if not clean.lower().endswith(".pdf"):
        raise ValueError("Only PDF invoices are supported.")
    return clean


def _validate_date(value: str | None) -> str:
    if not value:
        raise ValueError("Invoice date is required.")
    return datetime.strptime(value, "%Y-%m-%d").date().isoformat()


def _normalize_text(value: str | None, field: str) -> str:
    clean = re.sub(r"\s+", " ", (value or "").strip())
    if not clean:
        raise ValueError(f"{field} is required.")
    return clean


def _normalize_optional_text(value: str | None) -> str | None:
    clean = re.sub(r"\s+", " ", (value or "").strip())
    return clean or None


def _normalize_amount(value: Any) -> float | None:
    if value in (None, ""):
        return None
    amount = float(value)
    if amount < 0:
        raise ValueError("Invoice amount cannot be negative.")
    return round(amount, 2)


def _row_to_invoice(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "invoice_no": row["invoice_no"],
        "invoice_date": row["invoice_date"],
        "invoice_from": row["invoice_from"],
        "amount_usd": row["amount_usd"],
        "amount_inr": row["amount_inr"],
        "original_filename": row["original_filename"],
        "invoice_file_path": row["invoice_file_path"],
        "invoice_file_url": row["invoice_file_url"],
        "extraction_model": row["extraction_model"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _month_bounds(month: str | None) -> tuple[str, str]:
    if not month:
        today = date.today()
        month = f"{today.year:04d}-{today.month:02d}"
    parsed = datetime.strptime(month, "%Y-%m").date()
    if parsed.month == 12:
        next_month = date(parsed.year + 1, 1, 1)
    else:
        next_month = date(parsed.year, parsed.month + 1, 1)
    return parsed.isoformat(), next_month.isoformat()


def create_invoice_draft(pdf_bytes: bytes, filename: str) -> dict[str, Any]:
    clean_filename = _validate_pdf_filename(filename)
    if not pdf_bytes:
        raise ValueError("Invoice PDF is empty.")

    draft_id = str(uuid4())
    path = _draft_path(draft_id)
    path.write_bytes(pdf_bytes)
    extraction = extract_invoice_from_pdf(path, clean_filename)
    extraction["draft_id"] = draft_id
    extraction["original_filename"] = clean_filename
    extraction["duplicates"] = find_duplicate_warnings(
        extraction.get("invoice_no"),
        extraction.get("invoice_from"),
    )
    if extraction.get("amount_usd") is not None and extraction.get("amount_inr") is None:
        warnings = list(extraction.get("warnings") or [])
        warnings.append("INR amount is missing. Confirm once if this should be saved as USD-only.")
        extraction["warnings"] = warnings
    return extraction


def extract_invoice_from_pdf(pdf_path: str | Path, filename: str) -> dict[str, Any]:
    load_root_env()
    model = os.getenv("INVOICE_EXTRACTOR_MODEL", DEFAULT_INVOICE_MODEL)
    pdf_engine = os.getenv("INVOICE_PDF_ENGINE", DEFAULT_PDF_ENGINE)
    client = OpenRouterClient(require_env("OPENROUTER_API_KEY"), timeout_seconds=90)
    pdf_bytes = Path(pdf_path).read_bytes()
    encoded = base64.b64encode(pdf_bytes).decode("utf-8")
    response = client.chat_json(
        model=model,
        temperature=0,
        max_tokens=900,
        response_schema=INVOICE_SCHEMA,
        plugins=[{"id": "file-parser", "pdf": {"engine": pdf_engine}}],
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract reimbursement invoice fields from the PDF. Use the final billed total only. "
                    "If the invoice is in USD, set amount_usd and leave amount_inr null. "
                    "If the invoice is in INR, set amount_inr and leave amount_usd null. "
                    "Never convert currencies. Return null for uncertain missing fields."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Extract invoice_no, invoice_date, invoice_from, amount_usd, and amount_inr.",
                    },
                    {
                        "type": "file",
                        "file": {
                            "filename": filename,
                            "file_data": f"data:application/pdf;base64,{encoded}",
                        },
                    },
                ],
            },
        ],
    )
    warnings = response.get("warnings") if isinstance(response.get("warnings"), list) else []
    if response.get("amount_usd") is not None and response.get("amount_inr") is not None:
        warnings.append("Both USD and INR amounts were detected. Confirm and clear the incorrect amount.")
    return {
        "invoice_no": _normalize_optional_text(response.get("invoice_no")),
        "invoice_date": response.get("invoice_date"),
        "invoice_from": _normalize_optional_text(response.get("invoice_from")),
        "amount_usd": _normalize_amount(response.get("amount_usd")),
        "amount_inr": _normalize_amount(response.get("amount_inr")),
        "currency_detected": response.get("currency_detected"),
        "confidence": response.get("confidence"),
        "warnings": warnings,
        "extraction_model": model,
        "extraction_raw_json": response,
    }


def find_duplicate_warnings(invoice_no: str | None, invoice_from: str | None) -> list[dict[str, Any]]:
    clean_no = _normalize_optional_text(invoice_no)
    clean_from = _normalize_optional_text(invoice_from)
    if not clean_no or not clean_from:
        return []
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT *
            FROM reimbursement_invoices
            WHERE lower(invoice_no) = lower(?) AND lower(invoice_from) = lower(?)
            ORDER BY invoice_date DESC
            LIMIT 5
            """,
            (clean_no, clean_from),
        ).fetchall()
        return [_row_to_invoice(row) for row in rows]
    finally:
        conn.close()


def list_invoices(month: str | None = None) -> dict[str, Any]:
    start, end = _month_bounds(month)
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT *
            FROM reimbursement_invoices
            WHERE invoice_date >= ? AND invoice_date < ?
            ORDER BY invoice_date DESC, id DESC
            """,
            (start, end),
        ).fetchall()
        invoices = [_row_to_invoice(row) for row in rows]
        return {
            "month": start[:7],
            "invoices": invoices,
            "totals": {
                "amount_usd": round(sum(item["amount_usd"] or 0 for item in invoices), 2),
                "amount_inr": round(sum(item["amount_inr"] or 0 for item in invoices), 2),
            },
        }
    finally:
        conn.close()


def save_invoice(payload: dict[str, Any]) -> dict[str, Any]:
    draft_id = str(payload.get("draft_id") or "")
    draft_path = _draft_path(draft_id)
    if not draft_path.exists():
        raise LookupError("Invoice draft was not found. Upload the PDF again.")

    invoice_no = _normalize_optional_text(payload.get("invoice_no"))
    invoice_date = _validate_date(payload.get("invoice_date"))
    invoice_from = _normalize_text(payload.get("invoice_from"), "Invoice from")
    amount_usd = _normalize_amount(payload.get("amount_usd"))
    amount_inr = _normalize_amount(payload.get("amount_inr"))
    if amount_usd is None and amount_inr is None:
        raise ValueError("Enter either a USD or INR invoice amount.")
    if amount_usd is not None and amount_inr is not None:
        raise ValueError("Save either USD or INR amount, not both.")
    if amount_usd is not None and not payload.get("usd_only_confirmed"):
        raise ValueError("Confirm once that INR is missing before saving a USD-only invoice.")

    original_filename = _validate_pdf_filename(str(payload.get("original_filename") or draft_path.name))
    archived_file = archive_invoice_locally(draft_path, original_filename, invoice_date, invoice_from, invoice_no)
    now = _now()
    raw_json = payload.get("extraction_raw_json")
    if not isinstance(raw_json, dict):
        raw_json = {}

    conn = _connect()
    try:
        cursor = conn.execute(
            """
            INSERT INTO reimbursement_invoices (
                invoice_no,
                invoice_date,
                invoice_from,
                amount_usd,
                amount_inr,
                original_filename,
                invoice_file_path,
                invoice_file_url,
                extraction_model,
                extraction_raw_json,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                invoice_no,
                invoice_date,
                invoice_from,
                amount_usd,
                amount_inr,
                original_filename,
                archived_file["path"],
                archived_file.get("url"),
                payload.get("extraction_model"),
                json.dumps(raw_json, sort_keys=True),
                now,
                now,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM reimbursement_invoices WHERE id = ?",
            (int(cursor.lastrowid),),
        ).fetchone()
        assert row is not None
        return _row_to_invoice(row)
    finally:
        conn.close()
        draft_path.unlink(missing_ok=True)


def _safe_file_part(value: str | None, fallback: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9._ -]+", "", value or "").strip()
    clean = re.sub(r"\s+", " ", clean)
    return clean[:80] or fallback


def archive_invoice_locally(
    pdf_path: str | Path,
    original_filename: str,
    invoice_date: str,
    invoice_from: str,
    invoice_no: str | None,
) -> dict[str, Any]:
    archive_month_dir = project_path(ARCHIVE_DIR) / invoice_date[:7]
    archive_month_dir.mkdir(parents=True, exist_ok=True)
    safe_vendor = _safe_file_part(invoice_from, "invoice")
    safe_no = _safe_file_part(invoice_no, "")
    name_parts = [invoice_date, safe_vendor]
    if safe_no:
        name_parts.append(safe_no)
    archive_name = " - ".join(name_parts) + ".pdf"
    destination = archive_month_dir / archive_name
    counter = 2
    while destination.exists():
        destination = archive_month_dir / f"{destination.stem} ({counter}).pdf"
        counter += 1
    shutil.copyfile(pdf_path, destination)
    relative_path = destination.relative_to(project_path(".")).as_posix()
    return {"path": relative_path, "url": f"/api/invoices/files/{relative_path}"}


def discard_invoice_draft(draft_id: str) -> None:
    path = _draft_path(draft_id)
    if path.exists():
        path.unlink()


def copy_to_draft(source: Path, filename: str) -> dict[str, Any]:
    clean_filename = _validate_pdf_filename(filename)
    draft_id = str(uuid4())
    path = _draft_path(draft_id)
    shutil.copyfile(source, path)
    return {"draft_id": draft_id, "original_filename": clean_filename}
