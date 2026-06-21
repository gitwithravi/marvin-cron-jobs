import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/65 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.12)] backdrop-blur md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary/90">
          {eyebrow}
        </p>
        <div className="space-y-2">
          <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
