import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getReportDetail } from "@/lib/server/tasks";
import { marvinCopy } from "@/lib/marvin-copy";
import { formatDateTime, timeAgo } from "@/lib/utils/format";
import { ReportDetailClient } from "@/features/reports/report-detail-client";

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
      />
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardContent className="p-3">
            <div className="space-y-2">
              {detail.task.reports.length > 0 ? (
                detail.task.reports.map((item) => {
                  const isSelected = item.fileName === detail.selectedReport?.fileName;
                  return (
                    <Link
                      key={item.fileName}
                      href={`/console/reports/${encodeURIComponent(detail.task.taskName)}?report=${item.fileName}`}
                      className={`block rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/60 bg-black/10 hover:border-primary/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{item.isLatest ? "Latest" : item.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(item.modifiedAt)}
                          </p>
                        </div>
                        <StatusBadge value={item.riskLevel || item.status} />
                      </div>
                      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {timeAgo(item.modifiedAt)}
                      </p>
                    </Link>
                  );
                })
              ) : (
                <EmptyState title="No reports." description={marvinCopy.noTaskReports} />
              )}
            </div>
          </CardContent>
        </Card>
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
