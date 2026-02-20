import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

import { ReadOnlyDisplay } from "@/components/readonly-display";
import { LanguageProvider } from "@/contexts/language-context";
import type { RaffleState } from "@/lib/state-types";

// --- Mocks ----------------------------------------------------------------

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

// Animated icons used by TicketDetailDialog
vi.mock("@/components/animate-ui/icons/clock", () => ({
  Clock: (props: Record<string, unknown>) => <span data-testid="icon-clock" {...props} />,
}));

vi.mock("@/components/animate-ui/icons/users", () => ({
  Users: (props: Record<string, unknown>) => <span data-testid="icon-users" {...props} />,
}));

vi.mock("@/components/animate-ui/icons/x", () => ({
  X: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
}));

// --- Fixtures -------------------------------------------------------------

const baseState: RaffleState = {
  startNumber: 1,
  endNumber: 20,
  mode: "random",
  generatedOrder: [5, 12, 3, 18, 7, 1, 15, 9, 20, 14],
  currentlyServing: 5,
  ticketStatus: {},
  calledAt: {},
  orderLocked: true,
  timestamp: 1_739_898_000_000,
  displayUrl: null,
  operatingHours: null,
  timezone: "America/Los_Angeles",
};

const preDrawState: RaffleState = {
  ...baseState,
  generatedOrder: [],
  currentlyServing: null,
  orderLocked: false,
  timestamp: null,
};

// --- Helpers --------------------------------------------------------------

function installFetch(state: RaffleState = baseState) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(state), { status: 200 })),
  );
}

function renderPublicDisplay(props?: Partial<ComponentProps<typeof ReadOnlyDisplay>>) {
  return render(
    <LanguageProvider>
      <ReadOnlyDisplay displayVariant="public" {...props} />
    </LanguageProvider>,
  );
}

// --- Tests ----------------------------------------------------------------

describe("ReadOnlyDisplay (public variant)", () => {
  beforeEach(() => {
    installFetch();
  });

  it("renders Now Serving label with current ticket number", async () => {
    renderPublicDisplay();
    // LanguageMorphText renders "Now Serving" from t()
    await waitFor(() => {
      expect(screen.getByText("Now Serving")).toBeInTheDocument();
    });
    // RollingText renders the ticket number — may appear multiple times
    // (in the now-serving display and in the ticket grid)
    const fives = screen.getAllByText("5");
    expect(fives.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Drawing Order card heading for public variant", async () => {
    renderPublicDisplay();
    await waitFor(() => {
      expect(screen.getByText("Drawing Order")).toBeInTheDocument();
    });
  });

  it("renders ticket grid with generated order tickets", async () => {
    renderPublicDisplay();
    await waitFor(() => {
      expect(screen.getByText("Drawing Order")).toBeInTheDocument();
    });
    // Ticket numbers from generatedOrder should be visible in the grid
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("shows 'Pending' when no ticket is currently being served", async () => {
    installFetch(preDrawState);
    renderPublicDisplay();
    // MorphingText renders the "waiting" / "Pending" text
    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  it("shows welcome message when draw has not started", async () => {
    installFetch(preDrawState);
    renderPublicDisplay();
    await waitFor(() => {
      expect(screen.getByText("Welcome!")).toBeInTheDocument();
    });
    expect(screen.getByText("The raffle has not yet started.")).toBeInTheDocument();
  });

  it("renders status legend with key labels", async () => {
    renderPublicDisplay();
    await waitFor(() => {
      expect(screen.getByText("Now Serving")).toBeInTheDocument();
    });
    // Legend items
    expect(screen.getByText("Not called")).toBeInTheDocument();
    expect(screen.getByText("Called")).toBeInTheDocument();
  });

  it("shows ticket status badges for returned tickets", async () => {
    const stateWithReturned: RaffleState = {
      ...baseState,
      ticketStatus: { 12: "returned" },
    };
    installFetch(stateWithReturned);
    renderPublicDisplay();
    await waitFor(() => {
      expect(screen.getByText("Drawing Order")).toBeInTheDocument();
    });
    // The legend shows "Returned" label
    expect(screen.getByText("Returned")).toBeInTheDocument();
  });

  it("shows ticket status badges for unclaimed tickets", async () => {
    const stateWithUnclaimed: RaffleState = {
      ...baseState,
      ticketStatus: { 12: "unclaimed" },
    };
    installFetch(stateWithUnclaimed);
    renderPublicDisplay();
    await waitFor(() => {
      expect(screen.getByText("Drawing Order")).toBeInTheDocument();
    });
    expect(screen.getByText("Unclaimed")).toBeInTheDocument();
  });

  it("displays error state when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("fail", { status: 500 })),
    );
    renderPublicDisplay();
    await waitFor(() => {
      expect(screen.getByText(/Error loading state/)).toBeInTheDocument();
    });
  });

  it("opens ticket detail dialog when clicking a ticket in the grid", async () => {
    renderPublicDisplay();
    await waitFor(() => {
      expect(screen.getByText("Drawing Order")).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Click ticket 12 in the grid — tickets have role="button"
    const ticket12 = screen.getByText("12");
    await user.click(ticket12);

    // The TicketDetailDialog should open showing ticket 12's details
    await waitFor(() => {
      expect(screen.getByText("Queue Position")).toBeInTheDocument();
    });
  });

  it("shows not-found dialog when searching for ticket not in range", async () => {
    // Render first without search request, wait for state to load
    const { rerender } = renderPublicDisplay();
    await waitFor(() => {
      expect(screen.getByText("Now Serving")).toBeInTheDocument();
    });

    // Now search for a ticket not in range
    rerender(
      <LanguageProvider>
        <ReadOnlyDisplay
          displayVariant="public"
          ticketSearchRequest={{ ticketNumber: 999, triggerId: 1 }}
        />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Ticket not found")).toBeInTheDocument();
    });
  });
});
