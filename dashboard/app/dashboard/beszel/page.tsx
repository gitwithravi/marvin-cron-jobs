import { BeszelOverview } from "@/components/BeszelOverview";

export default function BeszelPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Beszel</p>
          <h1>Infrastructure</h1>
          <p className="muted">Live server status, alerts, containers, and short-window resource trends.</p>
        </div>
      </header>
      <BeszelOverview />
    </div>
  );
}
