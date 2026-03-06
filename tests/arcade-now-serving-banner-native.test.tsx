import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NowServingBanner } from "@/arcade/components/now-serving-banner";
import { LanguageProvider } from "@/contexts/language-context";
import { HOMEPAGE_TICKET_STORAGE_KEY } from "@/lib/home-ticket-storage";
import type { OperatingHours, TicketStatus } from "@/lib/state-types";

const confettiFireMock = vi.fn();
const triggerMock = vi.fn();

vi.mock("@/components/haptics-provider", () => ({
  HapticsProvider: ({ children }: { children: ReactNode }) => children,
  useAppHaptics: () => ({
    enabled: true,
    isNative: true,
    setEnabled: vi.fn(),
    trigger: triggerMock,
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

describe("NowServingBanner native haptics", () => {
  let payload: BannerPayload;

  beforeEach(() => {
    window.localStorage.clear();
    confettiFireMock.mockReset();
    triggerMock.mockReset();

    payload = {
      currentlyServing: 14,
      generatedOrder: [14, 18, 24],
      ticketStatus: {},
      calledAt: { 24: Date.now() },
      timestamp: 1_739_898_000_000,
      operatingHours: null,
      timezone: "America/Los_Angeles",
    };

    window.localStorage.setItem(
      HOMEPAGE_TICKET_STORAGE_KEY,
      JSON.stringify({
        ticketNumber: 24,
        expiresAt: Date.now() + 60_000,
        savedAt: Date.now(),
      }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );
  });

  it("restores queueAlert when the tracked ticket is called in Arcade", async () => {
    renderBanner();

    expect(await screen.findByText("TICKET CALLED!")).toBeInTheDocument();
    await waitFor(() => {
      expect(confettiFireMock).toHaveBeenCalled();
    });

    expect(triggerMock).toHaveBeenCalledWith("queueAlert");
  });
});
