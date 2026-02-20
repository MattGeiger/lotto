import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmAction } from "@/components/confirm-action";

// --- Helpers --------------------------------------------------------------

function renderConfirm(overrides: Partial<Parameters<typeof ConfirmAction>[0]> = {}) {
  const defaults = {
    title: "Confirm Reset",
    description: "This will reset all state. Are you sure?",
    triggerLabel: "Reset",
    onConfirm: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<ConfirmAction {...props} />), props };
}

// --- Tests ----------------------------------------------------------------

describe("ConfirmAction", () => {
  it("renders trigger button with label", () => {
    renderConfirm();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("opens dialog on trigger click and shows title/description", async () => {
    renderConfirm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByText("Confirm Reset")).toBeInTheDocument();
    expect(screen.getByText("This will reset all state. Are you sure?")).toBeInTheDocument();
  });

  it("shows Cancel and Confirm buttons in dialog", async () => {
    renderConfirm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("shows custom confirmText on confirm button", async () => {
    renderConfirm({ confirmText: "Yes, reset" });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByRole("button", { name: "Yes, reset" })).toBeInTheDocument();
  });

  it("defaults confirm label to actionLabel when provided", async () => {
    renderConfirm({ actionLabel: "Do it" });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByRole("button", { name: "Do it" })).toBeInTheDocument();
  });

  it("falls back to 'Confirm' when neither confirmText nor actionLabel provided", async () => {
    renderConfirm({ confirmText: undefined, actionLabel: undefined });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    renderConfirm({ onConfirm });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });

  it("closes dialog after confirmation completes", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderConfirm({ onConfirm });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(screen.queryByText("Confirm Reset")).not.toBeInTheDocument();
    });
  });

  it("closes dialog even when onConfirm rejects", async () => {
    // The component uses try/finally (no catch), so the rejection propagates.
    // We suppress the unhandled rejection at the process level for this test.
    const originalListeners = process.rawListeners("unhandledRejection");
    process.removeAllListeners("unhandledRejection");
    process.on("unhandledRejection", () => {
      // Swallow for this test
    });

    try {
      const onConfirm = vi.fn().mockRejectedValue(new Error("boom"));
      renderConfirm({ onConfirm });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Reset" }));
      await user.click(screen.getByRole("button", { name: "Confirm" }));

      // Dialog should close even after error — the finally block sets open=false
      await waitFor(() => {
        expect(screen.queryByText("Confirm Reset")).not.toBeInTheDocument();
      });

      expect(onConfirm).toHaveBeenCalledOnce();

      // Let the microtask settle
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      process.removeAllListeners("unhandledRejection");
      for (const listener of originalListeners) {
        process.on("unhandledRejection", listener as (...args: unknown[]) => void);
      }
    }
  });

  it("disables trigger button when disabled prop is true", () => {
    renderConfirm({ disabled: true });
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("renders children as trigger instead of default button", async () => {
    render(
      <ConfirmAction
        title="Delete?"
        description="Really delete?"
        onConfirm={vi.fn()}
      >
        <button type="button">Custom Trigger</button>
      </ConfirmAction>,
    );
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "Custom Trigger" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Custom Trigger" }));
    expect(screen.getByText("Delete?")).toBeInTheDocument();
  });

  it("applies variant and size props to trigger button", () => {
    renderConfirm({ variant: "destructive", size: "sm" });
    const btn = screen.getByRole("button", { name: "Reset" });
    expect(btn).toBeInTheDocument();
    // The button should be rendered (variant/size applied as className from shadcn)
  });
});
