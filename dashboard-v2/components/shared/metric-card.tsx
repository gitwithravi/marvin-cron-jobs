import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <div className="text-3xl font-medium tracking-tight">{value}</div>
        {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
