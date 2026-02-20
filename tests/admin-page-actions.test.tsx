import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPage from "@/app/admin/page";

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt }: Record<string, unknown>) => (
    <span data-testid={`next-image-${String(alt ?? "image")}`} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: unknown;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/theme-switcher", () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));

const baseState = {
  startNumber: 1,
  endNumber: 10,
  mode: "random",
  generatedOrder: [3, 7, 1, 9, 5, 2, 10, 4, 8, 6],
  currentlyServing: 3,
  ticketStatus: {},
  calledAt: {},
  orderLocked: true,
  timestamp: Date.now(),
  displayUrl: null,
  operatingHours: null,
  timezone: "America/Los_Angeles",
};

const twoSnapshots = [
  { id: "snap-1", timestamp: Date.now(), path: "snap-1" },
  { id: "snap-2", timestamp: Date.now() - 60_000, path: "snap-2" },
];

const oneSnapshot = [{ id: "snap-1", timestamp: Date.now(), path: "snap-1" }];

let currentState = { ...baseState };
let currentSnapshots: typeof twoSnapshots = [...twoSnapshots];
let postBodies: Record<string, unknown>[] = [];

const installMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const installFetch = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return new Response(JSON.stringify(currentState), { status: 200 });
      }

      const body = init?.body ? JSON.parse(String(init.body)) : {};
      postBodies.push(body);

      if (body.action === "listSnapshots") {
        return new Response(JSON.stringify(currentSnapshots), { status: 200 });
      }

      return new Response(JSON.stringify(currentState), { status: 200 });
    }),
  );
};

describe("Admin page actions", () => {
  beforeEach(() => {
    currentState = { ...baseState };
    currentSnapshots = [...twoSnapshots];
    postBodies = [];
    toastError.mockReset();
    toastSuccess.mockReset();
    installMatchMedia();
    installFetch();
  });

  it("renders and shows Now Serving card after loading", async () => {
    render(<AdminPage />);
    await screen.findByText("Now Serving");
    expect(screen.getByText(/Ticket #3/)).toBeInTheDocument();
  });

  it("calls advanceServing next when Next draw button is clicked", async () => {
    render(<AdminPage />);
    await screen.findByText("Now Serving");
    const user = userEvent.setup();

    const nextButton = screen.getByRole("button", { name: "Next draw" });
    await user.click(nextButton);

    await waitFor(() => {
      const advanceCalls = postBodies.filter(
        (b) => b.action === "advanceServing" && b.direction === "next",
      );
      expect(advanceCalls.length).toBeGreaterThan(0);
    });
  });

  it("calls advanceServing prev when Previous draw button is clicked", async () => {
    // Use state where currentlyServing=7 (index 1), so prev to index 0 is possible
    currentState = { ...baseState, currentlyServing: 7 };
    render(<AdminPage />);
    await screen.findByText("Now Serving");
    const user = userEvent.setup();

    const prevButton = screen.getByRole("button", { name: "Previous draw" });
    await user.click(prevButton);

    await waitFor(() => {
      const advanceCalls = postBodies.filter(
        (b) => b.action === "advanceServing" && b.direction === "prev",
      );
      expect(advanceCalls.length).toBeGreaterThan(0);
    });
  });

  it("calls undo when Undo button is clicked", async () => {
    render(<AdminPage />);
    await screen.findByText("Now Serving");
    const user = userEvent.setup();

    const undoButton = screen.getByRole("button", { name: /Undo/i });
    await user.click(undoButton);

    await waitFor(() => {
      const undoCalls = postBodies.filter((b) => b.action === "undo");
      expect(undoCalls.length).toBeGreaterThan(0);
    });
  });

  it("undo button is enabled with 2+ snapshots (v1.5.1 derived canUndo)", async () => {
    currentSnapshots = [...twoSnapshots];
    render(<AdminPage />);
    await screen.findByText("Now Serving");

    const undoButton = screen.getByRole("button", { name: /Undo/i });
    expect(undoButton).not.toBeDisabled();
  });

  it("undo button is disabled with fewer than 2 snapshots", async () => {
    currentSnapshots = [...oneSnapshot];
    render(<AdminPage />);
    await screen.findByText("Now Serving");

    const undoButton = screen.getByRole("button", { name: /Undo/i });
    expect(undoButton).toBeDisabled();
  });

  it("shows error toast when an action fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          return new Response(JSON.stringify(currentState), { status: 200 });
        }
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (body.action === "listSnapshots") {
          return new Response(JSON.stringify(currentSnapshots), {
            status: 200,
          });
        }
        // All other actions fail
        return new Response(
          JSON.stringify({ error: "Something went wrong" }),
          { status: 500 },
        );
      }),
    );

    render(<AdminPage />);
    await screen.findByText("Now Serving");
    const user = userEvent.setup();

    const nextButton = screen.getByRole("button", { name: "Next draw" });
    await user.click(nextButton);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    // Let pending rejections settle
    await new Promise((r) => setTimeout(r, 50));
  });

  it("renders ticket info in the draw position section", async () => {
    render(<AdminPage />);
    await screen.findByText("Now Serving");
    // "Draw position" appears in the card — use getAllByText and check at least one
    const drawPosElements = screen.getAllByText(/Draw position/);
    expect(drawPosElements.length).toBeGreaterThan(0);
  });

  it("displays Ticket Range & Order section", async () => {
    render(<AdminPage />);
    await screen.findByText("Ticket Range & Order");
    expect(screen.getByLabelText("Start Number")).toBeInTheDocument();
    expect(screen.getByLabelText("End Number")).toBeInTheDocument();
  });

  it("shows dash for Tickets issued when reset state has no active range", async () => {
    currentState = {
      ...baseState,
      startNumber: 0,
      endNumber: 0,
      generatedOrder: [],
      currentlyServing: null,
      orderLocked: false,
      ticketStatus: {},
      calledAt: {},
    };

    render(<AdminPage />);
    await screen.findByText("Live State");

    const ticketsIssuedLabel = screen.getByText("Tickets issued");
    expect(ticketsIssuedLabel.nextElementSibling).toHaveTextContent("—");
  });
});
