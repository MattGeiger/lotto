import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HapticsProvider, useAppHaptics } from "@/components/haptics-provider";
import { APP_HAPTIC_INPUT_BY_INTENT, HAPTICS_ENABLED_STORAGE_KEY } from "@/lib/haptics";

const rawTriggerMock = vi.fn();
const capacitorMocks = vi.hoisted(() => ({
  nativeImpactMock: vi.fn(),
  nativeNotificationMock: vi.fn(),
  nativeVibrateMock: vi.fn(),
  nativeSelectionStartMock: vi.fn(),
  nativeSelectionChangedMock: vi.fn(),
  nativeSelectionEndMock: vi.fn(),
  isNativePlatformMock: vi.fn(() => false),
  isPluginAvailableMock: vi.fn(() => true),
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

function Probe() {
  const { enabled, isNative, setEnabled, trigger } = useAppHaptics();

  return (
    <>
      <div data-testid="enabled">{String(enabled)}</div>
      <div data-testid="native">{String(isNative)}</div>
      <button type="button" onClick={() => setEnabled(false)}>
        Disable
      </button>
      <button type="button" onClick={() => setEnabled(true)}>
        Enable
      </button>
      <button type="button" onClick={() => trigger("queueAlert")}>
        Alert
      </button>
      <button type="button" onClick={() => trigger("uiDestructive")}>
        Destructive
      </button>
    </>
  );
}

function renderProbe() {
  return render(
    <HapticsProvider>
      <Probe />
    </HapticsProvider>,
  );
}

describe("HapticsProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    rawTriggerMock.mockReset();
    capacitorMocks.nativeImpactMock.mockReset();
    capacitorMocks.nativeNotificationMock.mockReset();
    capacitorMocks.nativeVibrateMock.mockReset();
    capacitorMocks.nativeSelectionStartMock.mockReset();
    capacitorMocks.nativeSelectionChangedMock.mockReset();
    capacitorMocks.nativeSelectionEndMock.mockReset();
    capacitorMocks.isNativePlatformMock.mockReturnValue(false);
    capacitorMocks.isPluginAvailableMock.mockReturnValue(true);
  });

  it("defaults to enabled and persists the preference", async () => {
    renderProbe();

    expect(screen.getByTestId("enabled")).toHaveTextContent("true");
    await waitFor(() => {
      expect(window.localStorage.getItem(HAPTICS_ENABLED_STORAGE_KEY)).toBe("true");
    });
  });

  it("restores a persisted disabled preference", async () => {
    window.localStorage.setItem(HAPTICS_ENABLED_STORAGE_KEY, "false");

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("enabled")).toHaveTextContent("false");
    });
  });

  it("short-circuits haptic triggers when disabled", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "Disable" }));
    await waitFor(() => {
      expect(screen.getByTestId("enabled")).toHaveTextContent("false");
    });

    await user.click(screen.getByRole("button", { name: "Alert" }));
    expect(rawTriggerMock).not.toHaveBeenCalled();
  });

  it("maps app intents to the expected raw presets", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "Alert" }));
    await user.click(screen.getByRole("button", { name: "Destructive" }));

    expect(rawTriggerMock).toHaveBeenNthCalledWith(1, APP_HAPTIC_INPUT_BY_INTENT.queueAlert);
    expect(rawTriggerMock).toHaveBeenNthCalledWith(2, APP_HAPTIC_INPUT_BY_INTENT.uiDestructive);
  });

  it("routes semantic intents through the native Capacitor plugin when running in a native shell", async () => {
    capacitorMocks.isNativePlatformMock.mockReturnValue(true);
    const user = userEvent.setup();
    renderProbe();

    expect(screen.getByTestId("native")).toHaveTextContent("true");

    await user.click(screen.getByRole("button", { name: "Alert" }));
    await user.click(screen.getByRole("button", { name: "Destructive" }));

    expect(rawTriggerMock).not.toHaveBeenCalled();
    expect(capacitorMocks.nativeVibrateMock).toHaveBeenCalledWith({ duration: 500 });
    expect(capacitorMocks.nativeImpactMock).toHaveBeenCalledWith({ style: "HEAVY" });
  });
});
