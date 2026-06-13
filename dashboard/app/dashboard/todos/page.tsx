import { TodoManager } from "@/components/TodoManager";

export default function TodosPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Todos</p>
          <h1>Task Memory</h1>
          <p className="muted">Capture work, let MARVIN tag it, and keep the list filterable.</p>
        </div>
      </header>
      <TodoManager />
    </div>
  );
}
