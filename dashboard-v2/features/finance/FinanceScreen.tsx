"use client";

import { useFinance } from "@/features/finance/useFinance";
import { InvoiceUpload } from "@/features/finance/InvoiceUpload";
import { InvoiceDraftConfirm } from "@/features/finance/InvoiceDraftConfirm";
import { InvoiceMonthSelector } from "@/features/finance/InvoiceMonthSelector";
import { InvoiceTotals } from "@/features/finance/InvoiceTotals";
import { InvoiceTable } from "@/features/finance/InvoiceTable";
import { Panel } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";

export function FinanceScreen() {
  const {
    invoices,
    selectedMonth,
    extraction,
    loading,
    uploading,
    saving,
    error,
    setSelectedMonth,
    uploadInvoice,
    saveInvoice,
    clearExtraction,
    refresh
  } = useFinance();

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Finance</h1>
        <Panel>
          <LoadingState message="Loading invoices..." />
        </Panel>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Finance</h1>
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={refresh}>
          Refresh
        </Button>
      </div>

      {error && <ErrorState message={error} />}

      <InvoiceUpload onUpload={uploadInvoice} uploading={uploading} />

      {extraction && (
        <InvoiceDraftConfirm
          extraction={extraction}
          onSave={saveInvoice}
          onCancel={clearExtraction}
          saving={saving}
        />
      )}

      <InvoiceMonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />

      <InvoiceTotals invoices={invoices} />

      <InvoiceTable invoices={invoices} />
    </div>
  );
}
