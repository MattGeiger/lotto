// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import { TicketCalledCelebration } from "@/components/ticket-called-celebration";
import { LanguageProvider } from "@/contexts/language-context";
import { writePersistedHomepageTicket } from "@/lib/home-ticket-storage";
import type { RaffleState } from "@/lib/state-types";

const renderCelebration = (ui: ReactElement) => render(<LanguageProvider>{ui}</LanguageProvider>);

const confettiFireMock = vi.fn();

vi.mock("react-canvas-confetti", () => ({
  default: ({ onInit }: { onInit?: ({ confetti }: { confetti: (...args: unknown[]) => void }) => void }) => {
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
      data-testid="inventory-realtime-canary"
      data-polled-revision={polledRevision ?? undefined}
    />
  ) : null,
}));

const realtimeCanary = {
  agencyId: "william-temple-house",
  eventsUrl:
    "wss://lotto-realtime-beta.et2-geiger.workers.dev/v1/agencies/william-temple-house/events",
};

const baseState: RaffleState = {
  startNumber: 10,
  endNumber: 30,
  mode: "random",
  generatedOrder: [14, 18, 24],
  currentlyServing: 24,
  ticketStatus: {},
  calledAt: {},
  orderLocked: true,
  timestamp: 1_739_898_000_000,
  displayUrl: null,
  operatingHours: null,
  timezone: "America/Los_Angeles",
  displayLanguageRotation: null,
        announcement: null,
};

const calledState: RaffleState = { ...baseState, calledAt: { 24: 1_739_898_060_000 } };

describe("TicketCalledCelebration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    confettiFireMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing when there is no saved ticket", () => {
    const { container } = renderCelebration(<TicketCalledCelebration state={calledState} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Ticket Called!")).not.toBeInTheDocument();
  });

  it("renders nothing when the saved ticket has not been called", () => {
    writePersistedHomepageTicket(24, new Date(), {
      startNumber: baseState.startNumber,
      endNumber: baseState.endNumber,
    });

    renderCelebration(<TicketCalledCelebration state={baseState} />);
    expect(screen.queryByText("Ticket Called!")).not.toBeInTheDocument();
  });

  it("shows the overlay and fires confetti when the saved ticket is called", async () => {
    writePersistedHomepageTicket(24, new Date(), {
      startNumber: baseState.startNumber,
      endNumber: baseState.endNumber,
    });

    renderCelebration(<TicketCalledCelebration state={calledState} />);

    expect(await screen.findByText("Ticket Called!")).toBeInTheDocument();
    expect(screen.getByText("Please Check-in")).toBeInTheDocument();
    expect(screen.getByTestId("confetti-canvas")).toBeInTheDocument();
    await waitFor(() => {
      expect(confettiFireMock).toHaveBeenCalled();
    });
  });

  it("does not re-celebrate the same call after a remount (cross-page dedup)", async () => {
    writePersistedHomepageTicket(24, new Date(), {
      startNumber: baseState.startNumber,
      endNumber: baseState.endNumber,
    });

    const first = renderCelebration(<TicketCalledCelebration state={calledState} />);
    expect(await screen.findByText("Ticket Called!")).toBeInTheDocument();
    first.unmount();

    // Simulate navigating to another page: a fresh mount observing the same call.
    renderCelebration(<TicketCalledCelebration state={calledState} />);
    expect(screen.queryByText("Ticket Called!")).not.toBeInTheDocument();
  });

  it("self-polls /api/state when poll is set", async () => {
    writePersistedHomepageTicket(24, new Date(), {
      startNumber: baseState.startNumber,
      endNumber: baseState.endNumber,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(calledState), {
        status: 200,
        headers: { "x-lotto-state-revision": "23" },
      })),
    );

    renderCelebration(
      <TicketCalledCelebration poll realtimeCanary={realtimeCanary} />,
    );

    expect(await screen.findByText("Ticket Called!")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/state", { cache: "no-store" });
    expect(screen.getByTestId("inventory-realtime-canary")).toHaveAttribute(
      "data-polled-revision",
      "23",
    );
  });
});
