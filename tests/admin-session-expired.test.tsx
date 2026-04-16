import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPage from "@/app/admin/page";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/session-expired";

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

const installFetchWith401OnWrite = () => {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }),
  );
};

describe("Admin page — expired sign-in surfaces ASK toast", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_ADMIN_OPTIMISTIC_UI;
    toastError.mockReset();
    toastSuccess.mockReset();
    installMatchMedia();
    installFetchWith401OnWrite();
  });

  it("replaces the raw 'Unauthorized' string with the ASK-compliant message and a Sign in action", async () => {
    render(<AdminPage />);
    await screen.findByText("Now Serving");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next draw" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });

    const [message, options] = toastError.mock.calls[0];
    expect(message).toBe(SESSION_EXPIRED_MESSAGE);
    // Guard: never surface the raw server token to the user
    expect(message).not.toBe("Unauthorized");

    expect(options).toBeDefined();
    expect(options.action).toBeDefined();
    expect(options.action.label).toBe("Sign in");
    expect(typeof options.action.onClick).toBe("function");

    // Let pending rejections settle
    await new Promise((r) => setTimeout(r, 50));
  });
});
