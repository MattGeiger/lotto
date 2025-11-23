import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]",
        muted:
          "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)]",
        destructive:
          "border-[var(--color-destructive-border)] bg-[var(--color-destructive-soft)] text-[var(--color-destructive)]",
        success:
          "border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);

export { Badge, badgeVariants };
