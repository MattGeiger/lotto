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
              "relative flex h-16 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-900 shadow-sm transition",
              "before:absolute before:inset-0 before:-z-10 before:rounded-xl before:bg-gradient-to-br before:from-white before:to-slate-50",
              isCurrent &&
                "border-2 border-amber-500 bg-amber-50 text-amber-900 shadow-lg shadow-amber-100",
              isUpcoming && !isCurrent && "border-blue-200 bg-blue-50 text-blue-800",
            )}
          >
            <span className="tabular-nums">#{ticket}</span>
            {isCurrent && (
              <span className="absolute -top-2 right-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">
                Now
              </span>
            )}
            {isUpcoming && !isCurrent && (
              <span className="absolute -top-2 right-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">
                Next
              </span>
            )}
          </div>
        );
      })}
      {trimmed.length === 0 && (
        <div className="col-span-full rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          Waiting for tickets to be generated.
        </div>
      )}
    </div>
  );
};
