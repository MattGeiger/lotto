import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:pointer-events-none disabled:opacity-50 [&_a]:text-[inherit] [&_a]:no-underline",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-primary)] !text-[var(--color-primary-foreground)] shadow-md hover:bg-[var(--color-primary-strong)] active:translate-y-0.5",
        secondary:
          "bg-[var(--color-surface-muted)] !text-[var(--color-foreground)] border border-[var(--color-border)] hover:bg-[var(--color-surface)]",
        ghost:
          "!text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-muted)]",
        destructive:
          "bg-[var(--color-destructive)] !text-white hover:bg-[color-mix(in srgb,var(--color-destructive) 85%, black)] focus-visible:ring-[color-mix(in srgb,var(--color-destructive) 70%, transparent)]",
        outline:
          "border border-[var(--color-border)] !text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] shadow-sm",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
