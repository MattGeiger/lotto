import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] shadow-sm outline-none ring-[color-mix(in srgb,var(--color-focus) 40%, transparent)] transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[color-mix(in srgb,var(--color-focus) 40%, transparent)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
