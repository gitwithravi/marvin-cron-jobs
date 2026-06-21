import { PageHeader } from "@/components/shared/page-header";
import { BeszelOverview } from "@/features/beszel/beszel-overview";

export default function ConsoleBeszelPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Infrastructure"
        title="Beszel live status"
        description="System posture, container health, and live alerts without pretending that every server metric deserves a chart."
      />
      <BeszelOverview />
    </div>
  );
}
