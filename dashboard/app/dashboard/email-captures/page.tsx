import { EmailCaptureManager } from "@/components/EmailCaptureManager";

export default function EmailCapturesPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Email capture</p>
          <h1>Inbound Todo Log</h1>
          <p className="muted">Review forwarded emails, created todos, duplicates, and notification delivery.</p>
        </div>
      </header>
      <EmailCaptureManager />
    </div>
  );
}
