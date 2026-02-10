import { describe, expect, it, vi, beforeEach } from "vitest";

import { defaultState } from "@/lib/state-types";

vi.mock("@/lib/state-manager", () => ({
  stateManager: {
    setOperatingHours: vi.fn().mockResolvedValue({}),
  },
}));

describe("M4: setOperatingHours must validate hours shape and timezone", () => {
  const validHours = defaultState.operatingHours;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const postAction = async (hours: unknown, timezone: string) => {
    const { POST } = await import("@/app/api/state/route");
    const request = new Request("http://localhost:3000/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setOperatingHours", hours, timezone }),
    });
    return POST(request);
  };

  it("accepts valid operating hours with valid timezone", async () => {
    const response = await postAction(validHours, "America/Los_Angeles");
    expect(response.status).toBe(200);
  });

  it("rejects a string value for hours", async () => {
    const response = await postAction("not an object", "America/Los_Angeles");
    expect(response.status).toBe(400);
  });

  it("rejects a number value for hours", async () => {
    const response = await postAction(42, "America/Los_Angeles");
    expect(response.status).toBe(400);
  });

  it("rejects hours with missing days", async () => {
    const incompleteHours = {
      monday: { isOpen: true, openTime: "10:00:00", closeTime: "14:00:00" },
    };
    const response = await postAction(incompleteHours, "America/Los_Angeles");
    expect(response.status).toBe(400);
  });

  it("rejects hours with invalid isOpen type", async () => {
    const badHours = {
      ...validHours,
      monday: { isOpen: "yes", openTime: "10:00:00", closeTime: "14:00:00" },
    };
    const response = await postAction(badHours, "America/Los_Angeles");
    expect(response.status).toBe(400);
  });

  it("rejects invalid timezone string", async () => {
    const response = await postAction(validHours, "garbage");
    expect(response.status).toBe(400);
  });

  it("rejects empty timezone string", async () => {
    const response = await postAction(validHours, "");
    expect(response.status).toBe(400);
  });

  it("accepts valid IANA timezones", async () => {
    for (const tz of ["America/New_York", "Europe/London", "Asia/Tokyo", "UTC"]) {
      const response = await postAction(validHours, tz);
      expect(response.status, `Expected ${tz} to be accepted`).toBe(200);
    }
  });
});
