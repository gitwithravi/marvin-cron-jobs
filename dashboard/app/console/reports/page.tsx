import { TaskCard } from "@/components/TaskCard";
import { PageIntro } from "@/components/console/PageIntro";
import { marvinCopy } from "@/lib/marvin-copy";
import { getTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function ConsoleReportsPage() {
  const tasks = await getTasks();

  return (
    <div className="console-page-stack">
      <PageIntro
        eyebrow="Reports"
        title="Task Reports"
        description={marvinCopy.reportsSummary}
      />
      {tasks.length > 0 ? (
        <div className="task-grid">
          {tasks.map((task) => (
            <TaskCard key={task.taskName} task={task} />
          ))}
        </div>
      ) : (
        <section className="console-empty-state">
          <h2>No tasks discovered.</h2>
          <p>{marvinCopy.reportsEmpty}</p>
        </section>
      )}
    </div>
  );
}
