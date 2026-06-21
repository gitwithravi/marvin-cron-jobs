import { PageHeader } from "@/components/shared/page-header";
import { StatusPages } from "@/features/status/status-pages";

export default function ConsoleStatusPage() {
  const raw = process.env.PUBLIC_STATUS_PAGES || "";
  const urls = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Status"
        title="Public status pages"
        description="Reference dashboards for external services. Useful, but secondary to MARVIN's own conclusions."
      />
      <StatusPages urls={urls} />
    </div>
  );
}
