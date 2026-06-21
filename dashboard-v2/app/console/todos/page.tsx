import { PageHeader } from "@/components/shared/page-header";
import { TodoManager } from "@/features/todos/todo-manager";

export default function ConsoleTodosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Todos"
        title="Operational todo board"
        description="A slimmer v2 board that keeps the core workflow intact: create, triage, move, and close work without the page fighting back."
      />
      <TodoManager />
    </div>
  );
}
