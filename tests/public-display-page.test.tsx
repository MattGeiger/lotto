// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicDisplayPage } from "@/components/public-display-page";
import type { RaffleState } from "@/lib/state-types";

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

let capturedBottomNavAutoHide: number | undefined = undefined;
vi.mock("@/components/navigation/bottom-tab-bar", () => ({
  BottomTabBar: ({ autoHideAfterSeconds }: { autoHideAfterSeconds?: number }) => {
    capturedBottomNavAutoHide = autoHideAfterSeconds;
    return <nav data-testid="bottom-tab-bar" />;
  },
}));

const useDisplayLanguageRotationMock = vi.hoisted(() => vi.fn());
const languageContextMock = vi.hoisted(() => ({
  hasSessionLanguageOverride: false,
  isLanguageHydrated: true,
}));

vi.mock("@/hooks/use-display-language-rotation", () => ({
  useDisplayLanguageRotation: useDisplayLanguageRotationMock,
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: ({
    onLanguageChange,
  }: {
    onLanguageChange?: (language: "vi") => void;
  }) => (
    <button type="button" data-testid="language-switcher" onClick={() => onLanguageChange?.("vi")}>
      Language switcher
    </button>
  ),
}));

let capturedSearchRequest: unknown = undefined;
let capturedOnStateChange: ((state: RaffleState) => void) | undefined = undefined;
let capturedRealtimeCanary: unknown = undefined;
vi.mock("@/components/readonly-display", () => ({
  ReadOnlyDisplay: (props: Record<string, unknown>) => {
    capturedSearchRequest = props.ticketSearchRequest;
    capturedOnStateChange = props.onStateChange as typeof capturedOnStateChange;
    capturedRealtimeCanary = props.realtimeCanary;
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
    setTransientLanguage: vi.fn(),
    hasSessionLanguageOverride: languageContextMock.hasSessionLanguageOverride,
    isLanguageHydrated: languageContextMock.isLanguageHydrated,
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

const stateWithRotationEnabled = {
  displayLanguageRotation: {
    enabled: true,
    languages: ["en", "es"],
    intervalSeconds: 120,
  },
} as RaffleState;

// --- Tests ----------------------------------------------------------------

describe("PublicDisplayPage", () => {
  beforeEach(() => {
    capturedSearchRequest = undefined;
    capturedOnStateChange = undefined;
    capturedRealtimeCanary = undefined;
    capturedBottomNavAutoHide = undefined;
    languageContextMock.hasSessionLanguageOverride = false;
    languageContextMock.isLanguageHydrated = true;
    useDisplayLanguageRotationMock.mockClear();
  });

  it("renders search input, language switcher, and theme switcher", () => {
    renderPage();
    expect(getSearchInput()).toBeInTheDocument();
    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-tab-bar")).toBeInTheDocument();
  });

  it("renders the ReadOnlyDisplay component", () => {
    renderPage();
    expect(screen.getByTestId("readonly-display")).toBeInTheDocument();
  });

  it("forwards the server-issued realtime canary configuration", () => {
    const realtimeCanary = {
      agencyId: "william-temple-house",
      eventsUrl: "wss://lotto-realtime-beta.example/events",
    };
    render(<PublicDisplayPage realtimeCanary={realtimeCanary} />);

    expect(capturedRealtimeCanary).toEqual(realtimeCanary);
  });

  it("keeps the language switcher visible when admin rotation is enabled", () => {
    renderPage();

    act(() => {
      capturedOnStateChange?.(stateWithRotationEnabled);
    });

    expect(screen.getByTestId("language-switcher")).toBeVisible();
    expect(screen.getByTestId("language-switcher").parentElement).not.toHaveClass("invisible");
  });

  it("pauses display rotation for the browser session after a manual language choice", async () => {
    renderPage();

    act(() => {
      capturedOnStateChange?.(stateWithRotationEnabled);
    });
    expect(useDisplayLanguageRotationMock).toHaveBeenLastCalledWith(
      stateWithRotationEnabled.displayLanguageRotation,
      { paused: false },
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("language-switcher"));

    expect(useDisplayLanguageRotationMock).toHaveBeenLastCalledWith(
      stateWithRotationEnabled.displayLanguageRotation,
      { paused: true },
    );
  });

  it("pauses display rotation when a language was already selected in the browser session", () => {
    languageContextMock.hasSessionLanguageOverride = true;
    renderPage();

    act(() => {
      capturedOnStateChange?.(stateWithRotationEnabled);
    });

    expect(useDisplayLanguageRotationMock).toHaveBeenLastCalledWith(
      stateWithRotationEnabled.displayLanguageRotation,
      { paused: true },
    );
  });

  it("pauses display rotation until session language hydration completes", () => {
    languageContextMock.isLanguageHydrated = false;
    renderPage();

    act(() => {
      capturedOnStateChange?.(stateWithRotationEnabled);
    });

    expect(useDisplayLanguageRotationMock).toHaveBeenLastCalledWith(
      stateWithRotationEnabled.displayLanguageRotation,
      { paused: true },
    );
  });

  it("hides the bottom nav after 5 minutes by default when rotation is off", () => {
    renderPage();
    expect(capturedBottomNavAutoHide).toBe(300);
  });

  it("ties the bottom nav auto-hide to the rotation interval when rotation is enabled", () => {
    renderPage();

    act(() => {
      capturedOnStateChange?.(stateWithRotationEnabled);
    });

    expect(capturedBottomNavAutoHide).toBe(120);
  });

  it("falls back to 5 minutes when rotation is enabled with no valid interval", () => {
    renderPage();

    act(() => {
      capturedOnStateChange?.({
        displayLanguageRotation: { enabled: true, languages: ["en"], intervalSeconds: 0 },
      } as RaffleState);
    });

    expect(capturedBottomNavAutoHide).toBe(300);
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
