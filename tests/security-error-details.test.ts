import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/state-manager", () => ({
  stateManager: {
    loadState: vi.fn(),
    generateState: vi.fn(),
  },
}));

describe("L1: API error responses must not leak internal details", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/state does not include error details in response", async () => {
    const { stateManager } = await import("@/lib/state-manager");
    vi.mocked(stateManager.loadState).mockRejectedValue(
      new Error("SENSITIVE: connection to postgresql://user:password@host/db failed"),
    );

    const { GET } = await import("@/app/api/state/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBeDefined();
    // Must NOT contain the sensitive error details
    expect(JSON.stringify(body)).not.toContain("SENSITIVE");
    expect(JSON.stringify(body)).not.toContain("postgresql");
    expect(JSON.stringify(body)).not.toContain("password");
    expect(body.details).toBeUndefined();
  });

  it("POST /api/state does not include error details in response", async () => {
    const { stateManager } = await import("@/lib/state-manager");
    vi.mocked(stateManager.generateState).mockRejectedValue(
      new Error("SENSITIVE: database connection string leaked here"),
    );

    const { POST } = await import("@/app/api/state/route");
    const request = new Request("http://localhost:3000/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate",
        startNumber: 1,
        endNumber: 10,
        mode: "random",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("SENSITIVE");
    expect(JSON.stringify(body)).not.toContain("database connection");
    expect(body.details).toBeUndefined();
  });
});
