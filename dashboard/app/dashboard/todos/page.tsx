import { TodoManager } from "@/components/TodoManager";

export default function TodosPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Todos</p>
          <h1>Task Memory</h1>
          <p className="muted">Capture work into triage, move it across the board, and chase follow-ups by person.</p>
        </div>
      </header>
      <TodoManager />
    </div>
  );
}
