from pathlib import Path
from uuid import uuid4

import pytest

from marvin_core import invoices


def use_tmp_invoice_storage(monkeypatch, tmp_path):
    db_path = tmp_path / "marvin.sqlite3"
    upload_dir = tmp_path / "invoice_uploads" / "tmp"
    monkeypatch.setattr(invoices, "DATABASE_PATH", db_path)
    monkeypatch.setattr(invoices, "UPLOAD_DIR", upload_dir)
    return db_path, upload_dir


def make_draft(upload_dir: Path) -> str:
    draft_id = str(uuid4())
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / f"{draft_id}.pdf").write_bytes(b"%PDF-1.4")
    return draft_id


def test_create_invoice_draft_extracts_pdf_and_flags_usd_only(monkeypatch, tmp_path):
    use_tmp_invoice_storage(monkeypatch, tmp_path)
    monkeypatch.setattr(
        invoices,
        "extract_invoice_from_pdf",
        lambda path, filename: {
            "invoice_no": "INV-100",
            "invoice_date": "2026-06-10",
            "invoice_from": "Acme Inc",
            "amount_usd": 25.50,
            "amount_inr": None,
            "currency_detected": "USD",
            "confidence": 0.91,
            "warnings": [],
            "extraction_model": "test-model",
            "extraction_raw_json": {"ok": True},
        },
    )

    draft = invoices.create_invoice_draft(b"%PDF-1.4", "invoice.pdf")

    assert draft["draft_id"]
    assert draft["amount_usd"] == 25.50
    assert draft["amount_inr"] is None
    assert "INR amount is missing" in draft["warnings"][0]


def test_save_invoice_requires_usd_only_confirmation(monkeypatch, tmp_path):
    _db_path, upload_dir = use_tmp_invoice_storage(monkeypatch, tmp_path)
    draft_id = make_draft(upload_dir)
    payload = {
        "draft_id": draft_id,
        "invoice_no": "INV-101",
        "invoice_date": "2026-06-11",
        "invoice_from": "Acme Inc",
        "amount_usd": 18.0,
        "amount_inr": None,
        "original_filename": "invoice.pdf",
        "extraction_raw_json": {},
    }

    with pytest.raises(ValueError, match="Confirm once"):
        invoices.save_invoice(payload)


def test_save_invoice_persists_inr_only_and_archive_metadata(monkeypatch, tmp_path):
    _db_path, upload_dir = use_tmp_invoice_storage(monkeypatch, tmp_path)
    monkeypatch.setattr(
        invoices,
        "archive_invoice_locally",
        lambda *args: {"path": "data/invoices/2026-06/example.pdf", "url": "/api/invoices/files/data/invoices/2026-06/example.pdf"},
    )
    draft_id = make_draft(upload_dir)

    saved = invoices.save_invoice(
        {
            "draft_id": draft_id,
            "invoice_no": "INV-102",
            "invoice_date": "2026-06-12",
            "invoice_from": "Local Vendor",
            "amount_usd": None,
            "amount_inr": 999.25,
            "original_filename": "invoice.pdf",
            "extraction_model": "test-model",
            "extraction_raw_json": {"invoice_no": "INV-102"},
        }
    )

    assert saved["amount_usd"] is None
    assert saved["amount_inr"] == 999.25
    assert saved["invoice_file_path"] == "data/invoices/2026-06/example.pdf"
    assert saved["invoice_file_url"] == "/api/invoices/files/data/invoices/2026-06/example.pdf"
    assert not Path(tmp_path / "invoice_uploads" / "tmp" / f"{draft_id}.pdf").exists()


def test_list_invoices_filters_by_month_and_keeps_currency_totals(monkeypatch, tmp_path):
    _db_path, upload_dir = use_tmp_invoice_storage(monkeypatch, tmp_path)
    monkeypatch.setattr(
        invoices,
        "archive_invoice_locally",
        lambda *args: {"path": "data/invoices/2026-06/example.pdf", "url": "/api/invoices/files/data/invoices/2026-06/example.pdf"},
    )

    june_id = make_draft(upload_dir)
    invoices.save_invoice(
        {
            "draft_id": june_id,
            "invoice_no": "JUNE-1",
            "invoice_date": "2026-06-12",
            "invoice_from": "June Vendor",
            "amount_usd": None,
            "amount_inr": 1000,
            "original_filename": "june.pdf",
            "extraction_raw_json": {},
        }
    )
    july_id = make_draft(upload_dir)
    invoices.save_invoice(
        {
            "draft_id": july_id,
            "invoice_no": "JULY-1",
            "invoice_date": "2026-07-01",
            "invoice_from": "July Vendor",
            "amount_usd": 12.5,
            "amount_inr": None,
            "usd_only_confirmed": True,
            "original_filename": "july.pdf",
            "extraction_raw_json": {},
        }
    )

    listed = invoices.list_invoices("2026-06")

    assert [item["invoice_no"] for item in listed["invoices"]] == ["JUNE-1"]
    assert listed["totals"] == {"amount_usd": 0, "amount_inr": 1000.0}


def test_archive_invoice_locally_copies_pdf(monkeypatch, tmp_path):
    monkeypatch.setattr(invoices, "ARCHIVE_DIR", f"data/test_invoices_{uuid4()}")
    source = tmp_path / "draft.pdf"
    source.write_bytes(b"%PDF-1.4")

    archived = invoices.archive_invoice_locally(
        source,
        "draft.pdf",
        "2026-06-15",
        "Example Vendor",
        "INV-1",
    )

    archived_path = Path.cwd() / archived["path"]
    assert archived["path"].endswith("2026-06/2026-06-15 - Example Vendor - INV-1.pdf")
    assert archived["url"].startswith("/api/invoices/files/")
    assert archived_path.read_bytes() == b"%PDF-1.4"
