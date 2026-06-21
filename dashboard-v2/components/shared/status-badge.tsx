import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { normalizeTone, toneLabel } from "@/lib/utils/status";

const toneStyles = {
  healthy: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  critical: "border-red-400/20 bg-red-400/10 text-red-300",
  failed: "border-red-500/25 bg-red-500/12 text-red-200",
  pending: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  running: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  unknown: "border-border/70 bg-secondary/60 text-muted-foreground"
} as const;

export function StatusBadge({
  value,
  className
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const tone = normalizeTone(value);
  return (
    <Badge className={cn("justify-center", toneStyles[tone], className)} variant="outline">
      {toneLabel(tone)}
    </Badge>
  );
}
