"use client";

import * as React from "react";

import {
  classifyMotionTier,
  isMotionTier,
  MOTION_TIER_STORAGE_KEY,
  type MotionTier,
} from "@/lib/motion-tier";

const PROBE_FRAME_COUNT = 20;

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
};

type FrameStats = {
  avgFrameMs: number | null;
  p95FrameMs: number | null;
};

const getReducedMotionQuery = () =>
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

const readStoredTier = (): MotionTier | null => {
  try {
    const value = window.localStorage.getItem(MOTION_TIER_STORAGE_KEY);
    return isMotionTier(value) ? value : null;
  } catch {
    return null;
  }
};

const writeStoredTier = (tier: MotionTier) => {
  try {
    window.localStorage.setItem(MOTION_TIER_STORAGE_KEY, tier);
  } catch {
    // ignore storage write failures
  }
};

const computeFrameStats = (timestamps: number[]): FrameStats => {
  if (timestamps.length < 2) {
    return { avgFrameMs: null, p95FrameMs: null };
  }

  const deltas = timestamps
    .slice(1)
    .map((value, index) => value - timestamps[index])
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!deltas.length) {
    return { avgFrameMs: null, p95FrameMs: null };
  }

  const avgFrameMs = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const sorted = [...deltas].sort((a, b) => a - b);
  const p95Index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.95) - 1),
  );
  const p95FrameMs = sorted[p95Index];

  return { avgFrameMs, p95FrameMs };
};

/**
 * Keep first paint deterministic across SSR and client hydration.
 * Runtime preferences/storage are applied in an effect after mount.
 */
const getInitialTier = (): MotionTier => "simple";

export function useMotionTier() {
  const [tier, setTier] = React.useState<MotionTier>(() => getInitialTier());

  React.useEffect(() => {
    const mediaQuery = getReducedMotionQuery();
    let cancelled = false;
    let rafId: number | null = null;
    let probeRunId = 0;

    const cancelProbe = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const applyTier = (nextTier: MotionTier, persist: boolean) => {
      if (cancelled) return;
      setTier(nextTier);
      if (persist) {
        writeStoredTier(nextTier);
      }
    };

    const runProbe = () => {
      const currentRunId = ++probeRunId;
      const timestamps: number[] = [];

      const step = (timestamp: number) => {
        if (cancelled || currentRunId !== probeRunId) return;
        timestamps.push(timestamp);
        if (timestamps.length < PROBE_FRAME_COUNT + 1) {
          rafId = window.requestAnimationFrame(step);
          return;
        }

        const { avgFrameMs, p95FrameMs } = computeFrameStats(timestamps);
        const nav = window.navigator as NavigatorWithHints;
        const nextTier = classifyMotionTier({
          prefersReducedMotion: mediaQuery?.matches ?? false,
          avgFrameMs,
          p95FrameMs,
          hardwareConcurrency:
            typeof nav.hardwareConcurrency === "number"
              ? nav.hardwareConcurrency
              : null,
          deviceMemoryGb:
            typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
        });
        applyTier(nextTier, true);
      };

      cancelProbe();
      rafId = window.requestAnimationFrame(step);
    };

    const evaluate = () => {
      if (mediaQuery?.matches) {
        applyTier("off", false);
        cancelProbe();
        return;
      }

      const stored = readStoredTier();
      if (stored) {
        applyTier(stored, false);
        return;
      }

      runProbe();
    };

    evaluate();

    const handleMotionPreferenceChange = () => {
      evaluate();
    };

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleMotionPreferenceChange);
      } else {
        mediaQuery.addListener(handleMotionPreferenceChange);
      }
    }

    return () => {
      cancelled = true;
      cancelProbe();
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", handleMotionPreferenceChange);
        } else {
          mediaQuery.removeListener(handleMotionPreferenceChange);
        }
      }
    };
  }, []);

  return tier;
}
