"use client";

import * as React from "react";

type ServingPayload = {
  currentlyServing?: number | null;
  timestamp?: number | null;
};

const POLL_INTERVAL_MS = 15_000;

export function NowServingBanner() {
  const [currentlyServing, setCurrentlyServing] = React.useState<number | null>(null);

  const loadNowServing = React.useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load current serving ticket.");
      }
      const payload = (await response.json()) as ServingPayload;
      setCurrentlyServing(
        typeof payload.currentlyServing === "number" ? payload.currentlyServing : null,
      );
    } catch {
      // Keep last good value visible when polling fails.
    }
  }, []);

  React.useEffect(() => {
    void loadNowServing();

    const intervalId = window.setInterval(() => {
      void loadNowServing();
    }, POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadNowServing();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadNowServing]);

  const nowServingText = currentlyServing === null ? "PENDING" : `#${currentlyServing}`;

  return (
    <header className="arcade-banner sticky top-0 z-50">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-3 px-4 py-3 sm:px-6">
        <span className="arcade-retro text-[10px] text-[var(--arcade-dot)] sm:text-xs">
          Now Serving
        </span>
        <span
          className="arcade-retro text-lg text-[var(--arcade-ghost)] sm:text-2xl"
          aria-live="polite"
        >
          {nowServingText}
        </span>
      </div>
    </header>
  );
}
