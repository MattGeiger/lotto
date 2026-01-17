import { describe, expect, it } from "vitest";

import { getPollingIntervalMs, getPollingWindowStatus } from "@/lib/polling-strategy";
import type { OperatingHours } from "@/lib/state-types";

const buildHours = (): OperatingHours => ({
  sunday: { isOpen: false, openTime: "11:00:00", closeTime: "14:00:00" },
  monday: { isOpen: true, openTime: "11:00:00", closeTime: "14:00:00" },
  tuesday: { isOpen: true, openTime: "11:00:00", closeTime: "14:00:00" },
  wednesday: { isOpen: false, openTime: "11:00:00", closeTime: "14:00:00" },
  thursday: { isOpen: false, openTime: "11:00:00", closeTime: "14:00:00" },
  friday: { isOpen: false, openTime: "11:00:00", closeTime: "14:00:00" },
  saturday: { isOpen: false, openTime: "11:00:00", closeTime: "14:00:00" },
});

const minutes = (value: number) => value * 60 * 1000;

describe("polling strategy", () => {
  it("treats the open window with slack as open", () => {
    const hours = buildHours();
    const now = new Date(2026, 0, 12, 10, 50, 0); // Monday
    const status = getPollingWindowStatus(hours, now, 15);
    expect(status.isOpenWindow).toBe(true);
  });

  it("returns the next open window when before slack", () => {
    const hours = buildHours();
    const now = new Date(2026, 0, 12, 10, 40, 0); // Monday
    const status = getPollingWindowStatus(hours, now, 15);
    expect(status.isOpenWindow).toBe(false);
    expect(status.nextOpenAt).not.toBeNull();
    expect(status.nextOpenAt?.getHours()).toBe(10);
    expect(status.nextOpenAt?.getMinutes()).toBe(45);
  });

  it("uses the open-active ladder for recent changes", () => {
    const hours = buildHours();
    const now = new Date(2026, 0, 12, 12, 0, 0);
    const result = getPollingIntervalMs({
      now,
      lastChangeAt: now.getTime() - minutes(5),
      operatingHours: hours,
      pollStep: 0,
    });
    expect(result.ladder).toBe("open-active");
    expect(result.delayMs).toBe(10 * 1000);
  });

  it("switches to the 10-minute idle ladder after 10 minutes", () => {
    const hours = buildHours();
    const now = new Date(2026, 0, 12, 12, 0, 0);
    const result = getPollingIntervalMs({
      now,
      lastChangeAt: now.getTime() - minutes(12),
      operatingHours: hours,
      pollStep: 1,
    });
    expect(result.ladder).toBe("open-idle-10m");
    expect(result.delayMs).toBe(minutes(10));
  });

  it("caps open idle polling at 120 minutes when inactive long enough", () => {
    const hours = buildHours();
    const now = new Date(2026, 0, 12, 12, 0, 0);
    const result = getPollingIntervalMs({
      now,
      lastChangeAt: now.getTime() - minutes(130),
      operatingHours: hours,
      pollStep: 2,
    });
    expect(result.ladder).toBe("open-idle-120m");
    expect(result.delayMs).toBe(minutes(120));
  });

  it("caps closed polling based on time to open", () => {
    const hours = buildHours();
    const now = new Date(2026, 0, 12, 9, 45, 0); // Monday, before slack
    const result = getPollingIntervalMs({
      now,
      lastChangeAt: now.getTime() - minutes(200),
      operatingHours: hours,
      pollStep: 3,
    });
    expect(result.ladder).toBe("closed");
    expect(result.delayMs).toBe(minutes(30));
  });
});
