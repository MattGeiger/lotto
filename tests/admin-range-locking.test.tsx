import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const lockedState = {
  startNumber: 1,
  endNumber: 3,
  mode: "random",
  generatedOrder: [2, 1, 3],
  currentlyServing: null,
  ticketStatus: {},
  calledAt: {},
  orderLocked: true,
  timestamp: Date.now(),
  displayUrl: null,
  operatingHours: null,
  timezone: "America/Los_Angeles",
};

const exhaustedState = {
  ...lockedState,
  generatedOrder: [1, 2, 3],
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

describe("Admin range locking UX", () => {
  beforeEach(() => {
    toastError.mockReset();
    installMatchMedia();
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return new Response(JSON.stringify(exhaustedState), { status: 200 });
      }

      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (body.action === "listSnapshots") {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      return new Response(JSON.stringify(exhaustedState), { status: 200 });
    }));
  });

  it("disables start input after first draw and shows exact lock guidance on click", async () => {
    render(<AdminPage />);

    const startInput = (await screen.findByLabelText("Start Number")) as HTMLInputElement;
    expect(startInput).toBeDisabled();

    const wrapper = startInput.parentElement;
    expect(wrapper).not.toBeNull();
    if (!wrapper) throw new Error("Start input wrapper not found");

    const user = userEvent.setup();
    await user.click(wrapper);

    expect(toastError).toHaveBeenCalledWith(
      "Start number is locked at 1 after the first draw. Reset to start a new range.",
    );
  });

  it("disables end input when pending is exhausted and routes user to append flow", async () => {
    render(<AdminPage />);

    const endInput = (await screen.findByLabelText("End Number")) as HTMLInputElement;
    expect(endInput).toBeDisabled();

    const wrapper = endInput.parentElement;
    expect(wrapper).not.toBeNull();
    if (!wrapper) throw new Error("End input wrapper not found");

    const user = userEvent.setup();
    await user.click(wrapper);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "All tickets in this range are sorted. Use Append to increase the end number.",
      );
    });
  });
});
