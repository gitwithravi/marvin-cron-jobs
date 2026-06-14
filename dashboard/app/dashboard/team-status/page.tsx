import { TeamStatusBoard } from "@/components/TeamStatusBoard";

export default function TeamStatusPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Team Status</p>
          <h1>Team Status</h1>
          <p className="muted">Live member task lists grouped by date.</p>
        </div>
      </header>
      <TeamStatusBoard />
    </div>
  );
}
