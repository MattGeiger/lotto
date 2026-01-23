import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldWarnTimezoneMismatch } from "@/lib/timezone-utils";

describe("timezone utils", () => {
  const referenceDate = new Date("2026-01-12T12:00:00Z");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns when the timezone offset differs beyond the threshold", () => {
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(0);
    expect(shouldWarnTimezoneMismatch("America/Los_Angeles", referenceDate, 55)).toBe(true);
  });

  it("does not warn when offsets match", () => {
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(480);
    expect(shouldWarnTimezoneMismatch("America/Los_Angeles", referenceDate, 55)).toBe(false);
  });
});
