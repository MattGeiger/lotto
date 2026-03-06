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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("triggers selection haptics only when Snake difficulty is committed", () => {
    renderWithProviders(<SnakePage />);

    const slider = screen.getAllByRole("slider")[0];
    fireEvent.focus(slider);
    fireEvent.keyDown(slider, { key: "End" });

    expect(rawTriggerMock).toHaveBeenCalledTimes(1);
    expect(rawTriggerMock).toHaveBeenCalledWith(APP_HAPTIC_INPUT_BY_INTENT.uiSelect);
  });

  it("triggers selection haptics only when Brick Mayhem difficulty is committed", () => {
    renderWithProviders(<BrickMayhemPage />);

    const slider = screen.getAllByRole("slider")[0];
    fireEvent.focus(slider);
    fireEvent.keyDown(slider, { key: "End" });

    expect(rawTriggerMock).toHaveBeenCalledTimes(1);
    expect(rawTriggerMock).toHaveBeenCalledWith(APP_HAPTIC_INPUT_BY_INTENT.uiSelect);
  });
});
