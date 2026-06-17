import { Panel } from "@/components/ui/Panel";
import { type Invoice } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";

type InvoiceTotalsProps = {
  invoices: Invoice[];
};

export function InvoiceTotals({ invoices }: InvoiceTotalsProps) {
  const totalUsd = invoices.reduce((sum, inv) => sum + (inv.amount_usd || 0), 0);
  const totalInr = invoices.reduce((sum, inv) => sum + (inv.amount_inr || 0), 0);

  return (
    <Panel style={{ background: "var(--surface-2)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--spacing)" }}>
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
            TOTAL INVOICES
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>{invoices.length}</p>
        </div>
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
            TOTAL USD
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>{formatCurrency(totalUsd, "USD")}</p>
        </div>
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
            TOTAL INR
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>{formatCurrency(totalInr, "INR")}</p>
        </div>
      </div>
    </Panel>
  );
}
