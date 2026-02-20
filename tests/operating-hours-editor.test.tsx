import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OperatingHoursEditor } from "@/components/operating-hours-editor";
import type { OperatingHours } from "@/lib/state-types";

// --- Fixtures -------------------------------------------------------------

const allOpen: OperatingHours = {
  sunday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
  monday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
  tuesday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
  wednesday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
  thursday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
  friday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
  saturday: { isOpen: true, openTime: "10:00", closeTime: "14:00" },
};

const mixedHours: OperatingHours = {
  sunday: { isOpen: false, openTime: "10:00", closeTime: "14:00" },
  monday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
  tuesday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
  wednesday: { isOpen: false, openTime: "08:00", closeTime: "16:00" },
  thursday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
  friday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
  saturday: { isOpen: false, openTime: "10:00", closeTime: "14:00" },
};

// --- Helpers --------------------------------------------------------------

function renderEditor(overrides?: Partial<Parameters<typeof OperatingHoursEditor>[0]>) {
  const defaults = {
    hours: allOpen,
    timezone: "America/Los_Angeles",
    onChange: vi.fn(),
    onTimezoneChange: vi.fn(),
    disabled: false,
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<OperatingHoursEditor {...props} />), props };
}

// --- Tests ----------------------------------------------------------------

describe("OperatingHoursEditor", () => {
  it("renders all 7 day labels", () => {
    renderEditor();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const day of days) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  it("renders 7 checkbox controls for day toggles", () => {
    renderEditor();
    // Each day has a checkbox (role=checkbox from shadcn Checkbox)
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(7);
  });

  it("shows CLOSED text for days that are not open", () => {
    renderEditor({ hours: mixedHours });
    // Sunday, Wednesday, Saturday are closed
    const closedLabels = screen.getAllByText("CLOSED");
    expect(closedLabels).toHaveLength(3);
  });

  it("shows time inputs only for open days", () => {
    renderEditor({ hours: mixedHours });
    // 4 open days * 2 time inputs each = 8 time inputs
    const timeInputs = screen.getAllByDisplayValue(/^\d{2}:\d{2}$/);
    expect(timeInputs).toHaveLength(8);
  });

  it("calls onChange when a day checkbox is toggled", async () => {
    const onChange = vi.fn();
    renderEditor({ hours: mixedHours, onChange });
    const user = userEvent.setup();

    // Sunday is closed (first checkbox). Click to open it.
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]); // Sunday

    expect(onChange).toHaveBeenCalledOnce();
    const updated = onChange.mock.calls[0][0] as OperatingHours;
    expect(updated.sunday.isOpen).toBe(true);
    // Other days unchanged
    expect(updated.monday.isOpen).toBe(true);
    expect(updated.wednesday.isOpen).toBe(false);
  });

  it("calls onChange when a time input is modified", async () => {
    const onChange = vi.fn();
    renderEditor({ hours: allOpen, onChange });
    const user = userEvent.setup();

    // Find all time inputs — first one should be Sunday's openTime "09:00"
    const timeInputs = screen.getAllByDisplayValue("09:00");
    expect(timeInputs.length).toBeGreaterThan(0);

    // Change the value
    await user.clear(timeInputs[0]);
    await user.type(timeInputs[0], "11:00");

    expect(onChange).toHaveBeenCalled();
  });

  it("disables all checkboxes when disabled prop is true", () => {
    renderEditor({ disabled: true });
    const checkboxes = screen.getAllByRole("checkbox");
    for (const cb of checkboxes) {
      expect(cb).toBeDisabled();
    }
  });

  it("disables all time inputs when disabled prop is true", () => {
    renderEditor({ disabled: true });
    const timeInputs = screen.getAllByDisplayValue(/^\d{2}:\d{2}$/);
    for (const input of timeInputs) {
      expect(input).toBeDisabled();
    }
  });

  it("populates initial time values correctly", () => {
    renderEditor({ hours: allOpen });
    // Sunday openTime=09:00
    expect(screen.getByDisplayValue("09:00")).toBeInTheDocument();
    // Saturday openTime=10:00 closeTime=14:00
    expect(screen.getByDisplayValue("10:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("14:00")).toBeInTheDocument();
  });
});
