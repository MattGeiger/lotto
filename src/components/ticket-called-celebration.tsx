// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

"use client";

import * as React from "react";
import ReactCanvasConfetti from "react-canvas-confetti";

import RealtimeCanaryMount from "@/components/realtime-canary-mount";
import { useLanguage } from "@/contexts/language-context";
import { readPersistedHomepageTicket } from "@/lib/home-ticket-storage";
import {
  getPollingIntervalMs,
  recordPollingStateObservation,
} from "@/lib/polling-strategy";
import type { RealtimeCanaryClientConfig } from "@/lib/realtime/client-canary-config";
import { readPolledStateRevision } from "@/lib/realtime/polled-state-revision";
import { toRenderableRaffleState, type PublicRaffleState } from "@/lib/realtime/public-state-protocol";
import type { RealtimeSourceReason } from "@/hooks/use-realtime-source-canary";
import type { RaffleState } from "@/lib/state-types";
import {
  CALLED_ALERT_DURATION_MS,
  CALLED_CONFETTI_INTERVAL_MS,
  buildCelebrationKey,
  hasCelebratedCall,
  markCelebratedCall,
} from "@/lib/ticket-celebration";

const POLL_ERROR_RETRY_MS = 30_000;

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

type TicketCalledCelebrationProps = {
  /**
   * Raffle state to observe. Pass the already-polled state from a parent that
   * polls anyway (e.g. `ReadOnlyDisplay` on the homepage / display board) to
   * avoid a second network loop. Ignored when `poll` is set.
   */
  state?: RaffleState | null;
  /**
   * Self-poll `/api/state` instead of receiving state from a parent. Use on
   * routes that do not otherwise poll (e.g. the inventory page).
   */
  poll?: boolean;
  /**
   * Explicit ticket to watch. Pass on the homepage (where the number lives in
   * React state) so the celebration fires the instant a just-entered number is
   * already called, without waiting for the next poll. When omitted, the saved
   * homepage ticket is read from storage (used by the display board / inventory).
   */
  ticketNumber?: number | null;
  /** Beta-only observer configuration for a route using this component's poll. */
  realtimeCanary?: RealtimeCanaryClientConfig | null;
  /** Beta-only realtime-source configuration for a route using this component's poll. */
  realtimeSourceCanary?: RealtimeCanaryClientConfig | null;
};

/**
 * Self-contained "your ticket was called" celebration: a full-screen overlay
 * plus a looping confetti burst, fired once per call. Reads the client's saved
 * homepage ticket and watches `calledAt` for it. Renders nothing when there is
 * no saved ticket (so a shared wall-mounted `/display` never celebrates — it has
 * no session ticket). Dedup is persisted across navigation via
 * `lib/ticket-celebration` so the same call never re-fires when the user moves
 * between pages.
 */
export function TicketCalledCelebration({
  state: stateProp,
  poll = false,
  ticketNumber: ticketNumberProp,
  realtimeCanary = null,
  realtimeSourceCanary = null,
}: TicketCalledCelebrationProps) {
  const { t } = useLanguage();
  const polled = useSelfPolledState(poll);
  const state = poll ? polled.state : stateProp ?? null;
  const realtimeObserver = poll ? (
    <RealtimeCanaryMount
      config={realtimeCanary}
      sourceConfig={realtimeSourceCanary}
      polledState={polled.verificationState}
      polledRevision={polled.verificationRevision}
      onSourceState={polled.onSourceState}
      onSourceAuthorityChange={polled.onSourceAuthorityChange}
    />
  ) : null;

  const [showCalledOverlay, setShowCalledOverlay] = React.useState(false);
  const confettiInstanceRef = React.useRef<ConfettiInstance | null>(null);
  const confettiLoopIntervalRef = React.useRef<number | null>(null);
  const confettiLoopTimeoutRef = React.useRef<number | null>(null);
  const celebratedCallRef = React.useRef<string | null>(null);

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

  const getConfettiInstance = React.useCallback(({ confetti }: { confetti: ConfettiInstance }) => {
    confettiInstanceRef.current = confetti;
  }, []);

  const makeConfettiShot = React.useCallback((particleRatio: number, options: ConfettiAnimationOptions) => {
    if (!confettiInstanceRef.current) return;
    confettiInstanceRef.current({
      ...options,
      origin: { y: 0.7 },
      particleCount: Math.floor(200 * particleRatio),
    });
  }, []);

  const fireConfetti = React.useCallback(() => {
    makeConfettiShot(0.25, { spread: 26, startVelocity: 55 });
    makeConfettiShot(0.2, { spread: 60 });
    makeConfettiShot(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    makeConfettiShot(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    makeConfettiShot(0.1, { spread: 120, startVelocity: 45 });
  }, [makeConfettiShot]);

  React.useEffect(() => () => clearConfettiLoop(), [clearConfettiLoop]);

  // Driven off each state update. `readPersistedHomepageTicket` (and `Date.now`)
  // run here, not in render, so the component stays pure: the saved ticket is
  // re-read on every poll so range/expiry resets drop a stale ticket.
  React.useEffect(() => {
    const ticketContext = state ? { startNumber: state.startNumber, endNumber: state.endNumber } : null;
    // Prefer an explicitly supplied ticket (homepage); otherwise read the saved
    // ticket from storage (display board / inventory).
    const ticketNumber =
      ticketNumberProp !== undefined
        ? ticketNumberProp
        : state
          ? readPersistedHomepageTicket(Date.now(), ticketContext)
          : null;
    const calledAt =
      ticketNumber !== null && ticketNumber !== undefined ? state?.calledAt?.[ticketNumber] ?? null : null;

    if (ticketNumber === null || ticketNumber === undefined || calledAt === null) {
      // No active call (none yet, or operator reset) — drop any open overlay.
      setShowCalledOverlay(false);
      clearConfettiLoop();
      return;
    }

    const celebrationKey = buildCelebrationKey(ticketNumber, calledAt);
    // In-memory guard (same mount) + cross-page guard (sessionStorage).
    if (celebratedCallRef.current === celebrationKey || hasCelebratedCall(celebrationKey)) return;
    celebratedCallRef.current = celebrationKey;
    markCelebratedCall(celebrationKey);

    setShowCalledOverlay(true);
    clearConfettiLoop();

    const scheduleConfetti =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
    const triggerConfetti = () => {
      scheduleConfetti(() => {
        fireConfetti();
      });
    };

    triggerConfetti();
    confettiLoopIntervalRef.current = window.setInterval(triggerConfetti, CALLED_CONFETTI_INTERVAL_MS);
    confettiLoopTimeoutRef.current = window.setTimeout(() => {
      setShowCalledOverlay(false);
      clearConfettiLoop();
    }, CALLED_ALERT_DURATION_MS);
  }, [state, ticketNumberProp, clearConfettiLoop, fireConfetti]);

  if (!showCalledOverlay) return realtimeObserver;

  return (
    <>
      {realtimeObserver}
      <div className="pointer-events-none fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm" />
      <div
        className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center px-6"
        aria-live="polite"
      >
        <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card/95 px-8 py-6 text-center shadow-2xl">
          <p className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            {t("ticketCalledTitle")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground/90 sm:text-3xl">
            {t("ticketCalledCheckIn")}
          </p>
        </div>
      </div>
      <ReactCanvasConfetti
        onInit={getConfettiInstance}
        style={{
          position: "fixed",
          pointerEvents: "none",
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
          zIndex: 75,
        }}
      />
    </>
  );
}

/**
 * Lightweight `/api/state` poller for routes without an existing poll loop.
 * Mirrors `ReadOnlyDisplay`'s cadence (operating-hours aware, with a post-change
 * burst) so the inventory page reacts to a call about as fast as the board does.
 * Returns `null` and stays idle when `enabled` is false.
 */
function useSelfPolledState(enabled: boolean): {
  state: RaffleState | null;
  verificationState: RaffleState | null;
  verificationRevision: number | null;
  onSourceState: (state: PublicRaffleState, revision: number) => void;
  onSourceAuthorityChange: (authoritative: boolean, reason: RealtimeSourceReason) => void;
} {
  const [state, setState] = React.useState<RaffleState | null>(null);
  const [verificationState, setVerificationState] = React.useState<RaffleState | null>(null);
  const [verificationRevision, setVerificationRevision] = React.useState<number | null>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const pollRef = React.useRef<() => void>(() => {});
  const stateRef = React.useRef<RaffleState | null>(null);
  const sourceAuthoritativeRef = React.useRef(false);
  const pollInFlightRef = React.useRef(false);
  const lastSeenTimestampRef = React.useRef<number | null>(null);
  const lastChangeAtRef = React.useRef<number | null>(null);
  const burstUntilRef = React.useRef<number | null>(null);

  const clearPollTimeout = React.useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
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
      timeoutRef.current = window.setTimeout(() => {
        void pollRef.current();
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
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load state");
      const payload = (await response.json()) as RaffleState;
      stateRef.current = payload;
      setState(payload);
      const nextRevision = readPolledStateRevision(response.headers);
      setVerificationState(payload);
      setVerificationRevision(nextRevision);

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
    } catch {
      scheduleNextPoll(POLL_ERROR_RETRY_MS);
    } finally {
      pollInFlightRef.current = false;
    }
  }, [clearPollTimeout, recordStateActivity, scheduleNextPoll]);

  const onSourceState = React.useCallback((publicState: PublicRaffleState) => {
    const payload = toRenderableRaffleState(publicState, stateRef.current);
    recordStateActivity(payload.timestamp);
    stateRef.current = payload;
    setState(payload);
  }, [recordStateActivity]);

  const onSourceAuthorityChange = React.useCallback((authoritative: boolean) => {
    sourceAuthoritativeRef.current = authoritative;
    clearPollTimeout();
    if (!authoritative && document.visibilityState !== "hidden") {
      void pollRef.current();
    }
  }, [clearPollTimeout]);

  React.useEffect(() => {
    pollRef.current = pollState;
  }, [pollState]);

  React.useEffect(() => {
    if (!enabled) return;
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
  }, [clearPollTimeout, enabled, pollState]);

  return enabled
    ? {
        state,
        verificationState,
        verificationRevision,
        onSourceState,
        onSourceAuthorityChange,
      }
    : {
        state: null,
        verificationState: null,
        verificationRevision: null,
        onSourceState,
        onSourceAuthorityChange,
      };
}
