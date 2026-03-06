import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/new/page";
import { HapticsProvider } from "@/components/haptics-provider";
import { LanguageProvider } from "@/contexts/language-context";
import { APP_HAPTIC_INPUT_BY_INTENT } from "@/lib/haptics";
import type { RaffleState } from "@/lib/state-types";

const rawTriggerMock = vi.fn();

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({
    trigger: rawTriggerMock,
    cancel: vi.fn(),
    isSupported: true,
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
  calledAt: {},
  orderLocked: true,
  timestamp: 1_739_898_000_000,
  displayUrl: null,
  operatingHours: null,
  timezone: "America/Los_Angeles",
};

function renderHomePage() {
  return render(
    <HapticsProvider>
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>
    </HapticsProvider>,
  );
}

describe("New page haptics", () => {
  let currentState: RaffleState;

  beforeEach(() => {
    window.localStorage.clear();
    rawTriggerMock.mockReset();
    currentState = structuredClone(baseStatePayload);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(currentState), { status: 200 })),
    );
  });

  it("triggers selection haptics for onboarding language choice", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("button", { name: "English" }));

    expect(rawTriggerMock).toHaveBeenCalledWith(APP_HAPTIC_INPUT_BY_INTENT.uiSelect);
  });

  it("triggers error haptics for invalid ticket submit", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("button", { name: "English" }));
    rawTriggerMock.mockReset();

    const ticketInput = await screen.findByRole("textbox", {
      name: "Enter your ticket number",
    });
    await user.clear(ticketInput);
    await user.type(ticketInput, "ABC");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(rawTriggerMock).toHaveBeenCalledWith("error");
  });

  it("triggers medium haptics for valid ticket submit", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("button", { name: "English" }));
    rawTriggerMock.mockReset();

    const ticketInput = await screen.findByRole("textbox", {
      name: "Enter your ticket number",
    });
    await user.clear(ticketInput);
    await user.type(ticketInput, "B07");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(rawTriggerMock).toHaveBeenCalledWith("medium");
  });

  it("keeps the called-ticket celebration visual-only on the web path", async () => {
    const user = userEvent.setup();
    currentState = {
      ...currentState,
      calledAt: {
        24: 1_739_898_060_000,
      },
    };

    renderHomePage();

    await user.click(await screen.findByRole("button", { name: "English" }));
    rawTriggerMock.mockReset();

    const ticketInput = await screen.findByRole("textbox", {
      name: "Enter your ticket number",
    });
    await user.clear(ticketInput);
    await user.type(ticketInput, "24");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText("Ticket Called!")).toBeInTheDocument();
    });
    expect(rawTriggerMock).toHaveBeenCalledTimes(1);
    expect(rawTriggerMock).toHaveBeenNthCalledWith(1, "medium");
    expect(rawTriggerMock).not.toHaveBeenCalledWith(APP_HAPTIC_INPUT_BY_INTENT.queueAlert);
  });
});
