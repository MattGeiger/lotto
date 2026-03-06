import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HapticsProvider, useAppHaptics } from "@/components/haptics-provider";
import { APP_HAPTIC_INPUT_BY_INTENT, HAPTICS_ENABLED_STORAGE_KEY } from "@/lib/haptics";

const rawTriggerMock = vi.fn();

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({
    trigger: rawTriggerMock,
    cancel: vi.fn(),
    isSupported: true,
  }),
}));

function Probe() {
  const { enabled, setEnabled, trigger } = useAppHaptics();

  return (
    <>
      <div data-testid="enabled">{String(enabled)}</div>
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
});
