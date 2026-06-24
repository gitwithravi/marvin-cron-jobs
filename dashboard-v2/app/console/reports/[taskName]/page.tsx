import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getReportDetail } from "@/lib/server/tasks";
import { marvinCopy } from "@/lib/marvin-copy";
import { ReportDetailClient } from "@/features/reports/report-detail-client";
import { ReportRunSelector } from "@/features/reports/report-run-selector";

type Props = {
  params: Promise<{ taskName: string }>;
  searchParams: Promise<{ report?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ReportTaskPage({ params, searchParams }: Props) {
  const { taskName } = await params;
  const { report } = await searchParams;
  const detail = await getReportDetail(decodeURIComponent(taskName), report);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title={detail.task.displayName}
        description="Conclusions first, evidence available immediately below, and raw facts never far away."
        actions={
          detail.task.reports.length > 0 ? (
            <ReportRunSelector
              taskName={detail.task.taskName}
              reports={detail.task.reports.slice(0, 1)}
              selectedFileName={detail.selectedReport?.fileName || null}
              triggerLabel="Latest run"
            />
          ) : undefined
        }
      />
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        {detail.task.reports.length > 0 ? (
          <ReportRunSelector
            taskName={detail.task.taskName}
            reports={detail.task.reports.slice(0, 10)}
            selectedFileName={detail.selectedReport?.fileName || null}
          />
        ) : (
          <div className="hidden xl:block">
            <EmptyState title="No reports." description={marvinCopy.noTaskReports} />
          </div>
        )}
        <div>
          {detail.run ? (
            <ReportDetailClient run={detail.run} />
          ) : (
            <EmptyState
              title="No report selected"
              description={marvinCopy.noReportSelected}
            />
          )}
        </div>
      </div>
    </div>
  );
}
