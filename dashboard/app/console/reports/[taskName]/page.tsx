import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportDetailView } from "@/components/ReportDetailView";
import { ReportList } from "@/components/ReportList";
import { getReportDetail } from "@/lib/tasks";
import { consoleRoutes } from "@/lib/console/routes";

export const dynamic = "force-dynamic";

type TaskReportPageProps = {
  params: Promise<{ taskName: string }>;
  searchParams: Promise<{ report?: string }>;
};

export default async function ConsoleTaskReportPage({
  params,
  searchParams
}: TaskReportPageProps) {
  const { taskName } = await params;
  const { report } = await searchParams;
  const detail = await getReportDetail(decodeURIComponent(taskName), report);

  if (!detail) {
    notFound();
  }

  return (
    <div className="report-layout console-report-layout">
      <aside className="report-sidebar console-report-sidebar">
        <Link href={consoleRoutes.reports} className="back-link">
          Reports
        </Link>
        <div>
          <p className="console-eyebrow">Task</p>
          <h1>{detail.task.displayName}</h1>
          <p className="console-page-copy">{detail.task.taskName}</p>
        </div>
        <ReportList
          reports={detail.task.reports}
          selectedFileName={detail.selectedReport?.fileName ?? null}
        />
      </aside>
      <section className="report-content">
        {detail.run && detail.selectedReport ? (
          <ReportDetailView run={detail.run} />
        ) : (
          <section className="console-empty-state">
            <h2>No runs found.</h2>
            <p>This task has not recorded any execution runs yet.</p>
          </section>
        )}
      </section>
    </div>
  );
}
