"use client";

import * as React from "react";
import ReactCanvasConfetti from "react-canvas-confetti";

import { ARCADE_TICKET_CALLED_EVENT } from "@/arcade/lib/events";
import { useLanguage } from "@/contexts/language-context";
import { readPersistedHomepageTicket } from "@/lib/home-ticket-storage";
import { getPollingIntervalMs } from "@/lib/polling-strategy";
import type { OperatingHours, TicketStatus } from "@/lib/state-types";

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

const formatArcadeWait = (minutes: number): string => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours}h ${mins}m`;
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
  const { t } = useLanguage();
  const [currentlyServing, setCurrentlyServing] = React.useState<number | null>(null);
  const [lastPayload, setLastPayload] = React.useState<ServingPayload>({
    currentlyServing: null,
    generatedOrder: [],
    ticketStatus: {},
    calledAt: {},
  });
  const [ticketNumber, setTicketNumber] = React.useState<number | null>(null);
  const [isServingAlert, setIsServingAlert] = React.useState(false);
  const pollTimeoutRef = React.useRef<number | null>(null);
  const servingAlertTimeoutRef = React.useRef<number | null>(null);
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
    },
    [clearServingAlertTimeout],
  );

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
  const bannerLabel = isTicketTrackingEnabled ? t("arcadeEstimatedWaitLabel") : t("nowServing");
  const bannerValue = isTicketTrackingEnabled
    ? ticketWaitDetails
      ? formatArcadeWait(ticketWaitDetails.estimatedWaitMinutes)
      : UNKNOWN_WAIT_TEXT
    : currentlyServing === null
      ? t("waiting").toUpperCase()
      : `#${currentlyServing}`;
  const isAnimatedServingAlert = isServingAlert;

  React.useEffect(() => {
    if (!hasBannerSnapshotRef.current) {
      hasBannerSnapshotRef.current = true;
      previousBannerValueRef.current = bannerValue;
      return;
    }

    const previousBannerValue = previousBannerValueRef.current;
    previousBannerValueRef.current = bannerValue;
    if (previousBannerValue === bannerValue) {
      return;
    }

    setIsServingAlert(true);
    clearServingAlertTimeout();
    servingAlertTimeoutRef.current = window.setTimeout(() => {
      setIsServingAlert(false);
      servingAlertTimeoutRef.current = null;
    }, SERVING_ALERT_DURATION_MS);
  }, [bannerValue, clearServingAlertTimeout]);

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
    scheduleConfetti(() => {
      fireConfetti();
    });
  }, [calledAt, fireConfetti, ticketNumber]);

  return (
    <>
      <header className="arcade-banner sticky top-0 z-50">
        <div className="arcade-banner-row mx-auto flex w-full max-w-6xl items-center justify-center gap-3 px-4 py-3 sm:px-6">
          <span className="arcade-retro text-base text-[var(--arcade-dot)] sm:text-lg">
            {bannerLabel}
          </span>
          <span className="arcade-serving-value-shell">
            <span
              className={`arcade-retro arcade-serving-value text-3xl sm:text-5xl${
                isAnimatedServingAlert ? " arcade-serving-value-alert" : ""
              }`}
              aria-live="polite"
            >
              <span className={isAnimatedServingAlert ? "arcade-serving-value-pulse" : ""}>
                {bannerValue}
              </span>
            </span>
          </span>
        </div>
      </header>
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
