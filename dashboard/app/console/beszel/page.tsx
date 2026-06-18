import { BeszelOverview } from "@/components/BeszelOverview";
import { PageIntro } from "@/components/console/PageIntro";

export default function ConsoleBeszelPage() {
  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Infrastructure"
        title="Beszel Infrastructure"
        description="Live server status first, evidence second, historical detail after that."
      />
      <BeszelOverview />
    </div>
  );
}
