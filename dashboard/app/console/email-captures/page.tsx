import { EmailCaptureManager } from "@/components/EmailCaptureManager";
import { PageIntro } from "@/components/console/PageIntro";

export default function ConsoleEmailCapturesPage() {
  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Email"
        title="Inbound Todo Log"
        description="Review forwarded emails, created todos, duplicates, and the evidence linking one to the other."
      />
      <EmailCaptureManager />
    </div>
  );
}
