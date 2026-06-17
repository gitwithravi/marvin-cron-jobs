import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { type Invoice } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/time";
import { ExternalLink } from "lucide-react";

type InvoiceTableProps = {
  invoices: Invoice[];
};

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No invoices for this month"
          message="The spreadsheet remains hungry."
        />
      </Panel>
    );
  }

  return (
    <Panel style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Vendor
            </th>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Invoice #
            </th>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Date
            </th>
            <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              USD
            </th>
            <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              INR
            </th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              File
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "12px 16px", fontSize: "0.9rem" }}>
                {invoice.vendor || "—"}
              </td>
              <td style={{ padding: "12px 16px", fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}>
                {invoice.invoice_number || "—"}
              </td>
              <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {invoice.invoice_date ? formatDate(invoice.invoice_date) : "—"}
              </td>
              <td style={{ padding: "12px 16px", fontSize: "0.85rem", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                {invoice.amount_usd !== null ? formatCurrency(invoice.amount_usd, "USD") : "—"}
              </td>
              <td style={{ padding: "12px 16px", fontSize: "0.85rem", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                {invoice.amount_inr !== null ? formatCurrency(invoice.amount_inr, "INR") : "—"}
              </td>
              <td style={{ padding: "12px 16px", textAlign: "center" }}>
                <a
                  href={`/api/invoices/files/data/invoices/${invoice.month}/${invoice.filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "none" }}
                >
                  <ExternalLink size={16} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
