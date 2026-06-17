import { ApprovalsManager } from "@/components/ApprovalsManager";

export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Approvals</p>
          <h1>Approval Queue</h1>
          <p className="muted">Review pending operational drafts, approve or reject them, and inspect prior decisions from one place.</p>
        </div>
      </header>
      <ApprovalsManager />
    </div>
  );
}
