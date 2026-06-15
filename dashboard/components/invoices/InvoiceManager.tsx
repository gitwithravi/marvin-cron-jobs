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
      <section className="invoice-panel">
        <div className="invoice-panel-header">
          <div>
            <p className="eyebrow">Upload</p>
            <h2>Add invoice</h2>
          </div>
        </div>
        <form className="invoice-upload" onSubmit={extractInvoice}>
          <label>
            Invoice PDF
            <input accept="application/pdf" name="invoice" required type="file" />
          </label>
          <button className="button primary" disabled={isExtracting} type="submit">
            {isExtracting ? "Extracting..." : "Upload and extract"}
          </button>
        </form>
        {error ? <p className="error-banner">{error}</p> : null}
      </section>

      {draft ? (
        <section className="invoice-panel">
          <div className="invoice-panel-header">
            <div>
              <p className="eyebrow">Confirm</p>
              <h2>Extracted data</h2>
              <p className="muted">
                {draft.original_filename} · {confidenceLabel(draft.confidence)} confidence
              </p>
            </div>
            {draft.currency_detected ? <span className="invoice-chip">{draft.currency_detected}</span> : null}
          </div>

          {draft.warnings.length > 0 ? (
            <div className="invoice-warning">
              {draft.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {draft.duplicates.length > 0 ? (
            <div className="invoice-warning">
              <p>Possible duplicate found for this invoice number and vendor.</p>
            </div>
          ) : null}

          <form className="invoice-confirm-grid" onSubmit={saveInvoice}>
            <label>
              Inv. No
              <input value={draft.invoice_no || ""} onChange={(event) => updateDraft("invoice_no", event.target.value)} />
            </label>
            <label>
              Date
              <input
                required
                type="date"
                value={draft.invoice_date || ""}
                onChange={(event) => updateDraft("invoice_date", event.target.value)}
              />
            </label>
            <label>
              Invoice from
              <input
                required
                value={draft.invoice_from || ""}
                onChange={(event) => updateDraft("invoice_from", event.target.value)}
              />
            </label>
            <label>
              Amount USD
              <input
                min="0"
                step="0.01"
                type="number"
                value={draft.amount_usd ?? ""}
                onChange={(event) => updateDraft("amount_usd", event.target.value)}
              />
            </label>
            <label>
              Amount INR
              <input
                min="0"
                step="0.01"
                type="number"
                value={draft.amount_inr ?? ""}
                onChange={(event) => updateDraft("amount_inr", event.target.value)}
              />
            </label>
            {needsUsdOnlyConfirmation ? (
              <label className="invoice-check">
                <input
                  checked={usdOnlyConfirmed}
                  onChange={(event) => setUsdOnlyConfirmed(event.target.checked)}
                  type="checkbox"
                />
                Save as USD-only with INR missing
              </label>
            ) : null}
            <div className="invoice-actions">
              <button
                className="button primary"
                disabled={isSaving || (needsUsdOnlyConfirmation && !usdOnlyConfirmed)}
                type="submit"
              >
                {isSaving ? "Saving..." : "Confirm and save"}
              </button>
              <button className="button" onClick={() => setDraft(null)} type="button">
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="invoice-panel">
        <div className="invoice-panel-header">
          <div>
            <p className="eyebrow">Month</p>
            <h2>Saved invoices</h2>
          </div>
          <label className="invoice-month">
            <span>Filter</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonth())} />
          </label>
        </div>
        <div className="invoice-total-grid">
          <div>
            <span>{formatCurrency(data?.totals.amount_inr ?? 0, "INR")}</span>
            <p>INR total</p>
          </div>
          <div>
            <span>{formatCurrency(data?.totals.amount_usd ?? 0, "USD")}</span>
            <p>USD total</p>
          </div>
          <div>
            <span>{data?.invoices.length ?? 0}</span>
            <p>Invoices</p>
          </div>
        </div>

        {isLoading ? (
          <div className="invoice-empty">Loading invoices...</div>
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
                    <td>{invoice.invoice_date}</td>
                    <td>{invoice.invoice_no || "-"}</td>
                    <td>{invoice.invoice_from}</td>
                    <td>{formatCurrency(invoice.amount_usd, "USD")}</td>
                    <td>{formatCurrency(invoice.amount_inr, "INR")}</td>
                    <td>
                      {invoice.invoice_file_url ? (
                        <a href={invoice.invoice_file_url} rel="noreferrer" target="_blank">
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
          <div className="invoice-empty">No invoices saved for {month}.</div>
        )}
      </section>
    </div>
  );
}
