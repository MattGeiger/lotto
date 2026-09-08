// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

"use client";

import * as React from "react";

import {
  isRealtimeCanaryCohort,
  isRealtimePollingOnlyCohort,
  isRealtimeSourceCanaryCohort,
  type RealtimeCanaryClientConfig,
} from "@/lib/realtime/client-canary-config";
import type { RealtimeSourceReason } from "@/hooks/use-realtime-source-canary";
import type { PublicRaffleState } from "@/lib/realtime/public-state-protocol";
import type { RaffleState } from "@/lib/state-types";

const RealtimeCanaryObserver = React.lazy(
  () => import("@/components/realtime-canary-observer"),
);
const RealtimeSourceCanary = React.lazy(
  () => import("@/components/realtime-source-canary"),
);

export default function RealtimeCanaryMount({
  config,
  sourceConfig = null,
  polledState,
  polledRevision,
  onSourceState,
  onSourceAuthorityChange,
}: {
  config: RealtimeCanaryClientConfig | null;
  sourceConfig?: RealtimeCanaryClientConfig | null;
  polledState: RaffleState | null;
  polledRevision: number | null;
  onSourceState?: (state: PublicRaffleState, revision: number) => void;
  onSourceAuthorityChange?: (authoritative: boolean, reason: RealtimeSourceReason) => void;
}) {
  const [selected, setSelected] = React.useState<"observe" | "source" | null>(null);

  React.useEffect(() => {
    const search = window.location.search;
    if (isRealtimePollingOnlyCohort(search)) {
      setSelected(null);
      return;
    }
    if (config && isRealtimeCanaryCohort(search)) {
      setSelected("observe");
      return;
    }
    const realtimeMode = new URLSearchParams(search).get("realtime");
    if (
      sourceConfig
      && (realtimeMode === null || isRealtimeSourceCanaryCohort(search))
    ) {
      setSelected("source");
      return;
    }
    setSelected(null);
  }, [config, sourceConfig]);

  if (selected === "source" && sourceConfig && onSourceState && onSourceAuthorityChange) {
    return (
      <React.Suspense fallback={null}>
        <RealtimeSourceCanary
          config={sourceConfig}
          polledState={polledState}
          polledRevision={polledRevision}
          onState={onSourceState}
          onAuthorityChange={onSourceAuthorityChange}
        />
      </React.Suspense>
    );
  }

  if (selected !== "observe" || !config) return null;

  return (
    <React.Suspense fallback={null}>
      <RealtimeCanaryObserver
        config={config}
        polledState={polledState}
        polledRevision={polledRevision}
      />
    </React.Suspense>
  );
}
