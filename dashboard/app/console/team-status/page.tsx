import { TeamStatusBoard } from "@/components/TeamStatusBoard";
import { PageIntro } from "@/components/console/PageIntro";

export default function ConsoleTeamStatusPage() {
  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Humans"
        title="Team Status"
        description="Who is blocked, what is overdue, and which humans continue to behave like external dependencies."
      />
      <TeamStatusBoard />
    </div>
  );
}
