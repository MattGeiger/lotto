import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/state-manager", () => ({
  stateManager: {
    loadState: vi.fn().mockResolvedValue({
      startNumber: 1,
      endNumber: 10,
      mode: "random",
      generatedOrder: [3, 1, 4, 1, 5, 9, 2, 6, 5, 8],
      currentlyServing: null,
      ticketStatus: {},
      calledAt: {},
      orderLocked: true,
      timestamp: Date.now(),
      displayUrl: null,
      operatingHours: null,
      timezone: "America/Los_Angeles",
    }),
    advanceServing: vi.fn().mockResolvedValue({ currentlyServing: 1 }),
  },
}));

describe("M1: state mutation endpoints must be rate limited", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 429 after exceeding rate limit threshold", async () => {
    const { POST } = await import("@/app/api/state/route");

    const makeRequest = () =>
      new Request("http://localhost:3000/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "advanceServing",
          direction: "next",
        }),
      });

    // Send requests up to and beyond the limit
    const responses: Response[] = [];
    for (let i = 0; i < 35; i++) {
      const response = await POST(makeRequest());
      responses.push(response);
    }

    // At least some of the later requests should be rate limited
    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);

    // The rate limited response should have a clear error message
    const body = await rateLimited[0].json();
    expect(body.error).toBeDefined();
  });

  it("allows requests within the rate limit", async () => {
    const { POST } = await import("@/app/api/state/route");

    const makeRequest = () =>
      new Request("http://localhost:3000/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "advanceServing",
          direction: "next",
        }),
      });

    // A small number of requests should all succeed
    const responses: Response[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest());
      responses.push(response);
    }

    const allOk = responses.every((r) => r.status === 200);
    expect(allOk).toBe(true);
  });
});
