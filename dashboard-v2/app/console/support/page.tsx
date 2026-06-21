import { PageHeader } from "@/components/shared/page-header";
import { SupportManager } from "@/features/support/support-manager";

export default function ConsoleSupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Support ticket drafting"
        description="Draft suggestions, retrieval posture, and the approvals queue that keeps MARVIN from freelancing with customer communication."
      />
      <SupportManager />
    </div>
  );
}
