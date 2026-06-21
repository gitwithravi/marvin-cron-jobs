import { PageHeader } from "@/components/shared/page-header";
import { EmailCaptureManager } from "@/features/email-captures/email-capture-manager";

export default function ConsoleEmailCapturesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Email"
        title="Inbound captures"
        description="Forwarded email intake, ingestion status, and whether a captured message turned into an actionable todo."
      />
      <EmailCaptureManager />
    </div>
  );
}
