import { cn } from "@/lib/utils";
import {
  Card as ShadcnCard,
  CardAction as ShadcnCardAction,
  CardContent as ShadcnCardContent,
  CardDescription as ShadcnCardDescription,
  CardFooter as ShadcnCardFooter,
  CardHeader as ShadcnCardHeader,
  CardTitle as ShadcnCardTitle,
} from "@/components/ui/card";

type ArcadeCardProps = React.ComponentProps<"div"> & {
  font?: "normal" | "retro";
};

function Card({ className, font, ...props }: ArcadeCardProps) {
  return (
    <div
      className={cn(
        "relative border-y-4 border-[var(--arcade-panel-border)] bg-[var(--arcade-panel)] p-0",
        className,
      )}
    >
      <ShadcnCard
        {...props}
        className={cn(
          "w-full rounded-none border-0 bg-[var(--arcade-panel)] text-[var(--arcade-text)]",
          font !== "normal" ? "arcade-retro" : null,
          className,
        )}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -mx-1 border-x-4 border-[var(--arcade-panel-border)]"
      />
    </div>
  );
}

function CardHeader({ className, font, ...props }: ArcadeCardProps) {
  return (
    <ShadcnCardHeader
      {...props}
      className={cn(font !== "normal" ? "arcade-retro" : null, className)}
    />
  );
}

function CardTitle({ className, font, ...props }: ArcadeCardProps) {
  return (
    <ShadcnCardTitle
      {...props}
      className={cn("text-center", font !== "normal" ? "arcade-retro" : null, className)}
    />
  );
}

function CardDescription({ className, font, ...props }: ArcadeCardProps) {
  return (
    <ShadcnCardDescription
      {...props}
      className={cn(
        "text-[var(--arcade-text)]/75",
        font !== "normal" ? "arcade-retro" : null,
        className,
      )}
    />
  );
}

function CardAction({ className, font, ...props }: ArcadeCardProps) {
  return (
    <ShadcnCardAction
      {...props}
      className={cn(font !== "normal" ? "arcade-retro" : null, className)}
    />
  );
}

function CardContent({ className, font, ...props }: ArcadeCardProps) {
  return (
    <ShadcnCardContent
      {...props}
      className={cn(font !== "normal" ? "arcade-ui" : null, className)}
    />
  );
}

function CardFooter({ className, font, ...props }: ArcadeCardProps) {
  return (
    <ShadcnCardFooter
      {...props}
      className={cn(font !== "normal" ? "arcade-ui" : null, className)}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
export type { ArcadeCardProps };
