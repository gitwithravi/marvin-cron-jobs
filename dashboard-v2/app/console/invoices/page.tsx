import { PageHeader } from "@/components/shared/page-header";
import { InvoiceManager } from "@/features/invoices/invoice-manager";

export default function ConsoleInvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Invoices"
        title="Invoice extraction"
        description="Upload, verify, and archive invoice data with the extraction evidence kept close at hand."
      />
      <InvoiceManager />
    </div>
  );
}
