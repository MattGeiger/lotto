import { cn } from "@/lib/utils";

type CardProps = React.ComponentProps<"div"> & { muted?: boolean };

const Card = ({ className, ...props }: CardProps) => (
  <div
    data-slot="card"
    className={cn("rounded-xl border border-border bg-card p-4 text-card-foreground shadow-md", className)}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("space-y-1", className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-lg font-semibold text-card-foreground", className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-4 space-y-3", className)} {...props} />
);

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
