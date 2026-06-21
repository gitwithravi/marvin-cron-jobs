import { AlertTriangle, Coins, ShieldCheck } from "lucide-react";
import { MarkdownSurface } from "@/components/shared/markdown-surface";
import { MetricCard } from "@/components/shared/metric-card";
import { OperationalUnitCard } from "@/components/shared/operational-unit-card";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/utils/format";
import type { ConsoleOverviewData } from "@/features/overview/data";

export function OverviewPage({ data }: { data: ConsoleOverviewData }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Console" title="MARVIN Command Center" description={data.headline} />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Pending approvals"
          value={data.pendingApprovals.length}
          detail="Actions waiting for human ceremony before MARVIN proceeds."
        />
        <MetricCard
          label="Primary signals"
          value={data.latestTasks.length}
          detail="Operational units currently closest to your attention budget."
        />
        <MetricCard
          label="Credits remaining"
          value={data.spend ? data.spend.remainingCredits.toFixed(2) : "n/a"}
          detail={
            data.spend
              ? `${data.spend.usagePercent.toFixed(1)}% of OpenRouter credits consumed.`
              : "Model spend signal unavailable."
          }
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="space-y-4">
          <PageHeader
            className="rounded-xl p-5"
            eyebrow="Critical alerts"
            title="Latest attention digest"
            description={
              data.alertUpdatedAt
                ? `Generated ${formatDateTime(data.alertUpdatedAt)}.`
                : "No alert timestamp available."
            }
          />
          <MarkdownSurface markdown={data.alertMessage} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending human decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pendingApprovals.length > 0 ? (
              data.pendingApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-xl border border-border/60 bg-black/10 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {approval.summary_text || `Approval #${approval.id}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        MARVIN paused before taking an external action.
                      </p>
                    </div>
                    <StatusBadge value={approval.status || approval.run?.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="size-3.5" />
                    <span>{approval.kind || "unknown approval type"}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <ShieldCheck className="size-10 text-primary/80" />
                <div>
                  <p className="font-medium text-foreground">No pending approvals.</p>
                  <p className="text-sm">A rare moment of peace. Don&apos;t get attached.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <PageHeader
          className="rounded-xl p-5"
          eyebrow="Latest conclusions"
          title="Operational units that deserve attention"
          description="Conclusion first, evidence second, theatrics never."
        />
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {data.latestTasks.map((task) => (
            <OperationalUnitCard
              key={task.taskName}
              title={task.displayName}
              href={task.href}
              status={task.status}
              conclusion={task.conclusion}
              timestamp={task.lastRun}
              evidence={<p>Reports recorded: <strong>{task.reportCount}</strong></p>}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Everything else MARVIN checked</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {data.secondaryTasks.map((task) => (
              <OperationalUnitCard
                key={task.taskName}
                title={task.displayName}
                href={task.href}
                status={task.status}
                conclusion={task.conclusion}
                timestamp={task.lastRun}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secondary signal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-primary">
              <Coins className="size-5" />
              <span className="font-mono text-xs uppercase tracking-[0.16em]">
                OpenRouter spend
              </span>
            </div>
            {data.spend ? (
              <>
                <div className="text-4xl font-medium tracking-tight">
                  {data.spend.remainingCredits.toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">
                  credits remain. {data.spend.usagePercent.toFixed(1)}% of the current budget is already gone.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Spend signal unavailable. The command center survives without decorative accounting.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
