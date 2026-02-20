import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicDisplayPage } from "@/components/public-display-page";

// --- Mocks ---------------------------------------------------------------

vi.mock("next/font/local", () => ({
  default: () => ({ className: "font-arcade-display", variable: "" }),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid={`next-image-${alt}`} />,
}));

vi.mock("@/components/theme-switcher", () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

let capturedSearchRequest: unknown = undefined;
vi.mock("@/components/readonly-display", () => ({
  ReadOnlyDisplay: (props: Record<string, unknown>) => {
    capturedSearchRequest = props.ticketSearchRequest;
    return <div data-testid="readonly-display" />;
  },
}));

vi.mock("@/components/animate-ui/icons/icon", () => ({
  AnimateIcon: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/animate-ui/icons/search", () => ({
  Search: () => <span data-testid="search-icon" />,
}));

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({
    language: "en",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const map: Record<string, string> = {
        searchTicketLabel: "Enter your ticket number",
        searchTicketPlaceholder: "ENTER TICKET #",
        searchButtonLabel: "Submit",
      };
      return map[key] ?? key;
    },
  }),
}));

// --- Helpers --------------------------------------------------------------

function renderPage() {
  return render(<PublicDisplayPage />);
}

function getSearchInput() {
  return screen.getByLabelText("Search ticket number") as HTMLInputElement;
}

// --- Tests ----------------------------------------------------------------

describe("PublicDisplayPage", () => {
  beforeEach(() => {
    capturedSearchRequest = undefined;
  });

  it("renders search input, language switcher, and theme switcher", () => {
    renderPage();
    expect(getSearchInput()).toBeInTheDocument();
    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
  });

  it("renders the ReadOnlyDisplay component", () => {
    renderPage();
    expect(screen.getByTestId("readonly-display")).toBeInTheDocument();
  });

  it("filters non-digit characters from input", async () => {
    renderPage();
    const user = userEvent.setup();
    const input = getSearchInput();

    await user.type(input, "abc123def456");
    expect(input.value).toBe("123456");
  });

  it("truncates input at 6 characters", async () => {
    renderPage();
    const user = userEvent.setup();
    const input = getSearchInput();

    await user.type(input, "1234567890");
    expect(input.value).toBe("123456");
  });

  it("submits search on Enter key", async () => {
    renderPage();
    const user = userEvent.setup();
    const input = getSearchInput();

    await user.type(input, "42");
    await user.keyboard("{Enter}");

    expect(capturedSearchRequest).toEqual({
      ticketNumber: 42,
      triggerId: 1,
    });
  });

  it("submits search on search button click", async () => {
    renderPage();
    const user = userEvent.setup();
    const input = getSearchInput();

    await user.type(input, "99");

    const submitBtn = screen.getByRole("button", { name: "Submit" });
    await user.click(submitBtn);

    expect(capturedSearchRequest).toEqual({
      ticketNumber: 99,
      triggerId: 1,
    });
  });

  it("does not submit when input is empty", async () => {
    renderPage();
    const user = userEvent.setup();
    const input = getSearchInput();

    // Type nothing, press Enter
    await user.click(input);
    await user.keyboard("{Enter}");

    expect(capturedSearchRequest).toBeUndefined();
  });

  it("increments triggerId on multiple submissions", async () => {
    renderPage();
    const user = userEvent.setup();
    const input = getSearchInput();

    // First search
    await user.type(input, "10");
    await user.keyboard("{Enter}");
    expect(capturedSearchRequest).toEqual({ ticketNumber: 10, triggerId: 1 });

    // Second search — same ticket, new triggerId
    await user.keyboard("{Enter}");
    expect(capturedSearchRequest).toEqual({ ticketNumber: 10, triggerId: 2 });

    // Third search — different ticket
    await user.clear(input);
    await user.type(input, "55");
    await user.keyboard("{Enter}");
    expect(capturedSearchRequest).toEqual({ ticketNumber: 55, triggerId: 3 });
  });
});
