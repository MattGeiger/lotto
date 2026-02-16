import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button as ShadcnButton } from "@/components/ui/button";

const arcadeButtonVariants = cva("", {
  variants: {
    font: {
      normal: "",
      retro: "arcade-retro",
    },
    variant: {
      default:
        "bg-[var(--arcade-action-bg)] text-[var(--arcade-action-text)] hover:bg-[var(--arcade-action-hover)] hover:text-[var(--arcade-action-text)]",
      destructive:
        "bg-[color:#ff6b6b] text-black hover:bg-[color:#ff9292] hover:text-black",
      outline:
        "bg-transparent text-[var(--arcade-dot)] ring-2 ring-[var(--arcade-wall)] hover:bg-[var(--arcade-wall)]/20",
      secondary:
        "bg-[var(--arcade-ghost)] text-[var(--arcade-ghost-contrast)] hover:bg-[var(--arcade-action-bg)] hover:text-[var(--arcade-action-text)]",
      ghost:
        "bg-transparent text-[var(--arcade-text)] hover:bg-[var(--arcade-wall)]/25 hover:text-[var(--arcade-text)]",
      link: "bg-transparent text-[var(--arcade-dot)] underline underline-offset-4",
    },
    size: {
      default: "h-11 px-4 py-2 text-xl",
      sm: "h-9 px-3 py-1.5 text-sm",
      lg: "h-12 px-6 py-2.5 text-2xl",
      icon: "size-11 p-0",
    },
  },
  defaultVariants: {
    font: "retro",
    variant: "default",
    size: "default",
  },
});

type ArcadeButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof arcadeButtonVariants> & {
    asChild?: boolean;
  };

function PixelFrame({
  showShadows,
  className,
}: {
  showShadows: boolean;
  className?: string;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -top-1 left-1 h-1 w-[calc(50%-2px)] bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -top-1 right-1 h-1 w-[calc(50%-2px)] bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-1 left-1 h-1 w-[calc(50%-2px)] bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-1 right-1 h-1 w-[calc(50%-2px)] bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-0 size-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-0 top-0 size-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 size-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-0 right-0 size-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -left-1 top-1 h-[calc(100%-8px)] w-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-1 top-1 h-[calc(100%-8px)] w-1 bg-foreground dark:bg-ring",
          className,
        )}
      />

      {showShadows ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-foreground/20"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1 h-1 w-3 bg-foreground/20"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-foreground/20"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1 right-0 h-1 w-3 bg-foreground/20"
          />
        </>
      ) : null}
    </>
  );
}

function Button({
  children,
  asChild,
  variant,
  size,
  font,
  className,
  ...props
}: ArcadeButtonProps) {
  const hasFrame = variant !== "ghost" && variant !== "link" && size !== "icon";
  const showShadows = variant !== "outline";

  return (
    <ShadcnButton
      {...props}
      variant={variant}
      size={size}
      asChild={asChild}
      className={cn(
        "relative m-1 rounded-none border-none transition-transform active:translate-y-0.5",
        arcadeButtonVariants({ variant, size, font }),
        className,
      )}
    >
      {asChild ? (
        <span className="relative inline-flex items-center justify-center gap-1.5">
          {children}
          {hasFrame ? <PixelFrame showShadows={showShadows} /> : null}
        </span>
      ) : (
        <>
          {children}
          {hasFrame ? <PixelFrame showShadows={showShadows} /> : null}
        </>
      )}
    </ShadcnButton>
  );
}

export { Button, arcadeButtonVariants };
export type { ArcadeButtonProps };
