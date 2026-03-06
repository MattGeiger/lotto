import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HapticsProvider, useAppHaptics } from "@/components/haptics-provider";
import { APP_HAPTIC_INPUT_BY_INTENT } from "@/lib/haptics";

const rawTriggerMock = vi.fn();

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({
    trigger: rawTriggerMock,
    cancel: vi.fn(),
    isSupported: true,
  }),
}));

function Probe() {
  const { trigger } = useAppHaptics();

  return (
    <>
      <button type="button" onClick={() => trigger("uiConfirm")}>
        Confirm
      </button>
      <button type="button" onClick={() => trigger("uiDestructive")}>
        Destructive
      </button>
      <button type="button" onClick={() => trigger("none")}>
        None
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

  it("does not persist a dedicated haptics preference", async () => {
    renderProbe();

    await waitFor(() => {
      expect(window.localStorage.getItem("haptics-enabled")).toBeNull();
    });
  });

  it("short-circuits the explicit none intent", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "None" }));
    expect(rawTriggerMock).not.toHaveBeenCalled();
  });

  it("maps app intents to the expected raw presets", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await user.click(screen.getByRole("button", { name: "Destructive" }));

    expect(rawTriggerMock).toHaveBeenNthCalledWith(1, APP_HAPTIC_INPUT_BY_INTENT.uiConfirm);
    expect(rawTriggerMock).toHaveBeenNthCalledWith(2, APP_HAPTIC_INPUT_BY_INTENT.uiDestructive);
  });
});
