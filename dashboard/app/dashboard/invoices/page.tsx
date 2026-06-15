import { InvoiceManager } from "@/components/invoices/InvoiceManager";

export default function InvoicesPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Invoices</p>
          <h1>Reimbursement Tracker</h1>
          <p className="muted">Upload invoices, confirm extracted fields, and keep monthly claims complete.</p>
        </div>
      </header>
      <InvoiceManager />
    </div>
  );
}
