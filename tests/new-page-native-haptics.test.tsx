import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/new/page";
import { LanguageProvider } from "@/contexts/language-context";
import type { RaffleState } from "@/lib/state-types";

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

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock("@/components/theme-switcher", () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));

vi.mock("@/components/haptics-toggle", () => ({
  HapticsToggle: () => <div data-testid="haptics-toggle" />,
}));

vi.mock("@/components/animate-ui/primitives/texts/morphing", () => ({
  MorphingText: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/animate-ui/primitives/texts/rolling", () => ({
  RollingText: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("react-canvas-confetti", () => ({
  default: () => <div data-testid="confetti-canvas" />,
}));

const baseStatePayload: RaffleState = {
  startNumber: 10,
  endNumber: 40,
  mode: "random",
  generatedOrder: [14, 18, 24, 31],
  currentlyServing: 14,
  ticketStatus: {},
  calledAt: {
    24: 1_739_898_060_000,
  },
  orderLocked: true,
  timestamp: 1_739_898_000_000,
  displayUrl: null,
  operatingHours: null,
  timezone: "America/Los_Angeles",
};

function renderHomePage() {
  return render(
    <LanguageProvider>
      <HomePage />
    </LanguageProvider>,
  );
}

describe("New page native haptics", () => {
  beforeEach(() => {
    window.localStorage.clear();
    triggerMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(baseStatePayload), { status: 200 })),
    );
  });

  it("restores queueAlert when the tracked ticket is called in the native shell", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("button", { name: "English" }));
    triggerMock.mockReset();

    const ticketInput = await screen.findByRole("textbox", {
      name: "Enter your ticket number",
    });
    await user.clear(ticketInput);
    await user.type(ticketInput, "24");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText("Ticket Called!")).toBeInTheDocument();
    });

    expect(triggerMock.mock.calls.map(([intent]) => intent)).toContain("queueAlert");
  });
});
