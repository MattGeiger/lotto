import * as React from "react";

import { cn } from "@/lib/utils";

type BoardGridProps = {
  order: number[];
  currentlyServing: number | null;
  maxTickets?: number;
  upcomingHighlightCount?: number;
};

export const BoardGrid: React.FC<BoardGridProps> = ({
  order,
  currentlyServing,
  maxTickets = 80,
  upcomingHighlightCount = 6,
}) => {
  const trimmed = order.slice(0, maxTickets);
  const currentIndex =
    currentlyServing != null ? trimmed.indexOf(currentlyServing) : -1;
  const upcomingCandidates =
    currentIndex >= 0
      ? trimmed.slice(currentIndex + 1, currentIndex + 1 + upcomingHighlightCount)
      : trimmed.slice(0, upcomingHighlightCount);
  const upcomingSet = new Set(upcomingCandidates);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
      {trimmed.map((ticket) => {
        const isCurrent = currentlyServing === ticket;
        const isUpcoming = upcomingSet.has(ticket);
        const label = `ticket-${ticket}${isCurrent ? "-current" : ""}${isUpcoming ? "-upcoming" : ""}`;

        return (
          <div
            key={ticket}
            aria-label={label}
            className={cn(
              "relative flex h-16 items-center justify-center rounded-xl border border-border bg-card text-xl font-bold text-foreground shadow-sm transition",
              isCurrent &&
                "border-2 border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] shadow-md",
              isUpcoming &&
                !isCurrent &&
                "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
            )}
          >
            <span className="tabular-nums">#{ticket}</span>
            {isCurrent && (
              <span className="absolute -top-2 right-2 rounded-full bg-[var(--status-warning-border)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--status-warning-text)] shadow">
                Now
              </span>
            )}
            {isUpcoming && !isCurrent && (
              <span className="absolute -top-2 right-2 rounded-full bg-[var(--status-success-border)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--status-success-text)] shadow">
                Next
              </span>
            )}
          </div>
        );
      })}
      {trimmed.length === 0 && (
        <div className="col-span-full rounded-lg border border-dashed border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          Waiting for tickets to be generated.
        </div>
      )}
    </div>
  );
};
