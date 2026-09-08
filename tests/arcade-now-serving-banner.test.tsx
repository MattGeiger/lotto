// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ARCADE_PLAY_RESUMED_EVENT, ARCADE_TICKET_CALLED_EVENT } from "@/arcade/lib/events";
import { NowServingBanner } from "@/arcade/components/now-serving-banner";
import { HapticsProvider } from "@/components/haptics-provider";
import { LanguageProvider } from "@/contexts/language-context";
import { HOMEPAGE_TICKET_STORAGE_KEY } from "@/lib/home-ticket-storage";
import type { OperatingHours, TicketStatus } from "@/lib/state-types";

const confettiFireMock = vi.fn();
const rawTriggerMock = vi.fn();

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({
    trigger: rawTriggerMock,
    cancel: vi.fn(),
    isSupported: true,
  }),
}));

vi.mock("react-canvas-confetti", () => ({
  default: ({
    onInit,
  }: {
    onInit?: ({ confetti }: { confetti: (...args: unknown[]) => void }) => void;
  }) => {
    onInit?.({ confetti: confettiFireMock });
    return <div data-testid="confetti-canvas" />;
  },
}));

vi.mock("@/components/realtime-canary-mount", () => ({
  default: ({
    config,
    polledRevision,
  }: {
    config: unknown;
    polledRevision: number | null;
  }) => config ? (
    <div
      data-testid="arcade-realtime-canary"
      data-polled-revision={polledRevision ?? undefined}
    />
  ) : null,
}));

const realtimeCanary = {
  agencyId: "william-temple-house",
  eventsUrl:
    "wss://lotto-realtime-beta.et2-geiger.workers.dev/v1/agencies/william-temple-house/events",
};

type BannerPayload = {
  startNumber: number;
  endNumber: number;
  currentlyServing: number | null;
  generatedOrder: number[];
  ticketStatus: Record<number, TicketStatus>;
  calledAt: Record<number, number>;
  timestamp: number;
  operatingHours: OperatingHours | null;
  timezone: string;
};

function renderBanner(config: typeof realtimeCanary | null = null) {
  return render(
    <HapticsProvider>
      <LanguageProvider>
        <NowServingBanner realtimeCanary={config} />
      </LanguageProvider>
    </HapticsProvider>,
  );
}

describe("NowServingBanner", () => {
  let payload: BannerPayload;

  beforeEach(() => {
    window.localStorage.clear();
    confettiFireMock.mockReset();
    rawTriggerMock.mockReset();

    payload = {
      startNumber: 10,
      endNumber: 40,
      currentlyServing: 14,
      generatedOrder: [14, 18, 24],
      ticketStatus: {},
      calledAt: {},
      timestamp: 1_739_898_000_000,
      operatingHours: null,
      timezone: "America/Los_Angeles",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "x-lotto-state-revision": "24" },
      })),
    );
  });

  it("keeps NOW SERVING behavior when no ticket is stored", async () => {
    renderBanner();

    expect(await screen.findByText("Now Serving")).toBeInTheDocument();
    expect(await screen.findByText("#14")).toBeInTheDocument();
  });

  it("forwards the existing poll state and exact revision to the beta observer", async () => {
    renderBanner(realtimeCanary);

    expect(await screen.findByText("#14")).toBeInTheDocument();
    expect(screen.getByTestId("arcade-realtime-canary")).toHaveAttribute(
      "data-polled-revision",
      "24",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shows estimated wait in #h #m format when ticket is stored", async () => {
    window.localStorage.setItem(
      HOMEPAGE_TICKET_STORAGE_KEY,
      JSON.stringify({
        ticketNumber: 24,
        expiresAt: Date.now() + 60_000,
        savedAt: Date.now(),
        rangeKey: "10-40",
      }),
    );

    renderBanner();

    expect(await screen.findByText("ESTIMATED WAIT")).toBeInTheDocument();
    expect(await screen.findByText("4 minutes")).toBeInTheDocument();
  });

  it("dispatches pause event and keeps called-ticket celebration visual-only on the web path", async () => {
    window.localStorage.setItem(
      HOMEPAGE_TICKET_STORAGE_KEY,
      JSON.stringify({
        ticketNumber: 24,
        expiresAt: Date.now() + 60_000,
        savedAt: Date.now(),
        rangeKey: "10-40",
      }),
    );
    payload.calledAt = { 24: Date.now() };

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    renderBanner();

    expect(await screen.findByText("TICKET CALLED!")).toBeInTheDocument();
    expect(await screen.findByText("PLEASE CHECK-IN")).toBeInTheDocument();
    expect(screen.queryByText("ESTIMATED WAIT")).not.toBeInTheDocument();
    expect(screen.getByText("Now Serving:")).toBeInTheDocument();
    expect(screen.getByText("#14")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        dispatchSpy.mock.calls.some(
          ([event]) => event.type === ARCADE_TICKET_CALLED_EVENT,
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(confettiFireMock).toHaveBeenCalled();
    });
    expect(rawTriggerMock).not.toHaveBeenCalled();

    const initialConfettiCalls = confettiFireMock.mock.calls.length;
    await waitFor(
      () => {
        expect(confettiFireMock.mock.calls.length).toBeGreaterThan(initialConfettiCalls);
      },
      { timeout: 3500 },
    );
    expect(rawTriggerMock).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(ARCADE_PLAY_RESUMED_EVENT));
    });
    await waitFor(() => {
      expect(screen.queryByText("TICKET CALLED!")).not.toBeInTheDocument();
      expect(screen.queryByText("PLEASE CHECK-IN")).not.toBeInTheDocument();
    });
  });
});
