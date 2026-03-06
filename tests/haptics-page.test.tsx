import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HapticsPage from "@/app/haptics/page";

const rawTriggerMock = vi.fn();
const cancelMock = vi.fn();

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({
    trigger: rawTriggerMock,
    cancel: cancelMock,
    isSupported: true,
  }),
}));

describe("/haptics page", () => {
  beforeEach(() => {
    rawTriggerMock.mockReset();
    cancelMock.mockReset();
  });

  it("renders every built-in library preset button", () => {
    render(<HapticsPage />);

    expect(screen.getByRole("button", { name: "Trigger Success" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Warning" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Error" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Medium" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Heavy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Soft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Rigid" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Selection" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Nudge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trigger Buzz" })).toBeInTheDocument();
  });

  it("triggers the raw web-haptics presets directly", async () => {
    const user = userEvent.setup();
    render(<HapticsPage />);

    await user.click(screen.getByRole("button", { name: "Trigger Success" }));
    await user.click(screen.getByRole("button", { name: "Trigger Selection" }));
    await user.click(screen.getByRole("button", { name: "Trigger Buzz" }));

    expect(rawTriggerMock).toHaveBeenNthCalledWith(1, "success");
    expect(rawTriggerMock).toHaveBeenNthCalledWith(2, "selection");
    expect(rawTriggerMock).toHaveBeenNthCalledWith(3, "buzz");
    expect(
      screen.getByText((_, node) => node?.textContent === "Last triggered: Buzz"),
    ).toBeInTheDocument();
  });

  it("can cancel the current vibration", async () => {
    const user = userEvent.setup();
    render(<HapticsPage />);

    await user.click(screen.getByRole("button", { name: "Stop Current Vibration" }));

    expect(cancelMock).toHaveBeenCalledTimes(1);
  });
});
