// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

"use client";

import * as React from "react";

import type { RealtimeCanaryClientConfig } from "@/lib/realtime/client-canary-config";
import {
  hashPublicState,
  publicStateEnvelopeSchema,
  toPublicRaffleState,
  type PublicRaffleState,
  type PublicStateEnvelope,
} from "@/lib/realtime/public-state-protocol";
import type { RaffleState } from "@/lib/state-types";

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 16_000;
const HANDSHAKE_TIMEOUT_MS = 10_000;

export type RealtimeSourceReason =
  | "initial"
  | "handshake"
  | "close"
  | "timeout"
  | "invalid"
  | "revision-gap"
  | "revision-conflict"
  | "offline"
  | "foreground"
  | "exhausted";

export type RealtimeSourceTelemetry = {
  authority: "fallback" | "live" | "paused";
  connection: "connecting" | "connected" | "reconnecting" | "paused" | "invalid" | "exhausted";
  reason: RealtimeSourceReason;
  revision: number | null;
  messagesReceived: number;
  reconnectCount: number;
  appliedCount: number;
  updatedAt: string;
};

declare global {
  interface Window {
    __LOTTO_REALTIME_SOURCE_CANARY__?: RealtimeSourceTelemetry;
  }
}

const initialTelemetry = (): RealtimeSourceTelemetry => ({
  authority: "fallback",
  connection: "connecting",
  reason: "initial",
  revision: null,
  messagesReceived: 0,
  reconnectCount: 0,
  appliedCount: 0,
  updatedAt: new Date().toISOString(),
});

const updated = (
  telemetry: Omit<RealtimeSourceTelemetry, "updatedAt">,
): RealtimeSourceTelemetry => ({ ...telemetry, updatedAt: new Date().toISOString() });

export const useRealtimeSourceCanary = ({
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
}): RealtimeSourceTelemetry => {
  const [telemetry, setTelemetry] = React.useState<RealtimeSourceTelemetry>(initialTelemetry);
  const socketRef = React.useRef<WebSocket | null>(null);
  const reconnectTimerRef = React.useRef<number | null>(null);
  const handshakeTimerRef = React.useRef<number | null>(null);
  const reconnectAttemptRef = React.useRef(0);
  const offlineRef = React.useRef(false);
  const authorityRef = React.useRef(false);
  const authoritativeRevisionRef = React.useRef<number | null>(null);
  const authoritativeChecksumRef = React.useRef<string | null>(null);
  const polledRevisionRef = React.useRef<number | null>(polledRevision);
  const polledChecksumRef = React.useRef<string | null>(null);
  const hubEnvelopeRef = React.useRef<PublicStateEnvelope | null>(null);
  const onStateRef = React.useRef(onState);
  const onAuthorityChangeRef = React.useRef(onAuthorityChange);

  React.useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  React.useEffect(() => {
    onAuthorityChangeRef.current = onAuthorityChange;
  }, [onAuthorityChange]);

  const revokeAuthority = React.useCallback((reason: RealtimeSourceReason) => {
    const wasAuthoritative = authorityRef.current;
    authorityRef.current = false;
    authoritativeRevisionRef.current = null;
    authoritativeChecksumRef.current = null;
    setTelemetry((current) => updated({
      ...current,
      authority: document.visibilityState === "hidden" ? "paused" : "fallback",
      reason,
    }));
    if (wasAuthoritative || reason !== "initial") {
      onAuthorityChangeRef.current(false, reason);
    }
  }, []);

  const activateAuthority = React.useCallback((envelope: PublicStateEnvelope) => {
    authorityRef.current = true;
    authoritativeRevisionRef.current = envelope.revision;
    authoritativeChecksumRef.current = envelope.checksum;
    setTelemetry((current) => updated({
      ...current,
      authority: "live",
      connection: "connected",
      reason: "handshake",
      revision: envelope.revision,
    }));
    onAuthorityChangeRef.current(true, "handshake");
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    polledRevisionRef.current = polledRevision;
    if (!polledState) {
      polledChecksumRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    void hashPublicState(toPublicRaffleState(polledState)).then((checksum) => {
      if (cancelled) return;
      polledChecksumRef.current = checksum;
      const hub = hubEnvelopeRef.current;
      if (
        hub
        && hub.revision === polledRevisionRef.current
        && hub.checksum === checksum
        && !authorityRef.current
      ) {
        activateAuthority(hub);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activateAuthority, polledRevision, polledState]);

  React.useEffect(() => {
    let disposed = false;
    let terminalInvalid = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    const clearHandshakeTimer = () => {
      if (handshakeTimerRef.current !== null) {
        window.clearTimeout(handshakeTimerRef.current);
        handshakeTimerRef.current = null;
      }
    };

    const connect = () => {
      if (
        disposed
        || terminalInvalid
        || document.visibilityState === "hidden"
        || offlineRef.current
      ) return;
      const existing = socketRef.current;
      if (existing && (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)) {
        return;
      }

      clearReconnectTimer();
      clearHandshakeTimer();
      setTelemetry((current) => updated({
        ...current,
        connection: reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting",
      }));
      const socket = new WebSocket(config.eventsUrl);
      socketRef.current = socket;
      let closeReason: RealtimeSourceReason = "close";

      const scheduleReconnect = () => {
        if (
          disposed
          || terminalInvalid
          || document.visibilityState === "hidden"
          || offlineRef.current
        ) return;
        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          revokeAuthority("exhausted");
          setTelemetry((current) => updated({ ...current, connection: "exhausted" }));
          return;
        }
        const baseDelay = Math.min(
          RECONNECT_BASE_MS * (2 ** reconnectAttemptRef.current),
          RECONNECT_MAX_MS,
        );
        const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
        reconnectAttemptRef.current += 1;
        setTelemetry((current) => updated({
          ...current,
          connection: "reconnecting",
          reconnectCount: reconnectAttemptRef.current,
        }));
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      handshakeTimerRef.current = window.setTimeout(() => {
        if (disposed || socketRef.current !== socket) return;
        closeReason = "timeout";
        socket.close(1000, "Realtime handshake timed out.");
      }, HANDSHAKE_TIMEOUT_MS);

      socket.onopen = () => {
        if (disposed || socketRef.current !== socket) return;
        setTelemetry((current) => updated({ ...current, connection: "connected" }));
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
            clearHandshakeTimer();
            revokeAuthority("invalid");
            setTelemetry((current) => updated({ ...current, connection: "invalid" }));
            socket.close(1008, "Invalid public-state envelope.");
            return;
          }
          if (disposed || socketRef.current !== socket) return;

          clearHandshakeTimer();
          reconnectAttemptRef.current = 0;
          const envelope = parsed.data;
          hubEnvelopeRef.current = envelope;
          setTelemetry((current) => updated({
            ...current,
            connection: "connected",
            revision: envelope.revision,
            messagesReceived: current.messagesReceived + 1,
          }));

          if (!authorityRef.current) {
            if (
              envelope.revision === polledRevisionRef.current
              && envelope.checksum === polledChecksumRef.current
            ) {
              activateAuthority(envelope);
            } else {
              revokeAuthority("handshake");
            }
            return;
          }

          const currentRevision = authoritativeRevisionRef.current;
          const currentChecksum = authoritativeChecksumRef.current;
          if (envelope.revision === currentRevision && envelope.checksum === currentChecksum) return;
          if (currentRevision === null || envelope.revision !== currentRevision + 1) {
            revokeAuthority(
              envelope.revision === currentRevision ? "revision-conflict" : "revision-gap",
            );
            return;
          }

          authoritativeRevisionRef.current = envelope.revision;
          authoritativeChecksumRef.current = envelope.checksum;
          onStateRef.current(envelope.state, envelope.revision);
          setTelemetry((current) => updated({
            ...current,
            authority: "live",
            revision: envelope.revision,
            appliedCount: current.appliedCount + 1,
          }));
        })();
      };

      socket.onerror = () => {
        if (socketRef.current === socket) socket.close();
      };

      socket.onclose = () => {
        if (socketRef.current !== socket) return;
        socketRef.current = null;
        clearHandshakeTimer();
        if (!terminalInvalid) revokeAuthority(closeReason);
        scheduleReconnect();
      };
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearReconnectTimer();
        clearHandshakeTimer();
        const socket = socketRef.current;
        socketRef.current = null;
        authorityRef.current = false;
        authoritativeRevisionRef.current = null;
        authoritativeChecksumRef.current = null;
        socket?.close(1000, "Realtime source paused while hidden.");
        setTelemetry((current) => updated({
          ...current,
          authority: "paused",
          connection: "paused",
        }));
        return;
      }
      reconnectAttemptRef.current = 0;
      revokeAuthority("foreground");
      connect();
    };
    const handleOffline = () => {
      offlineRef.current = true;
      clearReconnectTimer();
      clearHandshakeTimer();
      revokeAuthority("offline");
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close(1000, "Browser offline.");
    };
    const handleOnline = () => {
      offlineRef.current = false;
      reconnectAttemptRef.current = 0;
      revokeAuthority("offline");
      connect();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      clearReconnectTimer();
      clearHandshakeTimer();
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close(1000, "Realtime source unmounted.");
      if (authorityRef.current) onAuthorityChangeRef.current(false, "close");
      authorityRef.current = false;
    };
  }, [activateAuthority, config.agencyId, config.eventsUrl, revokeAuthority]);

  React.useEffect(() => {
    window.__LOTTO_REALTIME_SOURCE_CANARY__ = telemetry;
    window.dispatchEvent(new CustomEvent("lotto:realtime-source-canary", { detail: telemetry }));
  }, [telemetry]);

  React.useEffect(() => () => {
    delete window.__LOTTO_REALTIME_SOURCE_CANARY__;
  }, []);

  return telemetry;
};
