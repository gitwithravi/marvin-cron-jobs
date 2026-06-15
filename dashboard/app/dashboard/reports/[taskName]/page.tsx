import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportList } from "@/components/ReportList";
import { ReportDetailView } from "@/components/ReportDetailView";
import { getReportDetail } from "@/lib/tasks";

export const dynamic = "force-dynamic";

type TaskReportPageProps = {
  params: Promise<{ taskName: string }>;
  searchParams: Promise<{ report?: string }>;
};

export default async function TaskReportPage({
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
    <div className="report-layout">
      <aside className="report-sidebar">
        <Link href="/dashboard/reports" className="back-link">
          Reports
        </Link>
        <div>
          <p className="eyebrow">Task</p>
          <h1>{detail.task.displayName}</h1>
          <p className="muted">{detail.task.taskName}</p>
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
          <section className="empty-state">
            <h2>No runs found</h2>
            <p className="muted">This task has not recorded any execution runs yet.</p>
          </section>
        )}
      </section>
    </div>
  );
}
