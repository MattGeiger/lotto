import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

import { ReadOnlyDisplay } from "@/components/readonly-display";
import { LanguageProvider } from "@/contexts/language-context";
import type { RaffleState } from "@/lib/state-types";

const confettiFireMock = vi.fn();

vi.mock("next/font/local", () => ({
  default: () => ({ className: "font-arcade-display", variable: "" }),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid={`next-image-${alt}`} />,
}));

vi.mock("@/components/language-morph-text", () => ({
  LanguageMorphText: ({ text }: { text: string | string[] }) => (
    <>{Array.isArray(text) ? text[0] : text}</>
  ),
}));

vi.mock("@/components/animate-ui/primitives/texts/morphing", () => ({
  MorphingText: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/animate-ui/primitives/texts/rolling", () => ({
  RollingText: ({ text }: { text: string }) => <span>{text}</span>,
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

const baseState: RaffleState = {
  startNumber: 10,
  endNumber: 30,
  mode: "random",
  generatedOrder: [14, 18, 24],
  currentlyServing: 14,
  ticketStatus: {},
  calledAt: {},
  orderLocked: true,
  timestamp: 1_739_898_000_000,
  displayUrl: null,
  operatingHours: null,
  timezone: "America/Los_Angeles",
};

function renderPersonalizedDisplay(props?: Partial<ComponentProps<typeof ReadOnlyDisplay>>) {
  return render(
    <LanguageProvider>
      <ReadOnlyDisplay
        displayVariant="personalized"
        personalizedTicketNumber={24}
        showQrCode={false}
        showHeaderLogo={false}
        {...props}
      />
    </LanguageProvider>,
  );
}

describe("ReadOnlyDisplay personalized variant", () => {
  let currentState: RaffleState;

  beforeEach(() => {
    window.localStorage.clear();
    confettiFireMock.mockReset();
    currentState = structuredClone(baseState);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(currentState), { status: 200 })),
    );
  });

  it("renders personalized ticket data in the requested row order", async () => {
    renderPersonalizedDisplay({ onRequestTicketChange: vi.fn() });

    await screen.findByText("YOUR TICKET");

    const estimatedLabel = screen.getByText("YOUR ESTIMATED WAIT TIME");
    const aheadLabel = screen.getByText("TICKETS AHEAD OF YOU");
    const positionLabel = screen.getByText("YOUR TICKET'S POSITION");

    expect(estimatedLabel.compareDocumentPosition(aheadLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aheadLabel.compareDocumentPosition(positionLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("YOUR TICKET NUMBER")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("4 minutes")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByTestId("service-time")).toHaveTextContent(/\S/);
    expect(screen.getByRole("button", { name: "Enter a new ticket number" })).toBeInTheDocument();
    const arcadeLink = screen.getByRole("link", { name: "PLAY GAMES" });
    expect(arcadeLink).toBeInTheDocument();
    expect(arcadeLink).toHaveAttribute("href", "/arcade");
  });

  it("shows inline not-in-drawing messaging and check-back placeholders", async () => {
    renderPersonalizedDisplay({ personalizedTicketNumber: 53 });

    await screen.findByText("YOUR TICKET");

    expect(screen.getByText("Your ticket number is not yet in the drawing. Check back soon.")).toBeInTheDocument();
    expect(screen.getByText("53")).toBeInTheDocument();
    expect(screen.getAllByText("CHECK BACK SOON").length).toBeGreaterThanOrEqual(3);
  });

  it("formats service time using the active language locale", async () => {
    window.localStorage.setItem("display-language", "zh");
    renderPersonalizedDisplay();

    const serviceTime = await screen.findByTestId("service-time");
    expect(serviceTime).toHaveAttribute("dir", "ltr");
    await waitFor(() => {
      expect(serviceTime.textContent ?? "").not.toMatch(/[aApP][mM]/);
    });
  });

  it("hides the public legend in personalized mode", async () => {
    renderPersonalizedDisplay();
    await screen.findByText("YOUR TICKET");

    expect(screen.queryByText("Not called")).not.toBeInTheDocument();
    expect(screen.queryByText("Unclaimed")).not.toBeInTheDocument();
  });

  it("exposes a change-ticket action callback", async () => {
    const onRequestTicketChange = vi.fn();
    const user = userEvent.setup();

    renderPersonalizedDisplay({ onRequestTicketChange });
    await screen.findByRole("button", { name: "Enter a new ticket number" });
    await user.click(screen.getByRole("button", { name: "Enter a new ticket number" }));

    expect(onRequestTicketChange).toHaveBeenCalledTimes(1);
  });

  it("keeps existing no-draw messaging when there are no generated tickets", async () => {
    currentState = {
      ...currentState,
      generatedOrder: [],
      currentlyServing: null,
      startNumber: 0,
      endNumber: 0,
    };

    renderPersonalizedDisplay();

    await waitFor(() => {
      expect(screen.getByText("Welcome!")).toBeInTheDocument();
      expect(screen.getByText("The raffle has not yet started.")).toBeInTheDocument();
      expect(screen.getByText("Check back soon for updates.")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("service-time")).not.toBeInTheDocument();
    expect(screen.queryByText("YOUR TICKET NUMBER")).not.toBeInTheDocument();
  });

  it("shows called-ticket overlay and triggers confetti for personalized ticket calls", async () => {
    currentState = {
      ...currentState,
      calledAt: {
        24: 1_739_898_060_000,
      },
    };

    renderPersonalizedDisplay();

    expect(await screen.findByText("Ticket Called!")).toBeInTheDocument();
    expect(screen.getByText("Please Check-in")).toBeInTheDocument();
    expect(screen.getByTestId("confetti-canvas")).toBeInTheDocument();
    await waitFor(() => {
      expect(confettiFireMock).toHaveBeenCalled();
    });
  });
});
