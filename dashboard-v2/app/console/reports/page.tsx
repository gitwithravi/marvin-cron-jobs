import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTasks } from "@/lib/server/tasks";
import { marvinCopy } from "@/lib/marvin-copy";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ConsoleReportsPage() {
  const tasks = await getTasks();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reports" title="Task reports" description={marvinCopy.reportsSummary} />
      {tasks.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
            <Link key={task.taskName} href={`/console/reports/${encodeURIComponent(task.taskName)}`}>
              <Card className="h-full transition-colors hover:border-primary/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{task.displayName}</CardTitle>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {task.reportCount} report{task.reportCount === 1 ? "" : "s"} available
                      </p>
                    </div>
                    <StatusBadge value={task.riskLevel} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {task.latestReport ? (
                    <>
                      <div className="text-sm text-foreground/90">
                        Latest report: {formatDateTime(task.latestReport.modifiedAt)}
                      </div>
                      <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {timeAgo(task.latestReport.modifiedAt)}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No runs yet.</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FileText className="size-10" />}
          title="No tasks discovered."
          description={marvinCopy.reportsEmpty}
        />
      )}
    </div>
  );
}
