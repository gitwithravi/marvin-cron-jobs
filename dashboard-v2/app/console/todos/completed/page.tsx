import { PageHeader } from "@/components/shared/page-header";
import { CompletedTodos } from "@/features/todos/completed-todos";

export default function ConsoleCompletedTodosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Todos"
        title="Completed tasks"
        description="Archived operational work, separated from the active board so the living queue remains readable."
      />
      <CompletedTodos />
    </div>
  );
}
