import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserInputError } from "@/lib/user-input-error";

vi.mock("@/lib/state-manager", () => ({
  stateManager: {
    generateBatch: vi.fn(),
  },
}));

describe("L2: user-input validation errors should return actionable 400 responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const makeBatchRequest = () =>
    new Request("http://localhost:3000/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generateBatch",
        startNumber: 2,
        endNumber: 40,
        batchSize: 5,
      }),
    });

  it("returns 400 with concrete-bound ASK message for user input errors", async () => {
    const { stateManager } = await import("@/lib/state-manager");
    vi.mocked(stateManager.generateBatch).mockRejectedValue(
      new UserInputError(
        "Start number is locked at 1 after the first draw. Reset to start a new range.",
      ),
    );

    const { POST } = await import("@/app/api/state/route");
    const response = await POST(makeBatchRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      "Start number is locked at 1 after the first draw. Reset to start a new range.",
    );
  });

  it("keeps unknown exceptions generic and non-leaky", async () => {
    const { stateManager } = await import("@/lib/state-manager");
    vi.mocked(stateManager.generateBatch).mockRejectedValue(
      new Error("SENSITIVE: database connection details"),
    );

    const { POST } = await import("@/app/api/state/route");
    const response = await POST(makeBatchRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Unable to process request. Please try again.");
    expect(JSON.stringify(body)).not.toContain("SENSITIVE");
    expect(JSON.stringify(body)).not.toContain("database");
  });
});
