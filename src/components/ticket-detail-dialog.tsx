"use client";

import { Clock, ListOrdered, Users } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TicketDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketNumber: number;
  queuePosition: number;
  ticketsAhead: number;
  estimatedWaitMinutes: number;
};

const formatWaitTime = (minutes: number) => {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"}, ${mins} minute${mins === 1 ? "" : "s"}`;
};

export function TicketDetailDialog({
  open,
  onOpenChange,
  ticketNumber,
  queuePosition,
  ticketsAhead,
  estimatedWaitMinutes,
}: TicketDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-3xl font-bold">Ticket #{ticketNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <ListOrdered className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Queue Position</p>
              <p className="text-2xl font-bold text-foreground">{queuePosition}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <Users className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Tickets Ahead</p>
              <p className="text-2xl font-bold text-foreground">{ticketsAhead}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <Clock className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Estimated Wait</p>
              <p className="text-2xl font-bold text-foreground">{formatWaitTime(estimatedWaitMinutes)}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
