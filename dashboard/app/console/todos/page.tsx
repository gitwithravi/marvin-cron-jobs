import { TodoManager } from "@/components/TodoManager";
import { PageIntro } from "@/components/console/PageIntro";

export default function ConsoleTodosPage() {
  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Todos"
        title="Task Memory"
        description="Capture work, move it through triage, and keep waiting-on-human debt visible instead of buried."
      />
      <TodoManager />
    </div>
  );
}
