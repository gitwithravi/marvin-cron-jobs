import { PageHeader } from "@/components/shared/page-header";
import { ApprovalsManager } from "@/features/approvals/approvals-manager";

export default function ConsoleApprovalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title="Pending human ceremony"
        description="Every external or consequential action stops here for a final human check."
      />
      <ApprovalsManager />
    </div>
  );
}
