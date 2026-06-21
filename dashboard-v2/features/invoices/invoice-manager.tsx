"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Invoice = {
  id: number;
  invoice_no: string | null;
  invoice_date: string;
  invoice_from: string;
  amount_usd: number | null;
  amount_inr: number | null;
  original_filename: string;
  invoice_file_url: string | null;
};

type InvoiceDraft = {
  draft_id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  invoice_from: string | null;
  amount_usd: number | null;
  amount_inr: number | null;
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
  if (value === null || value === undefined) {
    return "-";
  }
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IN", {
    currency,
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    refresh(month);
  }, [month, refresh]);

  const needsUsdOnlyConfirmation = useMemo(
    () => draft?.amount_usd !== null && draft?.amount_usd !== undefined && !draft?.amount_inr,
    [draft]
  );

  async function extractInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("invoice") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      return;
    }

    setIsExtracting(true);
    setError("");
    setDraft(null);
    setUsdOnlyConfirmed(false);
    try {
      const body = new FormData();
      body.set("file", file);
      const payload = await fetch("/api/invoices/extract", { method: "POST", body }).then(readJson);
      setDraft(payload.draft);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsExtracting(false);
    }
  }

  function updateDraft(field: keyof InvoiceDraft, value: string) {
    if (!draft) {
      return;
    }
    if (field === "amount_usd" || field === "amount_inr") {
      setDraft({ ...draft, [field]: value === "" ? null : Number(value) });
      return;
    }
    setDraft({ ...draft, [field]: value || null });
  }

  async function saveInvoice(event: FormEvent) {
    event.preventDefault();
    if (!draft) {
      return;
    }
    setIsSaving(true);
    setError("");
    try {
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
      }).then(readJson);
      setDraft(null);
      setUsdOnlyConfirmed(false);
      await refresh(month);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Add invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={extractInvoice} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice">PDF invoice</Label>
                <Input id="invoice" name="invoice" accept="application/pdf" type="file" required />
              </div>
              <Button type="submit" disabled={isExtracting} className="w-full">
                {isExtracting ? "Extracting..." : "Upload and extract"}
              </Button>
            </form>
            {error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Label htmlFor="month">Month</Label>
                <Input id="month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">USD total</p>
                  <p className="text-lg font-medium">{formatCurrency(data?.totals.amount_usd ?? 0, "USD")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">INR total</p>
                  <p className="text-lg font-medium">{formatCurrency(data?.totals.amount_inr ?? 0, "INR")}</p>
                </div>
              </div>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading invoices...</p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {(data?.invoices || []).map((invoice) => (
                    <div key={invoice.id} className="rounded-xl border border-border/60 bg-black/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium">{invoice.invoice_from}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{invoice.invoice_date}</p>
                        </div>
                        {invoice.invoice_file_url ? (
                          <a
                            className="text-sm text-primary underline-offset-4 hover:underline"
                            href={invoice.invoice_file_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Invoice</p>
                          <p className="mt-1 break-words text-foreground">{invoice.invoice_no || "-"}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">File</p>
                          <p className="mt-1 break-words text-foreground/90">{invoice.original_filename}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">USD</p>
                          <p className="mt-1 text-foreground">{formatCurrency(invoice.amount_usd, "USD")}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">INR</p>
                          <p className="mt-1 text-foreground">{formatCurrency(invoice.amount_inr, "INR")}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>USD</TableHead>
                        <TableHead>INR</TableHead>
                        <TableHead>File</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.invoices || []).map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>{invoice.invoice_date}</TableCell>
                          <TableCell>{invoice.invoice_from}</TableCell>
                          <TableCell>{invoice.invoice_no || "-"}</TableCell>
                          <TableCell>{formatCurrency(invoice.amount_usd, "USD")}</TableCell>
                          <TableCell>{formatCurrency(invoice.amount_inr, "INR")}</TableCell>
                          <TableCell>
                            {invoice.invoice_file_url ? (
                              <a className="text-primary underline-offset-4 hover:underline" href={invoice.invoice_file_url} target="_blank" rel="noreferrer">
                                View
                              </a>
                            ) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>Confirm extracted invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveInvoice} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Invoice number</Label>
                <Input value={draft.invoice_no || ""} onChange={(event) => updateDraft("invoice_no", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Invoice date</Label>
                <Input type="date" value={draft.invoice_date || ""} onChange={(event) => updateDraft("invoice_date", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input value={draft.invoice_from || ""} onChange={(event) => updateDraft("invoice_from", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>USD amount</Label>
                <Input type="number" step="0.01" value={draft.amount_usd ?? ""} onChange={(event) => updateDraft("amount_usd", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>INR amount</Label>
                <Input type="number" step="0.01" value={draft.amount_inr ?? ""} onChange={(event) => updateDraft("amount_inr", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Extraction model</Label>
                <Input value={draft.extraction_model || ""} readOnly />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Original file</Label>
                <Input value={draft.original_filename} readOnly />
              </div>
              {draft.warnings.length > 0 ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-200 md:col-span-2">
                  {draft.warnings.join(" ")}
                </div>
              ) : null}
              {needsUsdOnlyConfirmation ? (
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={usdOnlyConfirmed}
                    onChange={(event) => setUsdOnlyConfirmed(event.target.checked)}
                  />
                  Confirm this invoice only has a USD amount.
                </label>
              ) : null}
              <div className="md:col-span-2">
                <Button type="submit" disabled={isSaving || (needsUsdOnlyConfirmation && !usdOnlyConfirmed)}>
                  {isSaving ? "Saving..." : "Save invoice"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
