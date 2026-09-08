// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RealtimeSourceCanary from "@/components/realtime-source-canary";
import { buildPublicStateEnvelope } from "@/lib/realtime/public-state-protocol";
import { defaultState, type RaffleState } from "@/lib/state-types";

const config = {
  agencyId: "william-temple-house",
  eventsUrl:
    "wss://lotto-realtime-beta.et2-geiger.workers.dev/v1/agencies/william-temple-house/events",
};

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closeCode: number | undefined;

  constructor(readonly url: string | URL) {
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  message(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  close(code?: number) {
    this.closeCode = code;
    this.emitClose();
  }

  emitClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

const stateAt = (currentlyServing: number, timestamp: number): RaffleState => ({
  ...structuredClone(defaultState),
  startNumber: 1,
  endNumber: 3,
  generatedOrder: [1, 2, 3],
  currentlyServing,
  timestamp,
});

const envelopeFor = (state: RaffleState, revision: number) =>
  buildPublicStateEnvelope({
    agencyId: config.agencyId,
    revision,
    state,
    publicationId: crypto.randomUUID(),
    committedAt: new Date(state.timestamp ?? Date.now()).toISOString(),
    publishedAt: new Date().toISOString(),
  });

const flush = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

describe("RealtimeSourceCanary", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.__LOTTO_REALTIME_SOURCE_CANARY__;
  });

  it("requires an exact polled handshake, applies the next revision, and falls back on close", async () => {
    const state1 = stateAt(1, Date.parse("2026-09-01T18:00:00.000Z"));
    const state2 = stateAt(2, Date.parse("2026-09-01T18:00:01.000Z"));
    const onState = vi.fn();
    const onAuthorityChange = vi.fn();
    await act(async () => {
      render(
        <RealtimeSourceCanary
          config={config}
          polledState={state1}
          polledRevision={1}
          onState={onState}
          onAuthorityChange={onAuthorityChange}
        />,
      );
      await flush();
    });
    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());
    const initial = await envelopeFor(state1, 1);
    await act(async () => {
      socket.message(JSON.stringify(initial));
      await flush();
    });
    await waitFor(() => {
      expect(screen.getByTestId("realtime-source-status")).toHaveAttribute("data-authority", "live");
    });
    expect(onAuthorityChange).toHaveBeenLastCalledWith(true, "handshake");
    expect(onState).not.toHaveBeenCalled();

    const update = await envelopeFor(state2, 2);
    await act(async () => {
      socket.message(JSON.stringify(update));
      await flush();
    });
    expect(onState).toHaveBeenCalledWith(expect.objectContaining({ currentlyServing: 2 }), 2);
    expect(window.__LOTTO_REALTIME_SOURCE_CANARY__).toMatchObject({
      authority: "live",
      revision: 2,
      appliedCount: 1,
    });

    act(() => socket.emitClose());
    expect(onAuthorityChange).toHaveBeenLastCalledWith(false, "close");
    expect(screen.getByTestId("realtime-source-status")).toHaveAttribute("data-authority", "fallback");
  });

  it("rejects tampering and revokes authority on a revision gap", async () => {
    const state1 = stateAt(1, Date.parse("2026-09-01T18:00:00.000Z"));
    const onAuthorityChange = vi.fn();
    await act(async () => {
      render(
        <RealtimeSourceCanary
          config={config}
          polledState={state1}
          polledRevision={1}
          onState={vi.fn()}
          onAuthorityChange={onAuthorityChange}
        />,
      );
      await flush();
    });
    const socket = FakeWebSocket.instances[0];
    const initial = await envelopeFor(state1, 1);
    await act(async () => {
      socket.message(JSON.stringify(initial));
      await flush();
    });
    const gap = await envelopeFor(stateAt(3, state1.timestamp! + 2), 3);
    await act(async () => {
      socket.message(JSON.stringify(gap));
      await flush();
    });
    expect(onAuthorityChange).toHaveBeenLastCalledWith(false, "revision-gap");

    const tampered = { ...gap, state: { ...gap.state, currentlyServing: 2 } };
    await act(async () => {
      socket.message(JSON.stringify(tampered));
      await flush();
    });
    expect(socket.closeCode).toBe(1008);
    expect(onAuthorityChange).toHaveBeenLastCalledWith(false, "invalid");
  });

  it("pauses hidden work and requests a foreground resync before reconnecting", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const onAuthorityChange = vi.fn();
    render(
      <RealtimeSourceCanary
        config={config}
        polledState={null}
        polledRevision={null}
        onState={vi.fn()}
        onAuthorityChange={onAuthorityChange}
      />,
    );
    const socket = FakeWebSocket.instances[0];

    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByTestId("realtime-source-status")).toHaveAttribute("data-authority", "paused");

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(onAuthorityChange).toHaveBeenLastCalledWith(false, "foreground");
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it("attempts its initial connection when navigator.onLine is stale and follows network events", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const onAuthorityChange = vi.fn();
    render(
      <RealtimeSourceCanary
        config={config}
        polledState={null}
        polledRevision={null}
        onState={vi.fn()}
        onAuthorityChange={onAuthorityChange}
      />,
    );

    expect(FakeWebSocket.instances).toHaveLength(1);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(onAuthorityChange).toHaveBeenLastCalledWith(false, "offline");
    expect(FakeWebSocket.instances[0].readyState).toBe(FakeWebSocket.CLOSED);

    act(() => window.dispatchEvent(new Event("online")));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("falls back on handshake timeout and reconnects with bounded jittered backoff", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const onAuthorityChange = vi.fn();
    render(
      <RealtimeSourceCanary
        config={config}
        polledState={null}
        polledRevision={null}
        onState={vi.fn()}
        onAuthorityChange={onAuthorityChange}
      />,
    );
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(onAuthorityChange).toHaveBeenLastCalledWith(false, "timeout");
    expect(screen.getByTestId("realtime-source-status")).toHaveAttribute("data-reason", "timeout");
    expect(FakeWebSocket.instances).toHaveLength(1);

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
