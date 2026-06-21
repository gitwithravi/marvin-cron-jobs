import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export function OperationalUnitCard({
  title,
  href,
  status,
  conclusion,
  timestamp,
  evidence
}: {
  title: string;
  href?: string;
  status: string | null | undefined;
  conclusion: string;
  timestamp: string | null;
  evidence?: React.ReactNode;
}) {
  const content = (
    <Card className="h-full transition-colors hover:border-primary/30">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <StatusBadge value={status} />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{conclusion}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Last observed</span>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-foreground/85">
              {timestamp ? timeAgo(timestamp) : "unknown"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{formatDateTime(timestamp)}</div>
        </div>
        {evidence ? <div className="rounded-lg border border-border/60 bg-black/10 p-3 text-sm">{evidence}</div> : null}
        {href ? (
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-primary">
            Open detail
            <ArrowRight className="size-3.5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
