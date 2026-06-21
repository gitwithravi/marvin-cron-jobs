import { PageHeader } from "@/components/shared/page-header";
import { TeamStatusBoard } from "@/features/team-status/team-status-board";

export default function ConsoleTeamStatusPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Humans"
        title="Team status board"
        description="People remain part of the system, regrettably. This page tracks their current task posture without turning it into office theater."
      />
      <TeamStatusBoard />
    </div>
  );
}
