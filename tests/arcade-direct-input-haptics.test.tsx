import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BrickMayhemPage from "@/app/(arcade)/arcade/brick-mayhem/page";
import SnakePage from "@/app/(arcade)/arcade/snake/page";
import { HapticsProvider } from "@/components/haptics-provider";
import { LanguageProvider } from "@/contexts/language-context";
import { APP_HAPTIC_INPUT_BY_INTENT } from "@/lib/haptics";

const rawTriggerMock = vi.fn();
const capacitorMocks = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(() => false),
  isPluginAvailableMock: vi.fn(() => true),
  nativeImpactMock: vi.fn(),
  nativeNotificationMock: vi.fn(),
  nativeVibrateMock: vi.fn(),
  nativeSelectionStartMock: vi.fn(),
  nativeSelectionChangedMock: vi.fn(),
  nativeSelectionEndMock: vi.fn(),
}));

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({
    trigger: rawTriggerMock,
    cancel: vi.fn(),
    isSupported: true,
  }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatformMock,
    isPluginAvailable: capacitorMocks.isPluginAvailableMock,
  },
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: capacitorMocks.nativeImpactMock,
    notification: capacitorMocks.nativeNotificationMock,
    vibrate: capacitorMocks.nativeVibrateMock,
    selectionStart: capacitorMocks.nativeSelectionStartMock,
    selectionChanged: capacitorMocks.nativeSelectionChangedMock,
    selectionEnd: capacitorMocks.nativeSelectionEndMock,
  },
  ImpactStyle: {
    Light: "LIGHT",
    Medium: "MEDIUM",
    Heavy: "HEAVY",
  },
  NotificationType: {
    Success: "SUCCESS",
    Warning: "WARNING",
    Error: "ERROR",
  },
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
    capacitorMocks.nativeImpactMock.mockReset();
    capacitorMocks.nativeNotificationMock.mockReset();
    capacitorMocks.nativeVibrateMock.mockReset();
    capacitorMocks.nativeSelectionStartMock.mockReset();
    capacitorMocks.nativeSelectionChangedMock.mockReset();
    capacitorMocks.nativeSelectionEndMock.mockReset();
    capacitorMocks.isNativePlatformMock.mockReturnValue(false);
    capacitorMocks.isPluginAvailableMock.mockReturnValue(true);
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
