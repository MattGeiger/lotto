// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

"use client";

import * as React from "react";

import { useRealtimeSourceCanary, type RealtimeSourceReason } from "@/hooks/use-realtime-source-canary";
import type { RealtimeCanaryClientConfig } from "@/lib/realtime/client-canary-config";
import type { PublicRaffleState } from "@/lib/realtime/public-state-protocol";
import type { RaffleState } from "@/lib/state-types";

const FALLBACK_LABELS: Record<RealtimeSourceReason, string> = {
  initial: "starting",
  handshake: "verifying",
  close: "connection closed",
  timeout: "connection timeout",
  invalid: "invalid update",
  "revision-gap": "revision gap",
  "revision-conflict": "revision conflict",
  offline: "offline",
  foreground: "resyncing",
  exhausted: "retries exhausted",
};

export default function RealtimeSourceCanary({
  config,
  polledState,
  polledRevision,
  onState,
  onAuthorityChange,
}: {
  config: RealtimeCanaryClientConfig;
  polledState: RaffleState | null;
  polledRevision: number | null;
  onState: (state: PublicRaffleState, revision: number) => void;
  onAuthorityChange: (authoritative: boolean, reason: RealtimeSourceReason) => void;
}) {
  const telemetry = useRealtimeSourceCanary({
    config,
    polledState,
    polledRevision,
    onState,
    onAuthorityChange,
  });
  const live = telemetry.authority === "live";

  return (
    <output
      data-testid="realtime-source-status"
      data-authority={telemetry.authority}
      data-connection={telemetry.connection}
      data-reason={telemetry.reason}
      data-revision={telemetry.revision ?? undefined}
      className="fixed bottom-3 right-3 z-[100] rounded-full border border-border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm"
    >
      {live
        ? `Realtime source · live${telemetry.revision ? ` · r${telemetry.revision}` : ""}`
        : telemetry.authority === "paused"
          ? "Realtime source · paused while hidden"
          : `Polling fallback · ${FALLBACK_LABELS[telemetry.reason]}`}
    </output>
  );
}
