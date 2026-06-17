"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { DataList } from "@/components/ui/DataList";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { type InvoiceExtraction } from "@/lib/api/types";
import { type Invoice } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/time";
import { AlertTriangle, Check, X } from "lucide-react";

type InvoiceDraftConfirmProps = {
  extraction: InvoiceExtraction;
  onSave: (invoice: Partial<Invoice>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
};

export function InvoiceDraftConfirm({ extraction, onSave, onCancel, saving }: InvoiceDraftConfirmProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [usdConfirmed, setUsdConfirmed] = useState(false);

  const requiresUsdConfirmation = extraction.currency_detected === "USD" && extraction.amount_usd !== null;

  const handleSave = async () => {
    await onSave({
      filename: extraction.filename,
      vendor: extraction.vendor,
      invoice_number: extraction.invoice_number,
      invoice_date: extraction.invoice_date,
      amount_usd: extraction.amount_usd,
      amount_inr: extraction.amount_inr,
      currency_detected: extraction.currency_detected
    });
  };

  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Extracted Invoice Data</h3>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "4px 8px",
              background: extraction.confidence === "high" ? "var(--healthy)" : extraction.confidence === "medium" ? "var(--warning)" : "var(--critical)",
              color: "var(--bg)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-mono)",
              fontWeight: 600
            }}
          >
            {extraction.confidence.toUpperCase()}
          </span>
        </div>

        {extraction.is_duplicate && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", padding: "var(--spacing-sm)", background: "rgba(216, 166, 87, 0.1)", border: "1px solid var(--warning)", borderRadius: "var(--radius-sm)" }}>
            <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
            <span style={{ fontSize: "0.85rem", color: "var(--warning)" }}>
              Duplicate detected. Invoice #{extraction.duplicate_invoice_id} has the same invoice number.
            </span>
          </div>
        )}

        <DataList
          items={[
            { label: "Filename", value: extraction.filename },
            { label: "Vendor", value: extraction.vendor || "—" },
            { label: "Invoice number", value: extraction.invoice_number || "—" },
            { label: "Invoice date", value: extraction.invoice_date ? formatDate(extraction.invoice_date) : "—" },
            { label: "Currency", value: extraction.currency_detected || "—" },
            { label: "Amount USD", value: extraction.amount_usd !== null ? formatCurrency(extraction.amount_usd, "USD") : "—" },
            { label: "Amount INR", value: extraction.amount_inr !== null ? formatCurrency(extraction.amount_inr, "INR") : "—" }
          ]}
        />

        {requiresUsdConfirmation && (
          <label style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", fontSize: "0.85rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={usdConfirmed}
              onChange={(e) => setUsdConfirmed(e.target.checked)}
              style={{ width: "16px", height: "16px" }}
            />
            I confirm the USD amount is correct
          </label>
        )}

        <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
          <Button
            variant="primary"
            icon={<Check size={16} />}
            onClick={() => setShowConfirmDialog(true)}
            disabled={saving || (requiresUsdConfirmation && !usdConfirmed)}
          >
            Save invoice
          </Button>
          <Button
            variant="secondary"
            icon={<X size={16} />}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirmDialog}
        title="Save this invoice?"
        message={`You are saving invoice ${extraction.invoice_number || extraction.filename} from ${extraction.vendor || "unknown vendor"}.`}
        confirmLabel="Save"
        variant="primary"
        onConfirm={handleSave}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </Panel>
  );
}
