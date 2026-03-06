import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BrickMayhemPage from "@/app/(arcade)/arcade/brick-mayhem/page";
import SnakePage from "@/app/(arcade)/arcade/snake/page";
import { HapticsProvider } from "@/components/haptics-provider";
import { LanguageProvider } from "@/contexts/language-context";
import { APP_HAPTIC_INPUT_BY_INTENT } from "@/lib/haptics";

const rawTriggerMock = vi.fn();

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({
    trigger: rawTriggerMock,
    cancel: vi.fn(),
    isSupported: true,
  }),
}));

function renderWithProviders(ui: ReactNode) {
  return render(
    <HapticsProvider>
      <LanguageProvider>{ui}</LanguageProvider>
    </HapticsProvider>,
  );
}

describe("Arcade direct-input haptics", () => {
  beforeEach(() => {
    rawTriggerMock.mockReset();
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null as unknown as CanvasRenderingContext2D,
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the Snake difficulty slider silent and vibrates on D-pad button presses", () => {
    renderWithProviders(<SnakePage />);

    const slider = screen.getAllByRole("slider")[0];
    fireEvent.focus(slider);
    fireEvent.keyDown(slider, { key: "End" });

    expect(rawTriggerMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Move up" }));

    expect(rawTriggerMock).toHaveBeenCalledWith(APP_HAPTIC_INPUT_BY_INTENT.uiSelect);
  });

  it("keeps the Brick Mayhem difficulty slider silent and vibrates on button controls", () => {
    renderWithProviders(<BrickMayhemPage />);

    const slider = screen.getAllByRole("slider")[0];
    fireEvent.focus(slider);
    fireEvent.keyDown(slider, { key: "End" });

    expect(rawTriggerMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "PLAY NOW" }));
    expect(rawTriggerMock).toHaveBeenCalledWith(APP_HAPTIC_INPUT_BY_INTENT.uiConfirm);
  });
});
