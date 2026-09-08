// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RealtimeCanaryObserver from "@/components/realtime-canary-observer";
import { buildPublicStateEnvelope } from "@/lib/realtime/public-state-protocol";
import { defaultState } from "@/lib/state-types";

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

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closeCode: number | undefined;
  closeReason: string | undefined;

  constructor(url: string | URL) {
    this.url = url.toString();
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  message(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  close(code?: number, reason?: string) {
    this.closeCode = code;
    this.closeReason = reason;
    this.emitClose();
  }

  emitClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

const stateAt = (timestamp: number) => ({
  ...structuredClone(defaultState),
  startNumber: 1,
  endNumber: 3,
  generatedOrder: [1, 2, 3],
  currentlyServing: 2,
  timestamp,
});

const envelopeFor = (state: ReturnType<typeof stateAt>, revision = 1) =>
  buildPublicStateEnvelope({
    agencyId: config.agencyId,
    revision,
    state,
    publicationId: "965104d8-44a2-41b7-b7d0-d82d9c9d3a50",
    committedAt: "2026-09-01T18:00:00.000Z",
    publishedAt: new Date().toISOString(),
  });

const flushAsyncState = () => new Promise<void>((resolve) => {
  window.setTimeout(resolve, 0);
});

describe("RealtimeCanaryObserver", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.__LOTTO_REALTIME_CANARY__;
  });

  it("compares a valid pushed envelope without fetching or creating a second socket", async () => {
    const state = stateAt(Date.parse("2026-09-01T18:00:00.000Z"));
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <RealtimeCanaryObserver
          config={config}
          polledState={state}
          polledRevision={7}
        />,
      );
      await flushAsyncState();
    });
    const socket = FakeWebSocket.instances[0];

    expect(socket.url).toBe(config.eventsUrl);
    act(() => socket.open());
    const envelope = await envelopeFor(state, 7);
    await act(async () => {
      socket.message(JSON.stringify(envelope));
      await flushAsyncState();
    });

    await waitFor(() => {
      expect(screen.getByTestId("realtime-canary-observer")).toHaveAttribute(
        "data-comparison",
        "matched",
      );
    });
    expect(window.__LOTTO_REALTIME_CANARY__).toMatchObject({
      connection: "connected",
      comparison: "matched",
      hubRevision: 7,
      polledRevision: 7,
      messagesReceived: 1,
      deliveryLatencyMs: null,
    });
    expect(fetch).not.toHaveBeenCalled();

    const initialConvergence = window.__LOTTO_REALTIME_CANARY__?.convergenceMs;
    await act(async () => {
      view.rerender(
        <RealtimeCanaryObserver
          config={config}
          polledState={structuredClone(state)}
          polledRevision={7}
        />,
      );
      await flushAsyncState();
    });
    expect(window.__LOTTO_REALTIME_CANARY__?.convergenceMs).toBe(initialConvergence);

    await act(async () => {
      view.rerender(
        <RealtimeCanaryObserver
          config={config}
          polledState={stateAt(state.timestamp! + 1)}
          polledRevision={7}
        />,
      );
      await flushAsyncState();
    });
    await waitFor(() => {
      expect(window.__LOTTO_REALTIME_CANARY__?.comparison).toBe("mismatch");
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();

    const broadcastEnvelope = await envelopeFor(state, 8);
    await act(async () => {
      socket.message(JSON.stringify(broadcastEnvelope));
      await flushAsyncState();
    });
    expect(window.__LOTTO_REALTIME_CANARY__).toMatchObject({
      hubRevision: 8,
      polledRevision: 7,
      comparison: "hub-ahead",
      messagesReceived: 2,
      deliveryLatencyMs: expect.any(Number),
    });

    await act(async () => {
      view.rerender(
        <RealtimeCanaryObserver
          config={config}
          polledState={stateAt(state.timestamp! + 2)}
          polledRevision={9}
        />,
      );
      await flushAsyncState();
    });
    await waitFor(() => {
      expect(window.__LOTTO_REALTIME_CANARY__).toMatchObject({
        hubRevision: 8,
        polledRevision: 9,
        comparison: "poll-ahead",
      });
    });

    view.unmount();
    expect(window.__LOTTO_REALTIME_CANARY__).toBeUndefined();
  });

  it("rejects a checksummed envelope whose state was tampered with", async () => {
    const state = stateAt(Date.parse("2026-09-01T18:00:00.000Z"));
    await act(async () => {
      render(
        <RealtimeCanaryObserver
          config={config}
          polledState={state}
          polledRevision={1}
        />,
      );
      await flushAsyncState();
    });
    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());
    const envelope = await envelopeFor(state);

    await act(async () => {
      socket.message(JSON.stringify({
        ...envelope,
        state: { ...envelope.state, currentlyServing: 3 },
      }));
      await flushAsyncState();
    });

    await waitFor(() => {
      expect(screen.getByTestId("realtime-canary-observer")).toHaveAttribute(
        "data-connection",
        "invalid",
      );
    });
    expect(socket.closeCode).toBe(1008);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("pauses while hidden and resumes with one fresh socket when visible", () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    render(
      <RealtimeCanaryObserver
        config={config}
        polledState={null}
        polledRevision={null}
      />,
    );
    const firstSocket = FakeWebSocket.instances[0];
    act(() => firstSocket.open());

    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(firstSocket.closeReason).toBe("Canary paused while hidden.");
    expect(screen.getByTestId("realtime-canary-observer")).toHaveAttribute(
      "data-connection",
      "paused",
    );

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("stops after five bounded reconnect attempts", async () => {
    vi.useFakeTimers();
    render(
      <RealtimeCanaryObserver
        config={config}
        polledState={null}
        polledRevision={null}
      />,
    );

    for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000]) {
      act(() => FakeWebSocket.instances.at(-1)?.emitClose());
      await act(async () => vi.advanceTimersByTimeAsync(delay));
    }
    expect(FakeWebSocket.instances).toHaveLength(6);

    act(() => FakeWebSocket.instances.at(-1)?.emitClose());
    expect(screen.getByTestId("realtime-canary-observer")).toHaveAttribute(
      "data-connection",
      "exhausted",
    );
    await act(async () => vi.runOnlyPendingTimersAsync());
    expect(FakeWebSocket.instances).toHaveLength(6);
  });
});
