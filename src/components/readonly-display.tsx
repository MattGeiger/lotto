"use client";

import React from "react";
import Image from "next/image";
import QRCode from "qrcode";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketDetailDialog } from "@/components/ticket-detail-dialog";
import { useLanguage, type Language } from "@/contexts/language-context";
import { formatDate } from "@/lib/date-format";
import { getPollingIntervalMs } from "@/lib/polling-strategy";
import { isRTL } from "@/lib/rtl-utils";
import type { DayOfWeek, OperatingHours, RaffleState } from "@/lib/state-types";

const TIME_LOCALES: Record<Language, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  ru: "ru-RU",
  uk: "uk-UA",
  vi: "vi-VN",
  fa: "fa-IR",
  ar: "ar",
};

const formatTime = (input?: Date | number | null, language: Language = "en") => {
  if (!input && input !== 0) return "—";
  const date = input instanceof Date ? input : new Date(input);
  const locale = TIME_LOCALES[language] ?? "en-US";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", calendar: "gregory" });
};

const formatDisplayTime = (time24: string): string => {
  const [hoursStr, minutes] = time24.split(":");
  const hours = Number(hoursStr);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes ?? "00"} ${period}`;
};

const formatTimeRange = (openTime: string, closeTime: string): string => {
  const start = formatDisplayTime(openTime);
  const end = formatDisplayTime(closeTime);
  return `${start} - ${end}`;
};

const POLL_ERROR_RETRY_MS = 30_000;

const DAYS: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const getCurrentDayOfWeek = (): DayOfWeek => DAYS[new Date().getDay()];

const getNextOpenDay = (hours: OperatingHours | null): DayOfWeek | null => {
  if (!hours) return null;
  const todayIndex = new Date().getDay();
  for (let i = 1; i <= 7; i += 1) {
    const idx = (todayIndex + i) % 7;
    const day = DAYS[idx];
    if (hours[day]?.isOpen) {
      return day;
    }
  }
  return null;
};

type PantryStatus = "open" | "before_opening" | "after_closing" | "not_operating_today";

const getPantryStatus = (hours: OperatingHours | null): PantryStatus => {
  if (!hours) return "open";
  const today = getCurrentDayOfWeek();
  const config = hours[today];
  if (!config?.isOpen) return "not_operating_today";

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 8);

  if (currentTime < config.openTime) return "before_opening";
  if (currentTime > config.closeTime) return "after_closing";
  return "open";
};

export const ReadOnlyDisplay = () => {
  const { language, t } = useLanguage();
  const [state, setState] = React.useState<RaffleState | null>(null);
  const [status, setStatus] = React.useState("");
  const [hasError, setHasError] = React.useState(false);
  const [selectedTicket, setSelectedTicket] = React.useState<number | null>(null);
  const [qrUrl, setQrUrl] = React.useState("");
  const qrCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const pollTimeoutRef = React.useRef<number | null>(null);
  const pollStateRef = React.useRef<() => void>(() => {});
  const pollStepRef = React.useRef(0);
  const lastTimestampRef = React.useRef<number | null>(null);

  const formattedDate = formatDate(language);

  const clearPollTimeout = React.useCallback(() => {
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const scheduleNextPoll = React.useCallback(
    (delayMs: number) => {
      clearPollTimeout();
      pollTimeoutRef.current = window.setTimeout(() => {
        void pollStateRef.current();
      }, delayMs);
    },
    [clearPollTimeout],
  );

  const pollState = React.useCallback(async () => {
    if (document.visibilityState === "hidden") {
      clearPollTimeout();
      return;
    }
    setStatus(t("refreshing"));
    setHasError(false);
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load state");
      }
      const payload = (await response.json()) as RaffleState;
      setState(payload);
      setStatus(`${t("lastChecked")}: ${formatTime(new Date(), language)}`);

      const nextTimestamp =
        typeof payload.timestamp === "number" ? payload.timestamp : Date.now();
      if (lastTimestampRef.current === null || lastTimestampRef.current !== nextTimestamp) {
        lastTimestampRef.current = nextTimestamp;
        pollStepRef.current = 0;
      } else {
        pollStepRef.current += 1;
      }

      const { delayMs } = getPollingIntervalMs({
        now: new Date(),
        lastChangeAt: lastTimestampRef.current,
        operatingHours: payload.operatingHours,
        pollStep: pollStepRef.current,
      });
      scheduleNextPoll(delayMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("unknownError");
      setStatus(`${t("errorLoadingState")}: ${message}`);
      setHasError(true);
      scheduleNextPoll(POLL_ERROR_RETRY_MS);
    }
  }, [clearPollTimeout, language, scheduleNextPoll, t]);

  React.useEffect(() => {
    pollStateRef.current = pollState;
  }, [pollState]);

  React.useEffect(() => {
    void pollState();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearPollTimeout();
        return;
      }
      pollStepRef.current = 0;
      void pollState();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearPollTimeout();
    };
  }, [clearPollTimeout, pollState]);

  React.useEffect(() => {
    setStatus(t("pollingState"));
  }, [t]);

  React.useEffect(() => {
    document.title = `${t("foodPantryServiceFor")} ${formattedDate}`;
  }, [formattedDate, t]);

  React.useEffect(() => {
    const fetchDisplayUrl = async () => {
      try {
        const response = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getDisplayUrl" }),
        });
        const data = await response.json();
        setQrUrl(data.displayUrl || (typeof window !== "undefined" ? window.location.href : ""));
      } catch {
        setQrUrl(typeof window !== "undefined" ? window.location.href : "");
      }
    };
    fetchDisplayUrl();
  }, []);

  React.useEffect(() => {
    const target = qrUrl || (typeof window !== "undefined" ? window.location.href : "");
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, target, { width: 150, margin: 1 }).catch(() => {
      // ignore render errors
    });
  }, [qrUrl]);

  const startNumber = state?.startNumber ?? 0;
  const endNumber = state?.endNumber ?? 0;
  const generatedOrder = state?.generatedOrder ?? [];
  const currentlyServing = state?.currentlyServing ?? null;
  const currentIndex =
    generatedOrder && currentlyServing !== null ? generatedOrder.indexOf(currentlyServing) : -1;
  const hasTickets = generatedOrder.length > 0;
  const updatedTime = formatTime(state?.timestamp ?? null, language);
  const pantryStatus = getPantryStatus(state?.operatingHours ?? null);
  const isPantryOpen = pantryStatus === "open";
  const nextOpenDay =
    pantryStatus === "after_closing" || pantryStatus === "not_operating_today"
      ? getNextOpenDay(state?.operatingHours ?? null)
      : null;

  const todayHours = React.useMemo(() => {
    if (!state?.operatingHours || pantryStatus !== "before_opening") return null;
    const today = getCurrentDayOfWeek();
    return state.operatingHours[today];
  }, [state?.operatingHours, pantryStatus]);

  const getTicketDetails = (ticketNumber: number) => {
    if (!state?.generatedOrder?.length) return null;
    const queuePosition = state.generatedOrder.indexOf(ticketNumber) + 1;
    if (queuePosition <= 0) return null;
    const ticketStatus = state.ticketStatus?.[ticketNumber] ?? null;
    const calledAt = state.calledAt?.[ticketNumber] ?? null;
    const calledAtTime = calledAt ? formatTime(calledAt, language) : null;
    const isReturned = ticketStatus === "returned";
    if (isReturned) {
      return {
        queuePosition,
        ticketsAhead: 0,
        estimatedWaitMinutes: 0,
        ticketStatus,
        calledAt,
        calledAtTime,
      };
    }
    const servingIndex =
      state.currentlyServing !== null ? state.generatedOrder.indexOf(state.currentlyServing) : -1;
    const ticketIndex = state.generatedOrder.indexOf(ticketNumber);
    const ticketsAhead =
      servingIndex === -1
        ? state.generatedOrder
            .slice(0, ticketIndex)
            .filter((ticket) => state.ticketStatus?.[ticket] !== "returned").length
        : state.generatedOrder
            .slice(servingIndex + 1, ticketIndex)
            .filter((ticket) => state.ticketStatus?.[ticket] !== "returned").length;
    // 165 minutes / 75 shoppers = 2.2 minutes per shopper
    const estimatedWaitMinutes = Math.round(ticketsAhead * 2.2);
    return { queuePosition, ticketsAhead, estimatedWaitMinutes, ticketStatus, calledAt, calledAtTime };
  };

  return (
      <div
        dir={isRTL(language) ? "rtl" : "ltr"}
        lang={language}
        className="min-h-screen w-full bg-gradient-display px-8 pt-12 pb-8 text-foreground sm:px-10 lg:px-12"
      >
      <div className="mx-auto flex w-full flex-col gap-4">
        {/* Logo + Now Serving Row */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-[minmax(280px,320px)_1fr_minmax(280px,320px)] sm:items-center sm:gap-6">
          {/* Logo - left */}
          <div className="flex justify-center sm:justify-start">
            <Image
              src="/wth-logo-horizontal.png"
              alt="William Temple House"
              width={2314}
              height={606}
              className="block h-auto w-full max-w-[400px] dark:hidden"
            />
            <Image
              src="/wth-logo-horizontal-reverse.png"
              alt="William Temple House"
              width={2333}
              height={641}
              className="hidden h-auto w-full max-w-[400px] dark:block"
            />
          </div>

          {/* NOW SERVING - center */}
          <div className="flex justify-center">
            <div className="text-center">
              <p className="mb-1 text-lg uppercase tracking-[0.14em] text-muted-foreground">{t("nowServing")}</p>
              <p
                className="bg-gradient-serving-text bg-clip-text text-[96px] font-black leading-[1.15] text-transparent"
                aria-label="Currently serving ticket number"
              >
                {currentlyServing ?? t("waiting")}
              </p>
            </div>
          </div>

          {/* QR Code - right */}
          <div className="hidden sm:flex items-center justify-center">
            <div className="rounded-lg border border-border/60 bg-card/30 p-3">
              <canvas
                ref={qrCanvasRef}
                width={150}
                height={150}
                aria-label="Scan to view display"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 sm:gap-4">
          <Card className="border-border/80 bg-card/80 text-start">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                {t("foodPantryServiceFor")}
              </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold text-foreground">{formattedDate}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80 text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                {t("ticketsIssuedToday")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {startNumber && endNumber ? `${startNumber} – ${endNumber}` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80 text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                {t("totalTicketsIssued")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {startNumber && endNumber ? endNumber - startNumber + 1 : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                {t("drawingOrder")}
              </CardTitle>
              <Badge
                variant="outline"
                className="border-border/60 text-xs font-medium text-muted-foreground"
              >
                {t("updated")}: {updatedTime}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasTickets && (
              <div className="flex flex-col items-center gap-4 rounded-xl bg-muted/20 px-4 py-6">
                {!isPantryOpen ? (
                  <>
                    {pantryStatus === "before_opening" && (
                      <>
                        <span className="block w-full text-center text-3xl font-extrabold leading-snug text-foreground">
                          {t("pantryNotOpenYet")}
                        </span>
                        {todayHours && (
                          <span className="block w-full text-center text-xl font-semibold text-foreground">
                            {t("todaysHours")}:{" "}
                            <span dir="ltr">{formatTimeRange(todayHours.openTime, todayHours.closeTime)}</span>
                          </span>
                        )}
                      </>
                    )}

                    {pantryStatus === "after_closing" && (
                      <>
                        <span className="block w-full text-center text-3xl font-extrabold leading-snug text-foreground">
                          {t("pantryClosedForDay")}
                        </span>
                        {nextOpenDay && (
                          <span className="block w-full text-center text-xl font-semibold text-foreground">
                            {t("nextOpenDay")}: {t(nextOpenDay)}
                          </span>
                        )}
                      </>
                    )}

                    {pantryStatus === "not_operating_today" && (
                      <>
                        <span className="block w-full text-center text-3xl font-extrabold leading-snug text-foreground">
                          {t("pantryClosed")}
                        </span>
                        {nextOpenDay && (
                          <span className="block w-full text-center text-xl font-semibold text-foreground">
                            {t("nextOpenDay")}: {t(nextOpenDay)}
                          </span>
                        )}
                      </>
                    )}

                    {state?.operatingHours && (
                      <div className="mt-4 w-full max-w-md space-y-3">
                        <p className="text-center text-xl font-bold text-foreground">
                          {t("pantryHours")}
                        </p>
                        <div className="space-y-0.5 text-center">
                          {DAYS.map((day) => {
                            const config = state.operatingHours![day];
                            const dayLabel = t(day);
                            return (
                              <div key={day} className="flex justify-between text-base">
                                <span className="font-medium text-foreground">{dayLabel}</span>
                                <span className="text-muted-foreground" dir={config.isOpen ? "ltr" : undefined}>
                                  {config.isOpen
                                    ? formatTimeRange(config.openTime, config.closeTime)
                                    : t("closed")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="block w-full text-center text-3xl font-extrabold leading-snug text-foreground">
                      {t("welcome")}
                    </span>
                    <span className="block w-full text-center text-3xl font-extrabold leading-snug text-foreground">
                      {t("raffleNotStarted")}
                    </span>
                    <span className="block w-full text-center text-3xl font-extrabold leading-snug text-foreground">
                      {t("checkBackSoon")}
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 md:gap-4">
              {generatedOrder.map((value, index) => {
                const baseClasses =
                  "flex items-center justify-center rounded-xl border text-center text-2xl font-extrabold leading-[1.2] px-4 py-3 cursor-pointer transition-transform hover:scale-[1.03]";
                const ticketStatus = state?.ticketStatus?.[value];
                const stateClass =
                  ticketStatus === "returned"
                    ? "ticket-returned"
                    : ticketStatus === "unclaimed"
                      ? "ticket-unclaimed"
                      : value === currentlyServing
                        ? "ticket-serving"
                        : currentIndex !== -1 && index < currentIndex
                          ? "ticket-served"
                          : "ticket-upcoming";
                return (
                  <div
                    key={value}
                    className={`${baseClasses} ${stateClass}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTicket(value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedTicket(value);
                      }
                    }}
                  >
                    {value}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full border ticket-upcoming" />
                {t("notCalled")}
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full border ticket-serving" />
                {t("nowServing")}
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full border ticket-served" />
                {t("called")}
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full border ticket-unclaimed" />
                {t("unclaimed")}
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full border ticket-returned" />
                {t("returned")}
              </div>
            </div>

            <div
              className={`text-sm ${hasError ? "text-destructive" : "text-muted-foreground"}`}
              id="status"
              aria-live="polite"
            >
              {status}
            </div>
          </CardContent>
        </Card>
        {selectedTicket !== null && getTicketDetails(selectedTicket) && (
          <TicketDetailDialog
            open={selectedTicket !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedTicket(null);
            }}
            ticketNumber={selectedTicket}
            {...getTicketDetails(selectedTicket)!}
            language={language}
          />
        )}
      </div>
    </div>
  );
};
