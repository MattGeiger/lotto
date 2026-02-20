import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminPage from "@/app/admin/page";

const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt }: Record<string, unknown>) => (
    <span data-testid={`next-image-${String(alt ?? "image")}`} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: unknown; href: string }) => (
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

describe("Admin optimistic UI", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADMIN_OPTIMISTIC_UI = "true";
    toastError.mockReset();
    installMatchMedia();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ADMIN_OPTIMISTIC_UI;
  });

  it("updates Draw Position immediately before next request resolves", async () => {
    const advanceResolvers: Array<(response: Response) => void> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          return new Response(JSON.stringify(baseState), { status: 200 });
        }

        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (body.action === "listSnapshots") {
          return new Response(JSON.stringify([]), { status: 200 });
        }

        if (body.action === "advanceServing") {
          return await new Promise<Response>((resolve) => {
            advanceResolvers.push(resolve);
          });
        }

        return new Response(JSON.stringify(baseState), { status: 200 });
      }),
    );

    render(<AdminPage />);
    await screen.findByText("Now Serving");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next draw" }));

    await waitFor(() => {
      expect(screen.getByText(/Ticket #7/)).toBeInTheDocument();
    });

    await act(async () => {
      advanceResolvers[0]?.(
        new Response(
          JSON.stringify({
            ...baseState,
            currentlyServing: 7,
          }),
          { status: 200 },
        ),
      );
      await Promise.resolve();
    });
  });

  it("queues one draw action, sends exactly two sequential requests, and ignores a third rapid tap", async () => {
    const postBodies: Record<string, unknown>[] = [];
    const advanceResolvers: Array<(response: Response) => void> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          return new Response(JSON.stringify(baseState), { status: 200 });
        }

        const body = init?.body ? JSON.parse(String(init.body)) : {};
        postBodies.push(body);

        if (body.action === "listSnapshots") {
          return new Response(JSON.stringify([]), { status: 200 });
        }

        if (body.action === "advanceServing") {
          return await new Promise<Response>((resolve) => {
            advanceResolvers.push(resolve);
          });
        }

        return new Response(JSON.stringify(baseState), { status: 200 });
      }),
    );

    render(<AdminPage />);
    await screen.findByText("Now Serving");

    const user = userEvent.setup();
    const nextButton = screen.getByRole("button", { name: "Next draw" });

    await user.click(nextButton);
    await user.click(nextButton);
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Ticket #1/)).toBeInTheDocument();
    });

    expect(
      postBodies.filter((body) => body.action === "advanceServing").length,
    ).toBe(1);

    await act(async () => {
      advanceResolvers[0]?.(
        new Response(JSON.stringify({ ...baseState, currentlyServing: 7 }), { status: 200 }),
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        postBodies.filter((body) => body.action === "advanceServing").length,
      ).toBe(2);
    });

    await act(async () => {
      advanceResolvers[1]?.(
        new Response(JSON.stringify({ ...baseState, currentlyServing: 1 }), { status: 200 }),
      );
      await Promise.resolve();
    });
  });

  it("rolls back optimistic draw updates when request fails", async () => {
    const advanceResolvers: Array<(response: Response) => void> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          return new Response(JSON.stringify(baseState), { status: 200 });
        }

        const body = init?.body ? JSON.parse(String(init.body)) : {};

        if (body.action === "listSnapshots") {
          return new Response(JSON.stringify([]), { status: 200 });
        }

        if (body.action === "advanceServing") {
          return await new Promise<Response>((resolve) => {
            advanceResolvers.push(resolve);
          });
        }

        return new Response(JSON.stringify(baseState), { status: 200 });
      }),
    );

    render(<AdminPage />);
    await screen.findByText("Now Serving");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next draw" }));

    await waitFor(() => {
      expect(screen.getByText(/Ticket #7/)).toBeInTheDocument();
    });

    await act(async () => {
      advanceResolvers[0]?.(
        new Response(JSON.stringify({ error: "Unable to apply action." }), { status: 500 }),
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/Ticket #3/)).toBeInTheDocument();
      expect(toastError).toHaveBeenCalled();
    });
  });
});
