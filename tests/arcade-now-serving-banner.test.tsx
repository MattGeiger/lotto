import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ARCADE_TICKET_CALLED_EVENT } from "@/arcade/lib/events";
import { NowServingBanner } from "@/arcade/components/now-serving-banner";
import { LanguageProvider } from "@/contexts/language-context";
import { HOMEPAGE_TICKET_STORAGE_KEY } from "@/lib/home-ticket-storage";
import type { OperatingHours, TicketStatus } from "@/lib/state-types";

const confettiFireMock = vi.fn();

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

type BannerPayload = {
  currentlyServing: number | null;
  generatedOrder: number[];
  ticketStatus: Record<number, TicketStatus>;
  calledAt: Record<number, number>;
  timestamp: number;
  operatingHours: OperatingHours | null;
  timezone: string;
};

function renderBanner() {
  return render(
    <LanguageProvider>
      <NowServingBanner />
    </LanguageProvider>,
  );
}

describe("NowServingBanner", () => {
  let payload: BannerPayload;

  beforeEach(() => {
    window.localStorage.clear();
    confettiFireMock.mockReset();

    payload = {
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
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );
  });

  it("keeps NOW SERVING behavior when no ticket is stored", async () => {
    renderBanner();

    expect(await screen.findByText("Now Serving")).toBeInTheDocument();
    expect(await screen.findByText("#14")).toBeInTheDocument();
  });

  it("shows estimated wait in #h #m format when ticket is stored", async () => {
    window.localStorage.setItem(
      HOMEPAGE_TICKET_STORAGE_KEY,
      JSON.stringify({
        ticketNumber: 24,
        expiresAt: Date.now() + 60_000,
        savedAt: Date.now(),
      }),
    );

    renderBanner();

    expect(await screen.findByText("ESTIMATED WAIT")).toBeInTheDocument();
    expect(await screen.findByText("0h 4m")).toBeInTheDocument();
  });

  it("dispatches pause event and triggers confetti when the ticket is called", async () => {
    window.localStorage.setItem(
      HOMEPAGE_TICKET_STORAGE_KEY,
      JSON.stringify({
        ticketNumber: 24,
        expiresAt: Date.now() + 60_000,
        savedAt: Date.now(),
      }),
    );
    payload.calledAt = { 24: Date.now() };

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    renderBanner();

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
  });
});
