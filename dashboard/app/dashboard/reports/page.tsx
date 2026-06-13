import { TaskCard } from "@/components/TaskCard";
import { marvinCopy } from "@/lib/marvin-copy";
import { getTasks } from "@/lib/tasks";

export default async function ReportsPage() {
  const tasks = await getTasks();

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1>Task Reports</h1>
          <p className="muted">{marvinCopy.reportsSummary}</p>
        </div>
      </header>
      {tasks.length > 0 ? (
        <div className="task-grid">
          {tasks.map((task) => (
            <TaskCard key={task.taskName} task={task} />
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <h2>No tasks discovered</h2>
          <p className="muted">{marvinCopy.reportsEmpty}</p>
        </section>
      )}
    </div>
  );
}
