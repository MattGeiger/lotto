import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/state-manager", () => ({
  stateManager: {
    setDisplayUrl: vi.fn().mockResolvedValue({ displayUrl: null }),
  },
}));

describe("M2: setDisplayUrl must restrict URL schemes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const postAction = async (url: string | null) => {
    const { POST } = await import("@/app/api/state/route");
    const request = new Request("http://localhost:3000/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setDisplayUrl", url }),
    });
    return POST(request);
  };

  it("rejects javascript: URLs", async () => {
    const response = await postAction("javascript:alert(1)");
    expect(response.status).toBe(400);
  });

  it("rejects data: URLs", async () => {
    const response = await postAction("data:text/html,<h1>hi</h1>");
    expect(response.status).toBe(400);
  });

  it("rejects file: URLs", async () => {
    const response = await postAction("file:///etc/passwd");
    expect(response.status).toBe(400);
  });

  it("rejects ftp: URLs", async () => {
    const response = await postAction("ftp://example.com/file");
    expect(response.status).toBe(400);
  });

  it("accepts https: URLs", async () => {
    const response = await postAction("https://example.com");
    expect(response.status).toBe(200);
  });

  it("accepts http: URLs", async () => {
    const response = await postAction("http://localhost:3000");
    expect(response.status).toBe(200);
  });

  it("accepts null (clearing the URL)", async () => {
    const response = await postAction(null);
    expect(response.status).toBe(200);
  });
});
