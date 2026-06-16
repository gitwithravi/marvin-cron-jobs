import { SupportRagManager } from "@/components/SupportRagManager";

export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Support</p>
          <h1>Ticket reply suggestions</h1>
          <p className="muted">Generate, review, edit, and send Vityarthi support replies from historical ticket patterns.</p>
        </div>
      </header>
      <SupportRagManager />
    </div>
  );
}
