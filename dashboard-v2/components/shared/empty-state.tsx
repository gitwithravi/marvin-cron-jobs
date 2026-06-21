import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  icon,
  className
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
        {icon ? <div className="text-primary/80">{icon}</div> : null}
        <div className="space-y-1">
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
