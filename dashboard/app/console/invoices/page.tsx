import { PageIntro } from "@/components/console/PageIntro";
import { InvoiceManager } from "@/components/invoices/InvoiceManager";

export default function ConsoleInvoicesPage() {
  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Invoices"
        title="Reimbursement Tracker"
        description="Upload invoices, confirm extracted fields, and keep reimbursement evidence complete before finance starts asking questions."
      />
      <InvoiceManager />
    </div>
  );
}
