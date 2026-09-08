// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

"use client";

import React from "react";
import QRCode from "qrcode";
import { MorphingText } from "@/components/animate-ui/primitives/texts/morphing";
import { RollingText } from "@/components/animate-ui/primitives/texts/rolling";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrambleOnLanguageChange, T } from "@/components/core/scramble-text";
import { BrandLogo } from "@/components/brand-logo";
import RealtimeCanaryMount from "@/components/realtime-canary-mount";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TicketDetailDialog } from "@/components/ticket-detail-dialog";
import { useBrand } from "@/contexts/brand-context";
import { useLanguage, type Language } from "@/contexts/language-context";
import { formatDate } from "@/lib/date-format";
import {
  getPollingIntervalMs,
  recordPollingStateObservation,
} from "@/lib/polling-strategy";
import { isRTL } from "@/lib/rtl-utils";
import {
  defaultState,
  type DayOfWeek,
  type OperatingHours,
  type RaffleState,
} from "@/lib/state-types";
import type { RealtimeCanaryClientConfig } from "@/lib/realtime/client-canary-config";
import { readPolledStateRevision } from "@/lib/realtime/polled-state-revision";
import { toRenderableRaffleState, type PublicRaffleState } from "@/lib/realtime/public-state-protocol";
import { formatWaitTime } from "@/lib/time-format";
import { cn } from "@/lib/utils";

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

const formatServiceClock = (input: Date | number, language: Language): string => {
  const date = input instanceof Date ? input : new Date(input);
  const locale = TIME_LOCALES[language] ?? "en-US";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    calendar: "gregory",
  }).format(date);
};

const POLL_ERROR_RETRY_MS = 30_000;
const EMPTY_GENERATED_ORDER: number[] = [];
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

export type TicketSearchRequest = {
  ticketNumber: number;
  triggerId: number;
};

type DisplayVariant = "public" | "personalized";

type ReadOnlyDisplayProps = {
  ticketSearchRequest?: TicketSearchRequest;
  displayVariant?: DisplayVariant;
  personalizedTicketNumber?: number | null;
  onRequestTicketChange?: () => void;
  onStateChange?: (state: RaffleState) => void;
  languageTextAnimation?: "scramble" | "none";
  showQrCode?: boolean;
  showHeaderLogo?: boolean;
  realtimeCanary?: RealtimeCanaryClientConfig | null;
  realtimeSourceCanary?: RealtimeCanaryClientConfig | null;
};

export const ReadOnlyDisplay = ({
  ticketSearchRequest,
  displayVariant = "public",
  personalizedTicketNumber = null,
  onRequestTicketChange,
  onStateChange,
  languageTextAnimation = "scramble",
  showQrCode = true,
  showHeaderLogo = true,
  realtimeCanary = null,
  realtimeSourceCanary = null,
}: ReadOnlyDisplayProps) => {
  const { language, t, translateBrandString } = useLanguage();

  const [state, setState] = React.useState<RaffleState | null>(null);
  const [lastPolledState, setLastPolledState] = React.useState<RaffleState | null>(null);
  const [lastPolledRevision, setLastPolledRevision] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState("");
  const [hasError, setHasError] = React.useState(false);
  const [selectedTicket, setSelectedTicket] = React.useState<number | null>(null);
  const [notFoundDialogOpen, setNotFoundDialogOpen] = React.useState(false);
  const qrCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const pollTimeoutRef = React.useRef<number | null>(null);
  const pollStateRef = React.useRef<() => void>(() => {});
  const stateRef = React.useRef<RaffleState | null>(null);
  const sourceAuthoritativeRef = React.useRef(false);
  const pollInFlightRef = React.useRef(false);
  const lastSeenTimestampRef = React.useRef<number | null>(null);
  const lastChangeAtRef = React.useRef<number | null>(null);
  const burstUntilRef = React.useRef<number | null>(null);
  const lastSearchRequestRef = React.useRef(0);
  // The server may prerender in UTC while the pantry browser is in another
  // timezone. Keep the hydration value deterministic, then populate the live
  // clock immediately after mount so React never has to discard this tree.
  const [deviceNowMs, setDeviceNowMs] = React.useState<number | null>(null);
  const { serviceLabel } = useBrand();

  const formattedDate =
    deviceNowMs === null
      ? "—"
      : formatDate(language, deviceNowMs, state?.timezone ?? defaultState.timezone);

  const clearPollTimeout = React.useCallback(() => {
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const recordStateActivity = React.useCallback((timestamp: number | null | undefined) => {
    const activity = recordPollingStateObservation({
      activity: {
        lastSeenTimestamp: lastSeenTimestampRef.current,
        lastChangeAt: lastChangeAtRef.current,
        burstUntil: burstUntilRef.current,
      },
      stateTimestamp: timestamp,
      observedAt: Date.now(),
    });
    lastSeenTimestampRef.current = activity.lastSeenTimestamp;
    lastChangeAtRef.current = activity.lastChangeAt;
    burstUntilRef.current = activity.burstUntil;
  }, []);

  const scheduleNextPoll = React.useCallback(
    (delayMs: number) => {
      clearPollTimeout();
      if (sourceAuthoritativeRef.current) return;
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
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    setStatus(t("refreshing"));
    setHasError(false);
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load state");
      }
      const payload = (await response.json()) as RaffleState;
      stateRef.current = payload;
      setState(payload);
      const revision = readPolledStateRevision(response.headers);
      setLastPolledState(payload);
      setLastPolledRevision(revision);
      onStateChange?.(payload);
      setStatus(`${t("lastChecked")}: ${formatTime(new Date(), language)}`);

      const nowMs = Date.now();
      recordStateActivity(payload.timestamp);

      const { delayMs } = getPollingIntervalMs({
        now: new Date(nowMs),
        lastChangeAt: lastChangeAtRef.current,
        burstUntil: burstUntilRef.current,
        operatingHours: payload.operatingHours,
        timeZone: payload.timezone,
      });
      scheduleNextPoll(delayMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("unknownError");
      setStatus(`${t("errorLoadingState")}: ${message}`);
      setHasError(true);
      scheduleNextPoll(POLL_ERROR_RETRY_MS);
    } finally {
      pollInFlightRef.current = false;
    }
  }, [clearPollTimeout, language, onStateChange, recordStateActivity, scheduleNextPoll, t]);

  const handleSourceState = React.useCallback((publicState: PublicRaffleState, revision: number) => {
    const payload = toRenderableRaffleState(publicState, stateRef.current);
    recordStateActivity(payload.timestamp);
    stateRef.current = payload;
    setState(payload);
    onStateChange?.(payload);
    setHasError(false);
    setStatus(`Realtime source · r${revision}`);
  }, [onStateChange, recordStateActivity]);

  const handleSourceAuthorityChange = React.useCallback((authoritative: boolean) => {
    sourceAuthoritativeRef.current = authoritative;
    clearPollTimeout();
    if (authoritative) {
      setHasError(false);
      return;
    }
    if (document.visibilityState !== "hidden") {
      void pollStateRef.current();
    }
  }, [clearPollTimeout]);

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
      lastSeenTimestampRef.current = null;
      lastChangeAtRef.current = null;
      burstUntilRef.current = null;
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
    const updateClock = () => setDeviceNowMs(Date.now());
    updateClock();
    const intervalId = window.setInterval(updateClock, 30_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // The browser tab / document title is intentionally left to the static,
  // server-rendered, brand-aware `metadata.title` in src/app/layout.tsx. Do NOT
  // set `document.title` to the pantry date here:
  // this component renders on the indexed home page ("/"), and a client-side
  // dated title gets crawled by Googlebot and frozen as a stale date in search
  // results. The live service date is still shown in-page (service-date below).
  React.useEffect(() => {
    if (!showQrCode) return;
    // The QR target comes from the live polled state, so an admin change to the
    // display URL propagates to the QR on the next poll without a reload. Falls
    // back to the site homepage (origin, i.e. "/") rather than the board's own
    // URL, so scanning sends clients to the personalized onboarding instead of
    // back to the board they are already looking at.
    const target = state?.displayUrl || (typeof window !== "undefined" ? `${window.location.origin}/` : "");
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, target, { width: 150, margin: 1 }).catch(() => {
      // ignore render errors
    });
  }, [state?.displayUrl, showQrCode]);

  const startNumber = state?.startNumber ?? 0;
  const endNumber = state?.endNumber ?? 0;
  const generatedOrder = state?.generatedOrder ?? EMPTY_GENERATED_ORDER;
  const currentlyServing = state?.currentlyServing ?? null;

  const currentIndex =
    generatedOrder && currentlyServing !== null ? generatedOrder.indexOf(currentlyServing) : -1;
  const hasTickets = generatedOrder.length > 0;
  const formattedServiceTime =
    deviceNowMs === null ? "—" : formatServiceClock(deviceNowMs, language);
  const isPersonalized = displayVariant === "personalized";
  const updatedTime = formatTime(state?.timestamp ?? null, language);
  const nowServingDisplayText = currentlyServing === null ? t("waiting") : String(currentlyServing);
  const animateServingValue = false;
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

  React.useEffect(() => {
    if (!ticketSearchRequest) return;
    if (ticketSearchRequest.triggerId <= lastSearchRequestRef.current) return;
    lastSearchRequestRef.current = ticketSearchRequest.triggerId;
    const ticketNumber = ticketSearchRequest.ticketNumber;
    if (ticketNumber === null || !generatedOrder.length) return;
    const inRange = ticketNumber >= startNumber && ticketNumber <= endNumber;
    const exists = generatedOrder.includes(ticketNumber);
    if (inRange && exists) {
      setSelectedTicket(ticketNumber);
      setNotFoundDialogOpen(false);
    } else {
      setSelectedTicket(null);
      setNotFoundDialogOpen(true);
    }
  }, [ticketSearchRequest, startNumber, endNumber, generatedOrder]);

  const getTicketDetails = React.useCallback((ticketNumber: number) => {
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
        : ticketIndex <= servingIndex
          ? 0
        : state.generatedOrder
            .slice(servingIndex, ticketIndex)
            .filter((ticket) => state.ticketStatus?.[ticket] !== "returned").length;
    // 165 minutes / 75 shoppers = 2.2 minutes per shopper
    const estimatedWaitMinutes = Math.round(ticketsAhead * 2.2);
    return { queuePosition, ticketsAhead, estimatedWaitMinutes, ticketStatus, calledAt, calledAtTime };
  }, [language, state]);

  const personalizedTicketDetails =
    isPersonalized && personalizedTicketNumber !== null
      ? getTicketDetails(personalizedTicketNumber)
      : null;
  const personalizedTicketStatus =
    isPersonalized && personalizedTicketNumber !== null
      ? state?.ticketStatus?.[personalizedTicketNumber] ?? null
      : null;
  const personalizedCalledAt =
    isPersonalized && personalizedTicketNumber !== null
      ? state?.calledAt?.[personalizedTicketNumber] ?? null
      : null;
  const personalizedCalledAtTime = personalizedCalledAt ? formatTime(personalizedCalledAt, language) : null;
  const personalizedTicketDisplay =
    personalizedTicketNumber === null ? "—" : String(personalizedTicketNumber).padStart(2, "0");
  const personalizedEstimatedWaitDisplay = personalizedTicketDetails
    ? formatWaitTime(personalizedTicketDetails.estimatedWaitMinutes, language)
    : t("checkBackSoonValue");
  const personalizedTicketsAheadDisplay = personalizedTicketDetails
    ? String(personalizedTicketDetails.ticketsAhead)
    : t("checkBackSoonValue");
  const personalizedTicketPositionDisplay = personalizedTicketDetails
    ? String(personalizedTicketDetails.queuePosition)
    : t("checkBackSoonValue");
  const showTicketNotInDrawingMessage =
    hasTickets &&
    isPersonalized &&
    personalizedTicketNumber !== null &&
    personalizedTicketDetails === null &&
    personalizedTicketStatus !== "returned" &&
    personalizedTicketStatus !== "unclaimed" &&
    !personalizedCalledAtTime;

  // The "your ticket was called" overlay + confetti now live in the shared
  // <TicketCalledCelebration /> (mounted by each public route), so the board
  // itself only renders the persistent "called at HH:MM" message below.

  const nowServingValueClassName = isPersonalized
    ? "text-[96px]"
    : "text-[clamp(4.5rem,10vh,96px)]";
  const textDirection = isRTL(language) ? "rtl" : "ltr";
  const noTicketMessageClassName = cn(
    "block w-full text-center font-extrabold leading-snug text-foreground",
    isPersonalized ? "text-3xl" : "text-2xl sm:text-3xl [@media(max-height:760px)]:text-2xl",
  );

  return (
    <ScrambleOnLanguageChange enabled={languageTextAnimation === "scramble"}>
      <RealtimeCanaryMount
        config={realtimeCanary}
        sourceConfig={realtimeSourceCanary}
        polledState={lastPolledState}
        polledRevision={lastPolledRevision}
        onSourceState={handleSourceState}
        onSourceAuthorityChange={handleSourceAuthorityChange}
      />
      <div
        dir={isRTL(language) ? "rtl" : "ltr"}
        lang={language}
        className={cn(
          "min-h-screen w-full bg-gradient-display px-6 text-foreground sm:px-8 lg:px-10",
          // Extra scroll clearance so the fixed bottom tab bar does not trap
          // the ticket grid/card behind the dock. The public board also reserves
          // extra mobile clearance for its absolutely positioned utility/search
          // toolbar; the desktop toolbar already clears the header at `pt-14`.
          isPersonalized ? "pb-28 pt-14" : "pb-32 pt-20 sm:pt-14",
        )}
        >
        <div data-testid="readonly-display-content" className="mx-auto flex w-full flex-col gap-4" dir="ltr">
        {/* Logo + Now Serving Row */}
        <div
          className={cn(
            "grid grid-cols-1 gap-4 sm:items-center sm:gap-6",
            isPersonalized ? "mt-10 sm:mt-12" : "mt-6 sm:mt-8",
            showHeaderLogo && showQrCode
              ? "sm:grid-cols-[minmax(280px,320px)_1fr_minmax(280px,320px)]"
              : showHeaderLogo
                ? "sm:grid-cols-[minmax(280px,320px)_1fr]"
                : showQrCode
                  ? "sm:grid-cols-[1fr_minmax(280px,320px)]"
                  : "sm:grid-cols-1",
          )}
        >
          {/* Logo - left */}
          {showHeaderLogo ? (
            <div className="flex justify-center sm:justify-start">
              <BrandLogo className="w-full max-w-[400px]" />
            </div>
          ) : null}

          {/* NOW SERVING - center */}
          <div className="flex justify-center">
            <div dir={textDirection} className="text-center">
              <p className="mb-1 text-lg uppercase tracking-[0.14em] text-[color:var(--serving-label-color)]">
                <T text={t("nowServing")} />
              </p>
              {!animateServingValue ? (
                <span
                  className={cn(
                    "inline-block overflow-visible bg-gradient-serving-text bg-clip-text pb-[0.08em] font-extrabold leading-[1.28] text-transparent",
                    nowServingValueClassName,
                  )}
                  aria-label="Currently serving ticket number"
                >
                  {nowServingDisplayText}
                </span>
              ) : currentlyServing === null ? (
                <MorphingText
                  text={nowServingDisplayText}
                  className={cn(
                    "inline-block overflow-visible pb-[0.08em] font-extrabold leading-[1.28]",
                    nowServingValueClassName,
                  )}
                  characterClassName="bg-gradient-serving-text bg-clip-text text-transparent"
                  characterStagger={0.08}
                  wordWrap="word"
                  initial={{ opacity: 0, y: 56 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -36 }}
                  transition={{ type: "spring", stiffness: 80, damping: 16, mass: 0.45 }}
                  aria-label="Currently serving ticket number"
                />
              ) : (
                <RollingText
                  text={nowServingDisplayText}
                  className={cn(
                    "inline-block overflow-visible pb-[0.08em] font-extrabold leading-[1.28]",
                    nowServingValueClassName,
                  )}
                  characterClassName="bg-gradient-serving-text bg-clip-text text-transparent"
                  transition={{ duration: 0.75, ease: "easeOut", delay: 0.15 }}
                  aria-label="Currently serving ticket number"
                />
              )}
            </div>
          </div>

          {/* QR Code - right */}
          {showQrCode ? (
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
          ) : null}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 sm:gap-4">
          <Card
            dir={textDirection}
            className="border-border/80 bg-card/80 text-start animate-slide-in-up gap-1"
            style={{ animationDelay: "100ms" }}
          >
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                  <T
                    text={
                      serviceLabel
                        ? translateBrandString(serviceLabel) ?? serviceLabel
                        : t("foodPantryServiceFor")
                    }
                  />
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p data-testid="service-date" className="text-2xl font-semibold text-foreground"><T text={formattedDate} /></p>
            </CardContent>
          </Card>
          {hasTickets ? (
            <Card
              dir={textDirection}
              className="border-border/80 bg-card/80 text-start animate-slide-in-up gap-1"
              style={{ animationDelay: "200ms" }}
            >
              <CardHeader className="pb-0">
                <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                  <T text={t("currentTime")} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">
                  {/* Wall-clock text can differ between the server render and
                      hydration (minute boundary, or Node vs. browser ICU
                      spacing before AM/PM); the mounted clock interval
                      corrects it immediately, so suppress the boot-time
                      mismatch warning. */}
                  <span
                    data-testid="service-time"
                    dir="ltr"
                    className="[unicode-bidi:isolate]"
                    suppressHydrationWarning
                  >
                    {formattedServiceTime}
                  </span>
                </p>
              </CardContent>
            </Card>
          ) : null}
          <Card
            dir={textDirection}
            className="border-border/80 bg-card/80 text-center animate-slide-in-up gap-1"
            style={{ animationDelay: "300ms" }}
          >
            <CardHeader className="pb-0">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                <T text={t("ticketsIssuedToday")} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {startNumber && endNumber ? `${startNumber} – ${endNumber}` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card
            dir={textDirection}
            className="border-border/80 bg-card/80 text-center animate-slide-in-up gap-1"
            style={{ animationDelay: "400ms" }}
          >
            <CardHeader className="pb-0">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                <T text={t("totalTicketsIssued")} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {startNumber && endNumber ? endNumber - startNumber + 1 : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card dir={textDirection} className="border-border/80 bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2" dir="ltr">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground" dir="ltr">
                <T text={isPersonalized ? t("yourTicketCardTitle") : t("drawingOrder")} />
              </CardTitle>
              <Badge
                variant="outline"
                className="border-border/60 text-xs font-medium text-muted-foreground"
                dir="ltr"
              >
                <T text={t("updated")} />:{" "}
                <span dir="ltr" className="[unicode-bidi:isolate]">
                  {updatedTime}
                </span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasTickets && (
              <div
                className={cn(
                  "flex flex-col items-center gap-4 rounded-xl bg-muted/20 px-3",
                  isPersonalized ? "py-6" : "py-4",
                )}
              >
                {!isPantryOpen ? (
                  <>
                    {pantryStatus === "before_opening" && (
                      <>
                        <span className={noTicketMessageClassName}>
                          <T text={t("pantryNotOpenYet")} />
                        </span>
                        {todayHours && (
                          <span className="block w-full text-center text-xl font-semibold text-foreground">
                            <T text={t("todaysHours")} />:{" "}
                            <span dir="ltr">{formatTimeRange(todayHours.openTime, todayHours.closeTime)}</span>
                          </span>
                        )}
                      </>
                    )}

                    {pantryStatus === "after_closing" && (
                      <>
                        <span className={noTicketMessageClassName}>
                          <T text={t("pantryClosedForDay")} />
                        </span>
                        {nextOpenDay && (
                          <span className="block w-full text-center text-xl font-semibold text-foreground">
                            <T text={t("nextOpenDay")} />:{" "}
                            <T text={t(nextOpenDay)} />
                          </span>
                        )}
                      </>
                    )}

                    {pantryStatus === "not_operating_today" && (
                      <>
                        <span className={noTicketMessageClassName}>
                          <T text={t("pantryClosed")} />
                        </span>
                        {nextOpenDay && (
                          <span className="block w-full text-center text-xl font-semibold text-foreground">
                            <T text={t("nextOpenDay")} />:{" "}
                            <T text={t(nextOpenDay)} />
                          </span>
                        )}
                      </>
                    )}

                    {state?.operatingHours && (
                      <div className="mt-4 w-full max-w-md space-y-3">
                        <p className="text-center text-xl font-bold text-foreground">
                          <T text={t("pantryHours")} />
                        </p>
                        <div className="space-y-0.5 text-center">
                          {DAYS.map((day) => {
                            const config = state.operatingHours![day];
                            const dayLabel = t(day);
                            return (
                              <div key={day} className="flex justify-between text-base">
                                <span className="font-medium text-foreground">
                                  <T text={dayLabel} />
                                </span>
                                <span className="text-muted-foreground" dir={config.isOpen ? "ltr" : undefined}>
                                  {config.isOpen
                                    ? formatTimeRange(config.openTime, config.closeTime)
                                    : <T text={t("closed")} />}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {pantryStatus === "after_closing" && onRequestTicketChange ? (
                      <div className="flex flex-col items-center gap-3">
                        <Button type="button" haptic="uiToggle" onClick={onRequestTicketChange}>
                          <T text={t("changeTicket")} />
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span className={noTicketMessageClassName}>
                      <T text={t("welcome")} />
                    </span>
                    <span className={noTicketMessageClassName}>
                      <T text={t("raffleNotStarted")} />
                    </span>
                    <span className={noTicketMessageClassName}>
                      <T text={t("checkBackSoon")} />
                    </span>
                  </>
                )}
              </div>
            )}

            {hasTickets && isPersonalized && (
              <div className="space-y-4 rounded-xl bg-muted/20 px-3 py-6">
                {(personalizedTicketStatus === "returned" || personalizedTicketStatus === "unclaimed" || personalizedCalledAtTime || showTicketNotInDrawingMessage) && (
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-base leading-relaxed text-muted-foreground">
                      {personalizedTicketStatus === "returned" ? (
                        <T text={t("returnedTicketMessage")} />
                      ) : personalizedTicketStatus === "unclaimed" ? (
                        <T text={t("unclaimedTicketMessage")} />
                      ) : personalizedCalledAtTime ? (
                        <>
                          <T text={t("calledAtMessage")} /> {personalizedCalledAtTime}
                        </>
                      ) : (
                        <T text={t("ticketNotInDrawingYetMessage")} />
                      )}
                    </p>
                  </div>
                )}

                <div className="space-y-4 rounded-lg border bg-card p-4">
                  <div className="space-y-1 border-b border-border/60 pb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <T text={t("yourTicketNumberLabel")} />
                    </p>
                    <p className="text-2xl font-bold text-foreground">{personalizedTicketDisplay}</p>
                  </div>

                  <div className="space-y-1 border-b border-border/60 pb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <T text={t("yourEstimatedWaitLabel")} />
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      <T text={personalizedEstimatedWaitDisplay} />
                    </p>
                  </div>

                  <div className="space-y-1 border-b border-border/60 pb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <T text={t("ticketsAheadOfYouLabel")} />
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      <T text={personalizedTicketsAheadDisplay} />
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <T text={t("yourTicketPositionLabel")} />
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      <T text={personalizedTicketPositionDisplay} />
                    </p>
                  </div>
                </div>

                {onRequestTicketChange ? (
                  <div className="flex flex-col items-center gap-3">
                    <Button type="button" haptic="uiToggle" onClick={onRequestTicketChange}>
                      <T text={t("changeTicket")} />
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {hasTickets && !isPersonalized && (
              <>
                <div
                  data-testid="ticket-grid"
                  className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 md:gap-4"
                  dir="ltr"
                >
                  {generatedOrder.map((value, index) => {
                    const baseClasses =
                      "flex items-center justify-center rounded-xl border text-center text-2xl font-extrabold leading-[1.2] px-3 py-3 cursor-pointer transition-transform hover:scale-[1.03]";
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
                        className={`${baseClasses} ${stateClass} animate-fade-in`}
                        style={{ animationDelay: `${Math.min(index * 30, 1500)}ms` }}
                        role="button"
                        dir="ltr"
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

                <div
                  data-testid="ticket-status-key"
                  className="mt-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
                  dir="ltr"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full border ticket-upcoming" />
                    <span dir={textDirection}>
                      <T text={t("notCalled")} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full border ticket-serving" />
                    <span dir={textDirection}>
                      <T text={t("nowServing")} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full border ticket-served" />
                    <span dir={textDirection}>
                      <T text={t("called")} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full border ticket-unclaimed" />
                    <span dir={textDirection}>
                      <T text={t("unclaimed")} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full border ticket-returned" />
                    <span dir={textDirection}>
                      <T text={t("returned")} />
                    </span>
                  </div>
                </div>
              </>
            )}

            <div
              className={`text-sm ${hasError ? "text-destructive" : "text-muted-foreground"}`}
              id="status"
              aria-live="polite"
            >
              {status}
            </div>
          </CardContent>
        </Card>
        {!isPersonalized && selectedTicket !== null && getTicketDetails(selectedTicket) && (
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
        {!isPersonalized && (
          <Dialog open={notFoundDialogOpen} onOpenChange={(open) => setNotFoundDialogOpen(open)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>
                  <T text={t("ticketNotFoundTitle")} />
                </DialogTitle>
                <DialogDescription>
                  <T text={t("ticketNotFoundMessage")} />
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 flex justify-end">
                <Button variant="outline" onClick={() => setNotFoundDialogOpen(false)}>
                  <T text={t("close")} />
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>
    </ScrambleOnLanguageChange>
  );
};
