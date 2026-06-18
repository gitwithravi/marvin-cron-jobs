import { SupportRagManager } from "@/components/SupportRagManager";
import { PageIntro } from "@/components/console/PageIntro";

export const dynamic = "force-dynamic";

export default function ConsoleSupportPage() {
  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Support"
        title="Ticket Reply Suggestions"
        description="Generate, review, edit, and send support replies with the evidence trail visible before any external action."
      />
      <SupportRagManager />
    </div>
  );
}
