// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

"use client";

import * as React from "react";

import {
  hashPublicState,
  publicStateEnvelopeSchema,
  toPublicRaffleState,
  type PublicStateEnvelope,
} from "@/lib/realtime/public-state-protocol";
import type { RealtimeCanaryClientConfig } from "@/lib/realtime/client-canary-config";
import type { RaffleState } from "@/lib/state-types";

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 16_000;

export type RealtimeCanaryConnection =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "paused"
  | "invalid"
  | "exhausted";

export type RealtimeCanaryComparison =
  | "waiting"
  | "matched"
  | "hub-ahead"
  | "poll-ahead"
  | "mismatch";

export type RealtimeCanaryTelemetry = {
  connection: RealtimeCanaryConnection;
  comparison: RealtimeCanaryComparison;
  hubRevision: number | null;
  polledRevision: number | null;
  hubChecksum: string | null;
  polledChecksum: string | null;
  messagesReceived: number;
  reconnectCount: number;
  deliveryLatencyMs: number | null;
  convergenceMs: number | null;
  updatedAt: string;
};

declare global {
  interface Window {
    __LOTTO_REALTIME_CANARY__?: RealtimeCanaryTelemetry;
  }
}

const initialTelemetry = (): RealtimeCanaryTelemetry => ({
  connection: "connecting",
  comparison: "waiting",
  hubRevision: null,
  polledRevision: null,
  hubChecksum: null,
  polledChecksum: null,
  messagesReceived: 0,
  reconnectCount: 0,
  deliveryLatencyMs: null,
  convergenceMs: null,
  updatedAt: new Date().toISOString(),
});

const compareState = ({
  hubChecksum,
  hubRevision,
  hubTimestamp,
  hubReceivedAt,
  polledChecksum,
  polledRevision,
  polledTimestamp,
  existingConvergenceMs,
}: {
  hubChecksum: string | null;
  hubRevision: number | null;
  hubTimestamp: number | null;
  hubReceivedAt: number | null;
  polledChecksum: string | null;
  polledRevision: number | null;
  polledTimestamp: number | null;
  existingConvergenceMs: number | null;
}): Pick<RealtimeCanaryTelemetry, "comparison" | "convergenceMs"> => {
  if (!hubChecksum || !polledChecksum) {
    return { comparison: "waiting", convergenceMs: null };
  }
  if (hubRevision !== null && polledRevision !== null) {
    if (hubRevision > polledRevision) {
      return { comparison: "hub-ahead", convergenceMs: null };
    }
    if (hubRevision < polledRevision) {
      return { comparison: "poll-ahead", convergenceMs: null };
    }
  }
  if (hubChecksum === polledChecksum) {
    return {
      comparison: "matched",
      convergenceMs:
        existingConvergenceMs
        ?? (hubReceivedAt === null ? null : Math.max(0, Date.now() - hubReceivedAt)),
    };
  }
  if (
    hubTimestamp !== null
    && polledTimestamp !== null
    && hubTimestamp > polledTimestamp
  ) {
    return { comparison: "hub-ahead", convergenceMs: null };
  }
  return { comparison: "mismatch", convergenceMs: null };
};

const withUpdatedAt = (
  telemetry: Omit<RealtimeCanaryTelemetry, "updatedAt">,
): RealtimeCanaryTelemetry => ({ ...telemetry, updatedAt: new Date().toISOString() });

export const useRealtimeCanary = (
  config: RealtimeCanaryClientConfig,
  polledState: RaffleState | null,
  polledRevision: number | null,
): RealtimeCanaryTelemetry => {
  const [telemetry, setTelemetry] = React.useState<RealtimeCanaryTelemetry>(initialTelemetry);
  const socketRef = React.useRef<WebSocket | null>(null);
  const reconnectTimerRef = React.useRef<number | null>(null);
  const reconnectAttemptRef = React.useRef(0);
  const polledChecksumRef = React.useRef<string | null>(null);
  const polledRevisionRef = React.useRef<number | null>(null);
  const polledTimestampRef = React.useRef<number | null>(null);
  const hubEnvelopeRef = React.useRef<PublicStateEnvelope | null>(null);
  const hubReceivedAtRef = React.useRef<number | null>(null);
  const hubConvergenceRef = React.useRef<{ revision: number; ms: number } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const timestamp = typeof polledState?.timestamp === "number" ? polledState.timestamp : null;
    polledTimestampRef.current = timestamp;
    polledRevisionRef.current = polledRevision;

    if (!polledState) {
      polledChecksumRef.current = null;
      setTelemetry((current) => withUpdatedAt({
        ...current,
        polledChecksum: null,
        polledRevision,
        comparison: "waiting",
        convergenceMs: null,
      }));
      return () => {
        cancelled = true;
      };
    }

    void hashPublicState(toPublicRaffleState(polledState)).then((checksum) => {
      if (cancelled) return;
      polledChecksumRef.current = checksum;
      const hub = hubEnvelopeRef.current;
      const comparison = compareState({
        hubChecksum: hub?.checksum ?? null,
        hubRevision: hub?.revision ?? null,
        hubTimestamp: typeof hub?.state.timestamp === "number" ? hub.state.timestamp : null,
        hubReceivedAt: hubReceivedAtRef.current,
        polledChecksum: checksum,
        polledRevision,
        polledTimestamp: timestamp,
        existingConvergenceMs:
          hub && hubConvergenceRef.current?.revision === hub.revision
            ? hubConvergenceRef.current.ms
            : null,
      });
      if (hub && comparison.comparison === "matched" && comparison.convergenceMs !== null) {
        hubConvergenceRef.current = {
          revision: hub.revision,
          ms: comparison.convergenceMs,
        };
      }
      setTelemetry((current) => withUpdatedAt({
        ...current,
        polledChecksum: checksum,
        polledRevision,
        ...comparison,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [polledRevision, polledState]);

  React.useEffect(() => {
    let disposed = false;
    let terminalInvalid = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (disposed || terminalInvalid || document.visibilityState === "hidden") return;
      const existing = socketRef.current;
      if (existing && (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)) {
        return;
      }

      clearReconnectTimer();
      setTelemetry((current) => withUpdatedAt({
        ...current,
        connection: reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting",
      }));

      const socket = new WebSocket(config.eventsUrl);
      socketRef.current = socket;
      let messagesOnSocket = 0;

      const scheduleReconnect = () => {
        if (disposed || terminalInvalid || document.visibilityState === "hidden") return;
        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setTelemetry((current) => withUpdatedAt({ ...current, connection: "exhausted" }));
          return;
        }
        const delay = Math.min(
          RECONNECT_BASE_MS * (2 ** reconnectAttemptRef.current),
          RECONNECT_MAX_MS,
        );
        reconnectAttemptRef.current += 1;
        setTelemetry((current) => withUpdatedAt({
          ...current,
          connection: "reconnecting",
          reconnectCount: reconnectAttemptRef.current,
        }));
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      socket.onopen = () => {
        if (disposed || socketRef.current !== socket) return;
        setTelemetry((current) => withUpdatedAt({ ...current, connection: "connected" }));
      };

      socket.onmessage = (event) => {
        if (disposed || socketRef.current !== socket || typeof event.data !== "string") return;
        void (async () => {
          let json: unknown;
          try {
            json = JSON.parse(event.data);
          } catch {
            json = null;
          }
          const parsed = publicStateEnvelopeSchema.safeParse(json);
          if (
            !parsed.success
            || parsed.data.agencyId !== config.agencyId
            || (await hashPublicState(parsed.data.state)) !== parsed.data.checksum
          ) {
            terminalInvalid = true;
            setTelemetry((current) => withUpdatedAt({ ...current, connection: "invalid" }));
            socket.close(1008, "Invalid public-state envelope.");
            return;
          }
          if (disposed || socketRef.current !== socket) return;

          const envelope = parsed.data;
          const receivedAt = Date.now();
          const isInitialSnapshot = messagesOnSocket === 0;
          messagesOnSocket += 1;
          hubEnvelopeRef.current = envelope;
          hubReceivedAtRef.current = receivedAt;
          reconnectAttemptRef.current = 0;
          const comparison = compareState({
            hubChecksum: envelope.checksum,
            hubRevision: envelope.revision,
            hubTimestamp: typeof envelope.state.timestamp === "number" ? envelope.state.timestamp : null,
            hubReceivedAt: receivedAt,
            polledChecksum: polledChecksumRef.current,
            polledRevision: polledRevisionRef.current,
            polledTimestamp: polledTimestampRef.current,
            existingConvergenceMs:
              hubConvergenceRef.current?.revision === envelope.revision
                ? hubConvergenceRef.current.ms
                : null,
          });
          if (comparison.comparison === "matched" && comparison.convergenceMs !== null) {
            hubConvergenceRef.current = {
              revision: envelope.revision,
              ms: comparison.convergenceMs,
            };
          } else if (hubConvergenceRef.current?.revision !== envelope.revision) {
            hubConvergenceRef.current = null;
          }
          setTelemetry((current) => withUpdatedAt({
            ...current,
            connection: "connected",
            hubRevision: envelope.revision,
            hubChecksum: envelope.checksum,
            messagesReceived: current.messagesReceived + 1,
            deliveryLatencyMs: isInitialSnapshot
              ? null
              : Math.max(0, receivedAt - new Date(envelope.publishedAt).getTime()),
            ...comparison,
          }));
        })();
      };

      socket.onerror = () => {
        if (socketRef.current === socket) socket.close();
      };

      socket.onclose = () => {
        if (socketRef.current !== socket) return;
        socketRef.current = null;
        scheduleReconnect();
      };
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearReconnectTimer();
        const socket = socketRef.current;
        socketRef.current = null;
        socket?.close(1000, "Canary paused while hidden.");
        setTelemetry((current) => withUpdatedAt({ ...current, connection: "paused" }));
        return;
      }
      reconnectAttemptRef.current = 0;
      connect();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearReconnectTimer();
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close(1000, "Canary observer unmounted.");
    };
  }, [config.agencyId, config.eventsUrl]);

  React.useEffect(() => {
    window.__LOTTO_REALTIME_CANARY__ = telemetry;
    window.dispatchEvent(new CustomEvent("lotto:realtime-canary", { detail: telemetry }));
  }, [telemetry]);

  React.useEffect(() => {
    return () => {
      delete window.__LOTTO_REALTIME_CANARY__;
    };
  }, []);

  return telemetry;
};
