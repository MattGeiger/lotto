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
const seconds = (value: number) => value * 1000;
const timeZone = "America/Los_Angeles";

describe("polling strategy", () => {
  it("treats pre-open as its own window", () => {
    const hours = buildHours();
    const now = new Date("2026-01-12T18:40:00Z"); // 10:40 AM LA
    const status = getPollingWindowStatus(hours, now, timeZone);
    expect(status.window).toBe("pre-open");
  });

  it("treats post-close slack as open", () => {
    const hours = buildHours();
    const now = new Date("2026-01-12T22:20:00Z"); // 2:20 PM LA
    const status = getPollingWindowStatus(hours, now, timeZone);
    expect(status.window).toBe("open");
  });

  it("returns next pre-open when before the pre-open window", () => {
    const hours = buildHours();
    const now = new Date("2026-01-12T18:15:00Z"); // 10:15 AM LA
    const status = getPollingWindowStatus(hours, now, timeZone);
    expect(status.window).toBe("closed");
    expect(status.nextPreOpenAt?.toISOString()).toBe("2026-01-12T18:30:00.000Z");
  });

  it("uses the 5-minute baseline during pre-open without changes", () => {
    const hours = buildHours();
    const now = new Date("2026-01-12T18:40:00Z"); // 10:40 AM LA
    const result = getPollingIntervalMs({
      now,
      lastChangeAt: null,
      operatingHours: hours,
      timeZone,
    });
    expect(result.delayMs).toBe(minutes(5));
  });

  it("uses the 5-minute baseline during open without changes", () => {
    const hours = buildHours();
    const now = new Date("2026-01-12T20:10:00Z"); // 12:10 PM LA
    const result = getPollingIntervalMs({
      now,
      lastChangeAt: null,
      operatingHours: hours,
      timeZone,
    });
    expect(result.delayMs).toBe(minutes(5));
  });

  it("caps closed polling to the upcoming pre-open start", () => {
    const hours = buildHours();
    const now = new Date("2026-01-12T18:20:00Z"); // 10:20 AM LA
    const result = getPollingIntervalMs({
      now,
      lastChangeAt: null,
      operatingHours: hours,
      timeZone,
    });
    expect(result.delayMs).toBe(minutes(10));
  });

  it("uses the burst interval when inside the burst window", () => {
    const hours = buildHours();
    const now = new Date("2026-01-12T20:00:00Z"); // 12:00 PM LA
    const result = getPollingIntervalMs({
      now,
      lastChangeAt: now.getTime() - minutes(5),
      burstUntil: now.getTime() + minutes(1),
      operatingHours: hours,
      timeZone,
    });
    expect(result.delayMs).toBe(seconds(30));
  });

  it("uses a 1-minute cadence shortly after a change", () => {
    const hours = buildHours();
    const now = new Date("2026-01-12T20:00:00Z"); // 12:00 PM LA
    const result = getPollingIntervalMs({
      now,
      lastChangeAt: now.getTime() - minutes(5),
      operatingHours: hours,
      timeZone,
    });
    expect(result.delayMs).toBe(minutes(1));
  });

  it("uses 15 minutes after long idle while open, 30 minutes while closed", () => {
    const hours = buildHours();
    const openNow = new Date("2026-01-12T20:00:00Z"); // open
    const closedNow = new Date("2026-01-12T17:00:00Z"); // 9:00 AM LA
    const openResult = getPollingIntervalMs({
      now: openNow,
      lastChangeAt: openNow.getTime() - minutes(250),
      operatingHours: hours,
      timeZone,
    });
    const closedResult = getPollingIntervalMs({
      now: closedNow,
      lastChangeAt: closedNow.getTime() - minutes(250),
      operatingHours: hours,
      timeZone,
    });
    expect(openResult.delayMs).toBe(minutes(15));
    expect(closedResult.delayMs).toBe(minutes(30));
  });
});
