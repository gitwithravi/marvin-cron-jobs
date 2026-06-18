import { StatusPages } from "@/components/StatusPages";
import { PageIntro } from "@/components/console/PageIntro";

export default function ConsoleStatusPage() {
  const raw = process.env.PUBLIC_STATUS_PAGES || "";
  const urls = raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Status"
        title="Public Status Pages"
        description="Reference dashboards for external services. Useful, but secondary to MARVIN&apos;s own conclusions."
      />
      <StatusPages urls={urls} />
    </div>
  );
}
