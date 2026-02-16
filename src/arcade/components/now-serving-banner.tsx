"use client";

import * as React from "react";

import { getPollingIntervalMs } from "@/lib/polling-strategy";
import type { OperatingHours } from "@/lib/state-types";

type ServingPayload = {
  currentlyServing?: number | null;
  timestamp?: number | null;
  operatingHours?: OperatingHours | null;
  timezone?: string | null;
};

const POLL_ERROR_RETRY_MS = 30_000;
const BURST_DURATION_MS = 2 * 60_000;
const SERVING_ALERT_DURATION_MS = 5000;

export function NowServingBanner() {
  const [currentlyServing, setCurrentlyServing] = React.useState<number | null>(null);
  const [isServingAlert, setIsServingAlert] = React.useState(false);
  const pollTimeoutRef = React.useRef<number | null>(null);
  const servingAlertTimeoutRef = React.useRef<number | null>(null);
  const pollStateRef = React.useRef<() => void>(() => {});
  const lastSeenTimestampRef = React.useRef<number | null>(null);
  const lastChangeAtRef = React.useRef<number | null>(null);
  const burstUntilRef = React.useRef<number | null>(null);
  const hasServingSnapshotRef = React.useRef(false);
  const previousServingRef = React.useRef<number | null>(null);

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
      setCurrentlyServing(
        typeof payload.currentlyServing === "number" ? payload.currentlyServing : null,
      );

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

  React.useEffect(() => {
    if (!hasServingSnapshotRef.current) {
      hasServingSnapshotRef.current = true;
      previousServingRef.current = currentlyServing;
      return;
    }

    const previousServing = previousServingRef.current;
    previousServingRef.current = currentlyServing;

    if (currentlyServing === null || previousServing === currentlyServing) {
      return;
    }

    setIsServingAlert(true);
    clearServingAlertTimeout();
    servingAlertTimeoutRef.current = window.setTimeout(() => {
      setIsServingAlert(false);
      servingAlertTimeoutRef.current = null;
    }, SERVING_ALERT_DURATION_MS);
  }, [clearServingAlertTimeout, currentlyServing]);

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

  const nowServingText = currentlyServing === null ? "PENDING" : `#${currentlyServing}`;

  return (
    <header className="arcade-banner sticky top-0 z-50">
      <div className="arcade-banner-row mx-auto flex w-full max-w-6xl items-center justify-center gap-3 px-4 py-3 sm:px-6">
        <span className="arcade-retro text-[10px] text-[var(--arcade-dot)] sm:text-xs">
          Now Serving
        </span>
        <span className="arcade-serving-value-shell">
          <span
            className={`arcade-retro arcade-serving-value text-lg sm:text-2xl${
              isServingAlert ? " arcade-serving-value-alert" : ""
            }`}
            aria-live="polite"
          >
            <span className={isServingAlert ? "arcade-serving-value-pulse" : ""}>
              {nowServingText}
            </span>
          </span>
        </span>
      </div>
    </header>
  );
}
