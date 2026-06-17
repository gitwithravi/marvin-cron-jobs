"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Invoice = {
  id: number;
  invoice_no: string | null;
  invoice_date: string;
  invoice_from: string;
  amount_usd: number | null;
  amount_inr: number | null;
  original_filename: string;
  invoice_file_url: string | null;
  extraction_model: string | null;
  created_at: string;
};

type InvoiceDraft = {
  draft_id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  invoice_from: string | null;
  amount_usd: number | null;
  amount_inr: number | null;
  currency_detected: string | null;
  confidence: number | null;
  warnings: string[];
  duplicates: Invoice[];
  original_filename: string;
  extraction_model: string | null;
  extraction_raw_json: Record<string, unknown>;
};

type InvoiceList = {
  month: string;
  invoices: Invoice[];
  totals: {
    amount_usd: number;
    amount_inr: number;
  };
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

function formatCurrency(value: number | null, currency: "USD" | "INR") {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IN", {
    currency,
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function confidenceLabel(value: number | null) {
  if (typeof value !== "number") return "unknown";
  return `${Math.round(value * 100)}%`;
}

function confidenceClass(value: number | null) {
  if (typeof value !== "number") return "confidence-unknown";
  if (value >= 0.85) return "confidence-high";
  if (value >= 0.6) return "confidence-medium";
  return "confidence-low";
}

export function InvoiceManager() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<InvoiceList | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [usdOnlyConfirmed, setUsdOnlyConfirmed] = useState(false);

  const refresh = useCallback(async (selectedMonth = month) => {
    setError("");
    try {
      const payload = await fetch(`/api/invoices?month=${encodeURIComponent(selectedMonth)}`).then(readJson);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    refresh(month);
  }, [month, refresh]);

  const needsUsdOnlyConfirmation = useMemo(() => {
    return draft?.amount_usd !== null && draft?.amount_usd !== undefined && !draft?.amount_inr;
  }, [draft]);

  async function extractInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("invoice") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError("");
    setDraft(null);
    setUsdOnlyConfirmed(false);
    try {
      const body = new FormData();
      body.set("file", file);
      const payload = await readJson(
        await fetch("/api/invoices/extract", {
          method: "POST",
          body
        })
      );
      setDraft(payload.draft);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExtracting(false);
    }
  }

  function updateDraft(field: keyof InvoiceDraft, value: string) {
    if (!draft) return;
    if (field === "amount_usd" || field === "amount_inr") {
      setDraft({ ...draft, [field]: value === "" ? null : Number(value) });
      if (field === "amount_inr" && value !== "") {
        setUsdOnlyConfirmed(false);
      }
      return;
    }
    setDraft({ ...draft, [field]: value || null });
  }

  async function saveInvoice(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setIsSaving(true);
    setError("");
    try {
      await readJson(
        await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft_id: draft.draft_id,
            invoice_no: draft.invoice_no,
            invoice_date: draft.invoice_date,
            invoice_from: draft.invoice_from,
            amount_usd: draft.amount_usd,
            amount_inr: draft.amount_inr,
            original_filename: draft.original_filename,
            extraction_model: draft.extraction_model,
            extraction_raw_json: draft.extraction_raw_json,
            usd_only_confirmed: usdOnlyConfirmed
          })
        })
      );
      setDraft(null);
      setUsdOnlyConfirmed(false);
      await refresh(month);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="invoice-layout">
      <section className="invoice-panel invoice-upload-panel">
        <div className="invoice-panel-header">
          <div>
            <p className="eyebrow">Upload</p>
            <h2>Add invoice</h2>
          </div>
        </div>
        <form className="invoice-upload-zone" onSubmit={extractInvoice}>
          <div className="invoice-upload-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div className="invoice-upload-text">
              <strong>Drop a PDF here or click to browse</strong>
              <span>Invoice PDFs will be extracted automatically</span>
            </div>
          </div>
          <input accept="application/pdf" name="invoice" required type="file" className="invoice-upload-input" />
          <button className="button primary invoice-upload-btn" disabled={isExtracting} type="submit">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {isExtracting ? "Extracting..." : "Upload and extract"}
          </button>
        </form>
        {error ? <p className="error-banner">{error}</p> : null}
      </section>

      {draft ? (
        <section className="invoice-panel invoice-confirm-panel">
          <div className="invoice-panel-header">
            <div className="invoice-confirm-header-info">
              <div>
                <p className="eyebrow">Confirm</p>
                <h2>Extracted data</h2>
              </div>
              <div className="invoice-confirm-meta">
                <span className="invoice-confirm-filename">{draft.original_filename}</span>
                <span className={`invoice-confidence ${confidenceClass(draft.confidence)}`}>
                  {confidenceLabel(draft.confidence)} confidence
                </span>
                {draft.currency_detected && (
                  <span className="invoice-chip">{draft.currency_detected}</span>
                )}
              </div>
            </div>
          </div>

          {draft.warnings.length > 0 && (
            <div className="invoice-warning">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                {draft.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          )}

          {draft.duplicates.length > 0 && (
            <div className="invoice-warning invoice-warning-duplicate">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <div>
                <p>Possible duplicate found for this invoice number and vendor.</p>
              </div>
            </div>
          )}

          <form className="invoice-confirm-grid" onSubmit={saveInvoice}>
            <label className="invoice-field">
              <span>Invoice No</span>
              <input value={draft.invoice_no || ""} onChange={(event) => updateDraft("invoice_no", event.target.value)} placeholder="INV-001" />
            </label>
            <label className="invoice-field">
              <span>Date</span>
              <input
                required
                type="date"
                value={draft.invoice_date || ""}
                onChange={(event) => updateDraft("invoice_date", event.target.value)}
              />
            </label>
            <label className="invoice-field">
              <span>Invoice from</span>
              <input
                required
                value={draft.invoice_from || ""}
                onChange={(event) => updateDraft("invoice_from", event.target.value)}
                placeholder="Vendor name"
              />
            </label>
            <label className="invoice-field">
              <span>Amount USD</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={draft.amount_usd ?? ""}
                onChange={(event) => updateDraft("amount_usd", event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className="invoice-field">
              <span>Amount INR</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={draft.amount_inr ?? ""}
                onChange={(event) => updateDraft("amount_inr", event.target.value)}
                placeholder="0.00"
              />
            </label>
            {needsUsdOnlyConfirmation && (
              <label className="invoice-check">
                <input
                  checked={usdOnlyConfirmed}
                  onChange={(event) => setUsdOnlyConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>Save as USD-only with INR missing</span>
              </label>
            )}
            <div className="invoice-actions">
              <button
                className="button primary invoice-save-btn"
                disabled={isSaving || (needsUsdOnlyConfirmation && !usdOnlyConfirmed)}
                type="submit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {isSaving ? "Saving..." : "Confirm and save"}
              </button>
              <button className="button" onClick={() => setDraft(null)} type="button">
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="invoice-panel invoice-list-panel">
        <div className="invoice-panel-header">
          <div>
            <p className="eyebrow">Records</p>
            <h2>Saved invoices</h2>
          </div>
          <label className="invoice-month">
            <span>Filter</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonth())} />
          </label>
        </div>

        <div className="invoice-total-grid">
          <div className="invoice-total-card invoice-total-inr">
            <span>{formatCurrency(data?.totals.amount_inr ?? 0, "INR")}</span>
            <p>INR total</p>
          </div>
          <div className="invoice-total-card invoice-total-usd">
            <span>{formatCurrency(data?.totals.amount_usd ?? 0, "USD")}</span>
            <p>USD total</p>
          </div>
          <div className="invoice-total-card invoice-total-count">
            <span>{data?.invoices.length ?? 0}</span>
            <p>Invoices</p>
          </div>
        </div>

        {isLoading ? (
          <div className="invoice-empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p>Loading invoices...</p>
          </div>
        ) : data && data.invoices.length > 0 ? (
          <div className="invoice-table-wrap">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Inv. No</th>
                  <th>From</th>
                  <th>USD</th>
                  <th>INR</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="invoice-cell-date">{invoice.invoice_date}</td>
                    <td className="invoice-cell-mono">{invoice.invoice_no || "-"}</td>
                    <td>{invoice.invoice_from}</td>
                    <td className="invoice-cell-currency">{formatCurrency(invoice.amount_usd, "USD")}</td>
                    <td className="invoice-cell-currency">{formatCurrency(invoice.amount_inr, "INR")}</td>
                    <td>
                      {invoice.invoice_file_url ? (
                        <a href={invoice.invoice_file_url} rel="noreferrer" target="_blank" className="invoice-pdf-link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="invoice-empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p>No invoices saved for {month}.</p>
          </div>
        )}
      </section>
    </div>
  );
}
