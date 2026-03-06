"use client";

import * as React from "react";
import ReactCanvasConfetti from "react-canvas-confetti";

import { ARCADE_PLAY_RESUMED_EVENT, ARCADE_TICKET_CALLED_EVENT } from "@/arcade/lib/events";
import { useLanguage } from "@/contexts/language-context";
import { readPersistedHomepageTicket } from "@/lib/home-ticket-storage";
import { getPollingIntervalMs } from "@/lib/polling-strategy";
import type { OperatingHours, TicketStatus } from "@/lib/state-types";
import { formatWaitTimeAsHoursAndMinutes } from "@/lib/time-format";
import { cn } from "@/lib/utils";

type ServingPayload = {
  currentlyServing?: number | null;
  generatedOrder?: number[] | null;
  ticketStatus?: Record<number, TicketStatus> | null;
  calledAt?: Record<number, number> | null;
  timestamp?: number | null;
  operatingHours?: OperatingHours | null;
  timezone?: string | null;
};

const POLL_ERROR_RETRY_MS = 30_000;
const BURST_DURATION_MS = 2 * 60_000;
const SERVING_ALERT_DURATION_MS = 5000;
const CALLED_ALERT_DURATION_MS = 10_000;
const CALLED_CONFETTI_INTERVAL_MS = 2_000;
const CALLED_OVERLAY_VIEWPORT_PADDING_PX = 16;
const MIN_CALLED_OVERLAY_SCALE = 0.72;
const MINUTES_PER_SHOPPER = 2.2;
const UNKNOWN_WAIT_TEXT = "--h --m";

type ConfettiAnimationOptions = {
  spread?: number;
  startVelocity?: number;
  decay?: number;
  scalar?: number;
};

type ConfettiInstance = (
  options: ConfettiAnimationOptions & {
    origin: { y: number };
    particleCount: number;
  },
) => void;

type TicketWaitDetails = {
  estimatedWaitMinutes: number;
  calledAt: number | null;
};

const getTicketWaitDetails = (
  payload: ServingPayload,
  ticketNumber: number,
): TicketWaitDetails | null => {
  const generatedOrder = Array.isArray(payload.generatedOrder) ? payload.generatedOrder : [];
  if (generatedOrder.length === 0) {
    return null;
  }

  const ticketIndex = generatedOrder.indexOf(ticketNumber);
  if (ticketIndex === -1) {
    return null;
  }

  const ticketStatus = payload.ticketStatus ?? {};
  const calledAt = typeof payload.calledAt?.[ticketNumber] === "number" ? payload.calledAt[ticketNumber] : null;
  if (ticketStatus[ticketNumber] === "returned") {
    return {
      estimatedWaitMinutes: 0,
      calledAt,
    };
  }

  const servingIndex =
    typeof payload.currentlyServing === "number"
      ? generatedOrder.indexOf(payload.currentlyServing)
      : -1;
  const ticketsAhead =
    servingIndex === -1
      ? generatedOrder
          .slice(0, ticketIndex)
          .filter((ticket) => ticketStatus[ticket] !== "returned").length
      : ticketIndex <= servingIndex
        ? 0
        : generatedOrder
            .slice(servingIndex, ticketIndex)
            .filter((ticket) => ticketStatus[ticket] !== "returned").length;

  return {
    estimatedWaitMinutes: Math.max(0, Math.round(ticketsAhead * MINUTES_PER_SHOPPER)),
    calledAt,
  };
};

export function NowServingBanner() {
  const { t, language } = useLanguage();
  const [currentlyServing, setCurrentlyServing] = React.useState<number | null>(null);
  const [lastPayload, setLastPayload] = React.useState<ServingPayload>({
    currentlyServing: null,
    generatedOrder: [],
    ticketStatus: {},
    calledAt: {},
  });
  const [ticketNumber, setTicketNumber] = React.useState<number | null>(null);
  const [servingAlertMode, setServingAlertMode] = React.useState<"idle" | "update" | "called">("idle");
  const [servingAlertShiftX, setServingAlertShiftX] = React.useState(0);
  const [servingAlertShiftY, setServingAlertShiftY] = React.useState(20);
  const [calledOverlayScale, setCalledOverlayScale] = React.useState(1.36);
  const pollTimeoutRef = React.useRef<number | null>(null);
  const servingAlertTimeoutRef = React.useRef<number | null>(null);
  const servingAnchorRef = React.useRef<HTMLSpanElement | null>(null);
  const servingValueRef = React.useRef<HTMLSpanElement | null>(null);
  const calledOverlayRef = React.useRef<HTMLDivElement | null>(null);
  const confettiLoopIntervalRef = React.useRef<number | null>(null);
  const confettiLoopTimeoutRef = React.useRef<number | null>(null);
  const confettiInstanceRef = React.useRef<ConfettiInstance | null>(null);
  const celebratedCallRef = React.useRef<string | null>(null);
  const pollStateRef = React.useRef<() => void>(() => {});
  const lastSeenTimestampRef = React.useRef<number | null>(null);
  const lastChangeAtRef = React.useRef<number | null>(null);
  const burstUntilRef = React.useRef<number | null>(null);
  const hasBannerSnapshotRef = React.useRef(false);
  const previousBannerValueRef = React.useRef<string | null>(null);

  const clearPollTimeout = React.useCallback(() => {
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const clearServingAlertTimeout = React.useCallback(() => {
    if (servingAlertTimeoutRef.current !== null) {
      window.clearTimeout(servingAlertTimeoutRef.current);
      servingAlertTimeoutRef.current = null;
    }
  }, []);

  const clearConfettiLoop = React.useCallback(() => {
    if (confettiLoopIntervalRef.current !== null) {
      window.clearInterval(confettiLoopIntervalRef.current);
      confettiLoopIntervalRef.current = null;
    }
    if (confettiLoopTimeoutRef.current !== null) {
      window.clearTimeout(confettiLoopTimeoutRef.current);
      confettiLoopTimeoutRef.current = null;
    }
  }, []);

  const updateServingAlertShift = React.useCallback((alertMode: "update" | "called") => {
    const targetElement =
      alertMode === "called"
        ? servingAnchorRef.current
        : servingValueRef.current;
    if (!targetElement) {
      setServingAlertShiftX(0);
      setServingAlertShiftY(alertMode === "called" ? 0 : 20);
      return;
    }

    const valueRect = targetElement.getBoundingClientRect();
    const valueCenterX = valueRect.left + valueRect.width / 2;
    const viewportCenterX = window.innerWidth / 2;
    const valueCenterY = valueRect.top + valueRect.height / 2;
    const viewportCenterY = window.innerHeight / 2;
    setServingAlertShiftX(Math.round(viewportCenterX - valueCenterX));
    setServingAlertShiftY(
      alertMode === "called" ? Math.round(viewportCenterY - valueCenterY) : 20,
    );
  }, []);

  const getDefaultCalledOverlayScale = React.useCallback(
    (isLargeLocale: boolean) => (isLargeLocale ? 1.28 : 1.36),
    [],
  );

  const updateCalledOverlayScale = React.useCallback(
    (isLargeLocale: boolean) => {
      const baseScale = getDefaultCalledOverlayScale(isLargeLocale);
      const calledOverlayElement = calledOverlayRef.current;
      if (!calledOverlayElement) {
        setCalledOverlayScale(baseScale);
        return;
      }

      const contentWidth = calledOverlayElement.offsetWidth;
      const contentHeight = calledOverlayElement.offsetHeight;
      if (contentWidth <= 0 || contentHeight <= 0) {
        setCalledOverlayScale(baseScale);
        return;
      }

      const maxWidth = Math.max(1, window.innerWidth - CALLED_OVERLAY_VIEWPORT_PADDING_PX * 2);
      const maxHeight = Math.max(1, window.innerHeight - CALLED_OVERLAY_VIEWPORT_PADDING_PX * 2);
      const widthScale = maxWidth / contentWidth;
      const heightScale = maxHeight / contentHeight;
      const fittedScale = Math.min(baseScale, widthScale, heightScale);
      const nextScale = Math.max(
        MIN_CALLED_OVERLAY_SCALE,
        Number.isFinite(fittedScale) ? fittedScale : baseScale,
      );

      setCalledOverlayScale((previousScale) =>
        Math.abs(previousScale - nextScale) > 0.01 ? nextScale : previousScale,
      );
    },
    [getDefaultCalledOverlayScale],
  );

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

    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load current serving ticket.");
      }
      const payload = (await response.json()) as ServingPayload;
      const nextServing = typeof payload.currentlyServing === "number" ? payload.currentlyServing : null;
      const nextTicketNumber = readPersistedHomepageTicket(Date.now());
      setCurrentlyServing(nextServing);
      setLastPayload(payload);
      setTicketNumber(nextTicketNumber);

      const nowMs = Date.now();
      const nextTimestamp =
        typeof payload.timestamp === "number" ? payload.timestamp : nowMs;
      const changeDetected =
        lastSeenTimestampRef.current === null ||
        lastSeenTimestampRef.current !== nextTimestamp;
      lastSeenTimestampRef.current = nextTimestamp;

      if (changeDetected) {
        lastChangeAtRef.current = nowMs;
        burstUntilRef.current = nowMs + BURST_DURATION_MS;
      }

      const { delayMs } = getPollingIntervalMs({
        now: new Date(nowMs),
        lastChangeAt: lastChangeAtRef.current,
        burstUntil: burstUntilRef.current,
        operatingHours: payload.operatingHours ?? null,
        timeZone: payload.timezone ?? null,
      });
      scheduleNextPoll(delayMs);
    } catch {
      // Keep last good value visible when polling fails.
      scheduleNextPoll(POLL_ERROR_RETRY_MS);
    }
  }, [clearPollTimeout, scheduleNextPoll]);

  React.useEffect(() => {
    pollStateRef.current = pollState;
  }, [pollState]);

  React.useEffect(
    () => () => {
      clearServingAlertTimeout();
      clearConfettiLoop();
    },
    [clearConfettiLoop, clearServingAlertTimeout],
  );

  React.useEffect(() => {
    const onPlayResumed = () => {
      clearServingAlertTimeout();
      setServingAlertMode("idle");
      clearConfettiLoop();
    };
    window.addEventListener(ARCADE_PLAY_RESUMED_EVENT, onPlayResumed as EventListener);
    return () => {
      window.removeEventListener(ARCADE_PLAY_RESUMED_EVENT, onPlayResumed as EventListener);
    };
  }, [clearConfettiLoop, clearServingAlertTimeout]);

  React.useEffect(() => {
    void pollState();

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearPollTimeout();
        return;
      }
      lastSeenTimestampRef.current = null;
      lastChangeAtRef.current = null;
      burstUntilRef.current = null;
      void pollState();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearPollTimeout();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [clearPollTimeout, pollState]);

  const ticketWaitDetails = React.useMemo(
    () => (ticketNumber === null ? null : getTicketWaitDetails(lastPayload, ticketNumber)),
    [lastPayload, ticketNumber],
  );
  const calledAt = ticketWaitDetails?.calledAt ?? null;
  const isTicketTrackingEnabled = ticketNumber !== null;
  const isCalledBannerState = isTicketTrackingEnabled && calledAt !== null;
  const isLargeBannerLocale = language === "ar" || language === "fa" || language === "zh";
  const defaultCalledOverlayScale = getDefaultCalledOverlayScale(isLargeBannerLocale);
  const calledBannerTitle = t("arcadeTicketCalledTitle");
  const calledBannerBody = t("arcadePleaseCheckIn");
  const calledBannerNowServingLabel = `${t("nowServing")}:`;
  const bannerLabel = isTicketTrackingEnabled ? t("arcadeEstimatedWaitLabel") : t("nowServing");
  const bannerValue = isTicketTrackingEnabled
    ? ticketWaitDetails
      ? formatWaitTimeAsHoursAndMinutes(ticketWaitDetails.estimatedWaitMinutes, language)
      : UNKNOWN_WAIT_TEXT
    : currentlyServing === null
      ? t("waiting").toUpperCase()
      : `#${currentlyServing}`;
  const calledBannerNowServingValue =
    currentlyServing === null ? t("waiting").toUpperCase() : `#${currentlyServing}`;
  const bannerAlertKey = isCalledBannerState
    ? `${calledBannerTitle}|${calledBannerBody}`
    : `${bannerLabel}|${bannerValue}`;
  const isAnimatedServingAlert = servingAlertMode !== "idle";

  React.useEffect(() => {
    setCalledOverlayScale(defaultCalledOverlayScale);
  }, [defaultCalledOverlayScale]);

  React.useEffect(() => {
    if (!hasBannerSnapshotRef.current) {
      hasBannerSnapshotRef.current = true;
      previousBannerValueRef.current = bannerAlertKey;
      return;
    }

    const previousBannerValue = previousBannerValueRef.current;
    previousBannerValueRef.current = bannerAlertKey;
    if (previousBannerValue === bannerAlertKey) {
      return;
    }

    const nextAlertMode: "update" | "called" = isCalledBannerState ? "called" : "update";
    updateServingAlertShift(nextAlertMode);
    setServingAlertMode(nextAlertMode);
    clearServingAlertTimeout();
    servingAlertTimeoutRef.current = window.setTimeout(() => {
      setServingAlertMode("idle");
      servingAlertTimeoutRef.current = null;
    }, nextAlertMode === "called" ? CALLED_ALERT_DURATION_MS : SERVING_ALERT_DURATION_MS);
  }, [bannerAlertKey, clearServingAlertTimeout, isCalledBannerState, updateServingAlertShift]);

  React.useEffect(() => {
    if (!isCalledBannerState || servingAlertMode !== "called") {
      return;
    }

    const scheduleScaleUpdate = () => {
      updateCalledOverlayScale(isLargeBannerLocale);
    };
    const rafId = window.requestAnimationFrame(scheduleScaleUpdate);
    window.addEventListener("resize", scheduleScaleUpdate);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && calledOverlayRef.current) {
      resizeObserver = new ResizeObserver(scheduleScaleUpdate);
      resizeObserver.observe(calledOverlayRef.current);
    }

    let isCancelled = false;
    const fontSet = document.fonts;
    if (fontSet) {
      void fontSet.ready.then(() => {
        if (!isCancelled) {
          scheduleScaleUpdate();
        }
      });
    }

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleScaleUpdate);
      resizeObserver?.disconnect();
    };
  }, [
    calledBannerBody,
    calledBannerTitle,
    isCalledBannerState,
    isLargeBannerLocale,
    servingAlertMode,
    updateCalledOverlayScale,
  ]);

  const getConfettiInstance = React.useCallback(
    ({ confetti }: { confetti: ConfettiInstance }) => {
      confettiInstanceRef.current = confetti;
    },
    [],
  );

  const makeConfettiShot = React.useCallback(
    (
      particleRatio: number,
      options: ConfettiAnimationOptions,
    ) => {
      if (!confettiInstanceRef.current) return;
      confettiInstanceRef.current({
        ...options,
        origin: { y: 0.7 },
        particleCount: Math.floor(200 * particleRatio),
      });
    },
    [],
  );

  const fireConfetti = React.useCallback(() => {
    makeConfettiShot(0.25, { spread: 26, startVelocity: 55 });
    makeConfettiShot(0.2, { spread: 60 });
    makeConfettiShot(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    makeConfettiShot(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    makeConfettiShot(0.1, { spread: 120, startVelocity: 45 });
  }, [makeConfettiShot]);

  React.useEffect(() => {
    if (ticketNumber === null || calledAt === null) {
      return;
    }

    const celebrationKey = `${ticketNumber}:${calledAt}`;
    if (celebratedCallRef.current === celebrationKey) {
      return;
    }
    celebratedCallRef.current = celebrationKey;
    window.dispatchEvent(
      new CustomEvent(ARCADE_TICKET_CALLED_EVENT, {
        detail: {
          ticketNumber,
          calledAt,
        },
      }),
    );
    const scheduleConfetti =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
    const triggerConfetti = () => {
      scheduleConfetti(() => {
        fireConfetti();
      });
    };
    clearConfettiLoop();
    triggerConfetti();
    confettiLoopIntervalRef.current = window.setInterval(triggerConfetti, CALLED_CONFETTI_INTERVAL_MS);
    confettiLoopTimeoutRef.current = window.setTimeout(() => {
      clearConfettiLoop();
    }, CALLED_ALERT_DURATION_MS);
  }, [calledAt, clearConfettiLoop, fireConfetti, ticketNumber]);

  React.useEffect(() => {
    if (isCalledBannerState) {
      return;
    }
    clearConfettiLoop();
  }, [clearConfettiLoop, isCalledBannerState]);

  return (
    <>
      <header className="arcade-banner sticky top-0 z-50">
        <div className="arcade-banner-row mx-auto flex w-full max-w-6xl items-center justify-center gap-3 px-4 py-3 sm:px-6">
          <span
            className={cn(
              isCalledBannerState
                ? "arcade-retro text-base text-[var(--arcade-dot)] sm:text-lg"
                : isTicketTrackingEnabled
                  ? "arcade-ui max-w-[17.5rem] text-center text-[11px] tracking-[0.08em] text-[var(--arcade-dot)] sm:max-w-none sm:text-sm"
                  : "arcade-retro text-base text-[var(--arcade-dot)] sm:text-lg",
              isLargeBannerLocale
                ? isCalledBannerState
                  ? "text-[32px] leading-tight sm:text-[36px]"
                  : isTicketTrackingEnabled
                    ? "text-[22px] leading-tight sm:text-[28px]"
                    : "text-[32px] leading-tight sm:text-[36px]"
                : null,
            )}
          >
            {isCalledBannerState ? calledBannerNowServingLabel : bannerLabel}
          </span>
          <span ref={servingAnchorRef} className="arcade-serving-value-shell">
            {isCalledBannerState ? (
              <span
                className={cn(
                  "arcade-serving-value arcade-retro text-3xl sm:text-5xl",
                  isLargeBannerLocale ? "text-[3.75rem] leading-none sm:text-[6rem]" : null,
                )}
                aria-live="polite"
              >
                {calledBannerNowServingValue}
              </span>
            ) : (
              <span
                ref={servingValueRef}
                className={cn(
                  "arcade-serving-value",
                  isTicketTrackingEnabled
                    ? "arcade-serving-value-estimated arcade-ui text-lg uppercase sm:text-2xl"
                    : "arcade-retro text-3xl sm:text-5xl",
                  isLargeBannerLocale
                    ? isTicketTrackingEnabled
                      ? "text-[2.25rem] leading-tight sm:text-[3rem]"
                      : "text-[3.75rem] leading-none sm:text-[6rem]"
                    : null,
                  servingAlertMode === "update" ? "arcade-serving-value-alert" : null,
                )}
                style={
                  {
                    "--arcade-serving-alert-shift-x": `${servingAlertShiftX}px`,
                    "--arcade-serving-alert-shift-y": `${servingAlertShiftY}px`,
                  } as React.CSSProperties
                }
                aria-live="polite"
              >
                <span className={isAnimatedServingAlert ? "arcade-serving-value-pulse" : ""}>
                  {bannerValue}
                </span>
              </span>
            )}
          </span>
        </div>
      </header>
      {isCalledBannerState && servingAlertMode === "called" ? (
        <div
          className={cn(
            "arcade-serving-called-overlay",
            servingAlertMode === "called" ? "arcade-serving-called-overlay-active" : null,
          )}
          aria-live="polite"
        >
          <div
            ref={calledOverlayRef}
            className={cn(
              "arcade-serving-called-overlay-copy arcade-ui",
              isLargeBannerLocale ? "text-[clamp(1.5rem,5.4vw,2.4rem)]" : "text-[clamp(1.2rem,4.6vw,2rem)]",
              servingAlertMode === "called" ? "arcade-serving-value-alert-called" : null,
            )}
            style={
              {
                "--arcade-serving-alert-shift-x": `${servingAlertShiftX}px`,
                "--arcade-serving-alert-shift-y": `${servingAlertShiftY}px`,
                "--arcade-serving-called-scale": calledOverlayScale.toFixed(3),
              } as React.CSSProperties
            }
          >
            <span
              className={cn(
                "arcade-serving-value-called-copy",
                isAnimatedServingAlert ? "arcade-serving-value-pulse" : null,
              )}
            >
              <span>{calledBannerTitle}</span>
              <span>{calledBannerBody}</span>
            </span>
          </div>
        </div>
      ) : null}
      <ReactCanvasConfetti
        onInit={getConfettiInstance}
        style={{
          position: "fixed",
          pointerEvents: "none",
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
          zIndex: 60,
        }}
      />
    </>
  );
}
