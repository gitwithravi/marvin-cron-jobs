import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em]",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary",
        secondary: "border-border/70 bg-secondary/80 text-secondary-foreground",
        outline: "border-border/70 bg-transparent text-muted-foreground",
        destructive: "border-destructive/30 bg-destructive/10 text-red-300"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
