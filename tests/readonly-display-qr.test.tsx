// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReadOnlyDisplay } from "@/components/readonly-display";
import { LanguageProvider } from "@/contexts/language-context";
import type { RaffleState } from "@/lib/state-types";

const { toCanvasMock } = vi.hoisted(() => ({
  toCanvasMock: vi.fn<(canvas: unknown, text: string, opts?: unknown) => Promise<void>>(
    () => Promise.resolve(),
  ),
}));

vi.mock("qrcode", () => ({ default: { toCanvas: toCanvasMock } }));

// Poll fast so the "next poll picks up the admin change" path runs within the
// test's waitFor budget (the real interval is minutes).
vi.mock("@/lib/polling-strategy", () => ({
  getPollingIntervalMs: () => ({ delayMs: 10 }),
  recordPollingStateObservation: ({ activity }: { activity: unknown }) => activity,
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
vi.mock("@/components/animate-ui/primitives/texts/morphing", () => ({
  MorphingText: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("@/components/animate-ui/primitives/texts/rolling", () => ({
  RollingText: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("react-canvas-confetti", () => ({
  default: () => <div data-testid="confetti-canvas" />,
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
  displayLanguageRotation: null,
        announcement: null,
};

const lastQrTarget = () => toCanvasMock.mock.calls.at(-1)?.[1] as string | undefined;

function renderDisplay() {
  return render(
    <LanguageProvider>
      <ReadOnlyDisplay showQrCode showHeaderLogo={false} />
    </LanguageProvider>,
  );
}

describe("ReadOnlyDisplay QR code", () => {
  let currentState: RaffleState;

  beforeEach(() => {
    window.localStorage.clear();
    toCanvasMock.mockClear();
    currentState = structuredClone(baseState);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(currentState), { status: 200 })),
    );
  });

  it("renders the configured display URL on first load", async () => {
    currentState = { ...currentState, displayUrl: "https://configured.example/" };
    renderDisplay();

    await waitFor(() => {
      expect(lastQrTarget()).toBe("https://configured.example/");
    });
  });

  it("updates the QR target when the admin changes the display URL, without a reload", async () => {
    renderDisplay();

    // No custom URL yet → falls back to the display's own URL.
    await waitFor(() => {
      expect(lastQrTarget()).toBe(window.location.href);
    });

    // Admin configures a URL; the next poll carries it and the QR re-renders.
    // (Regression: the previous one-time fetch never updated after mount.)
    currentState = { ...currentState, displayUrl: "https://custom.example/" };
    await waitFor(() => {
      expect(lastQrTarget()).toBe("https://custom.example/");
    });
  });
});
