import { ApprovalsManager } from "@/components/ApprovalsManager";
import { PageIntro } from "@/components/console/PageIntro";

export const dynamic = "force-dynamic";

export default function ConsoleApprovalsPage() {
  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Approvals"
        title="Approval Queue"
        description="Review pending operational drafts, inspect the evidence, and approve only what should cross the boundary into the real world."
      />
      <ApprovalsManager />
    </div>
  );
}
