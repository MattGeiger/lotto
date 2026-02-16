import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Badge as ShadcnBadge } from "@/components/ui/badge";

const arcadeBadgeVariants = cva("", {
  variants: {
    font: {
      normal: "",
      retro: "arcade-retro",
    },
    variant: {
      default: "border-[var(--arcade-dot)] bg-[var(--arcade-dot)] text-black",
      destructive: "border-[#ff6b6b] bg-[#ff6b6b] text-black",
      outline:
        "border-[var(--arcade-wall)] bg-transparent text-[var(--arcade-dot)]",
      secondary: "border-[var(--arcade-ghost)] bg-[var(--arcade-ghost)] text-black",
    },
  },
  defaultVariants: {
    font: "retro",
    variant: "default",
  },
});

type ArcadeBadgeProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof arcadeBadgeVariants> & {
    asChild?: boolean;
  };

function Badge({
  children,
  className,
  font,
  variant,
  ...props
}: ArcadeBadgeProps) {
  const classes = className ? className.split(" ") : [];
  const visualClasses = classes.filter(
    (value) =>
      value.startsWith("bg-") ||
      value.startsWith("border-") ||
      value.startsWith("text-") ||
      value.startsWith("rounded-"),
  );
  const containerClasses = classes.filter(
    (value) =>
      !(
        value.startsWith("bg-") ||
        value.startsWith("border-") ||
        value.startsWith("text-") ||
        value.startsWith("rounded-")
      ),
  );

  const color = arcadeBadgeVariants({ variant, font });

  return (
    <span className={cn("relative inline-flex items-stretch", containerClasses)}>
      <ShadcnBadge
        {...props}
        className={cn(
          "h-full w-full rounded-none arcade-ui",
          font !== "normal" ? "arcade-retro" : null,
          color,
          visualClasses,
        )}
      >
        {children}
      </ShadcnBadge>
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-[3px] -left-1 w-1",
          color,
          visualClasses,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-[3px] -right-1 w-1",
          color,
          visualClasses,
        )}
      />
    </span>
  );
}

export { Badge, arcadeBadgeVariants };
export type { ArcadeBadgeProps };
