"use client";

import { Info, ListOrdered } from "lucide-react";
import { Clock } from "@/components/animate-ui/icons/clock";
import { Users } from "@/components/animate-ui/icons/users";
import { X } from "@/components/animate-ui/icons/x";
import { LanguageMorphText } from "@/components/language-morph-text";

import { useLanguage, type Language } from "@/contexts/language-context";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatWaitTime } from "@/lib/time-format";
import { isRTL } from "@/lib/rtl-utils";
import type { TicketStatus } from "@/lib/state-types";

type TicketDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketNumber: number;
  queuePosition: number;
  ticketsAhead: number;
  estimatedWaitMinutes: number;
  language: Language;
  ticketStatus?: TicketStatus | null;
  calledAtTime?: string | null;
};

export function TicketDetailDialog({
  open,
  onOpenChange,
  ticketNumber,
  queuePosition,
  ticketsAhead,
  estimatedWaitMinutes,
  language,
  ticketStatus,
  calledAtTime,
}: TicketDetailDialogProps) {
  const { t } = useLanguage();
  const isReturned = ticketStatus === "returned";
  const isUnclaimed = ticketStatus === "unclaimed";
  const calledAtLabel = t("calledAtMessage");
  const calledMessage =
    calledAtTime && !isReturned && !isUnclaimed
      ? `${calledAtLabel} ${calledAtTime}`
      : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        dir={isRTL(language) ? "rtl" : "ltr"}
        lang={language}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-3xl font-bold">
            <LanguageMorphText text={t("ticket")} /> #{ticketNumber}
          </DialogTitle>
        </DialogHeader>
        <DialogClose className="absolute end-4 top-4 rounded-full p-1 text-muted-foreground transition hover:bg-muted/40">
          <X className="h-4 w-4" animateOnHover />
          <span className="sr-only">{t("close")}</span>
        </DialogClose>

        <div className="space-y-3 py-4">
          {(isReturned || isUnclaimed || calledMessage) ? (
            <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
              <Info className="mt-0.5 size-20 text-primary dark:text-[color:var(--ticket-serving-border)]" />
              <p className="text-2xl leading-relaxed text-muted-foreground">
                {isReturned
                  ? <LanguageMorphText text={t("returnedTicketMessage")} />
                  : isUnclaimed
                    ? <LanguageMorphText text={t("unclaimedTicketMessage")} />
                    : (
                      <>
                        <LanguageMorphText text={calledAtLabel} /> {calledAtTime}
                      </>
                    )}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
                <Clock
                  className="h-6 w-6 text-primary dark:text-[color:var(--ticket-serving-border)]"
                  animateOnHover
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    <LanguageMorphText text={t("estimatedWait")} />
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatWaitTime(estimatedWaitMinutes, language)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
                <Users
                  className="h-6 w-6 text-primary dark:text-[color:var(--ticket-serving-border)]"
                  animateOnHover
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    <LanguageMorphText text={t("ticketsAhead")} />
                  </p>
                  <p className="text-2xl font-bold text-foreground">{ticketsAhead}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
                <ListOrdered className="h-6 w-6 text-primary dark:text-[color:var(--ticket-serving-border)]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    <LanguageMorphText text={t("queuePosition")} />
                  </p>
                  <p className="text-2xl font-bold text-foreground">{queuePosition}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
