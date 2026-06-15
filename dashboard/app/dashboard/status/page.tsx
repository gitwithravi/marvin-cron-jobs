import { StatusPages } from "@/components/StatusPages";

export default function StatusPage() {
  const raw = process.env.PUBLIC_STATUS_PAGES || "";
  const urls = raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Status</p>
          <h1>Public Status Pages</h1>
          <p className="muted">Live status dashboards for monitored services.</p>
        </div>
      </header>
      <StatusPages urls={urls} />
    </div>
  );
}
