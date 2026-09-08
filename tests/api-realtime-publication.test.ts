// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const getRealtimePublicationStatus = vi.fn();
const retryLatestRealtimePublication = vi.fn();

vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/admin-email-policy", () => ({
  isAdminEmailAllowed: (email: string) => email === "admin@example.org",
}));
vi.mock("@/lib/state-manager", () => ({
  stateManager: {
    getRealtimePublicationStatus,
    retryLatestRealtimePublication,
  },
}));

describe("beta realtime publication diagnostics API", () => {
  const previousDeploymentEnvironment = process.env.LOTTO_DEPLOYMENT_ENVIRONMENT;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOTTO_DEPLOYMENT_ENVIRONMENT = "beta";
    delete process.env.AUTH_BYPASS;
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (previousDeploymentEnvironment === undefined) {
      delete process.env.LOTTO_DEPLOYMENT_ENVIRONMENT;
    } else {
      process.env.LOTTO_DEPLOYMENT_ENVIRONMENT = previousDeploymentEnvironment;
    }
  });

  it("is unavailable outside a realtime-eligible deployment and performs no auth or datastore work", async () => {
    // Production is now eligible alongside beta, so the ineligible case has to
    // be a genuinely ineligible value. The point of the assertion is unchanged:
    // an ineligible deployment short-circuits before touching auth or the
    // datastore.
    process.env.LOTTO_DEPLOYMENT_ENVIRONMENT = "staging";
    const { GET, POST } = await import("@/app/api/state/realtime/route");

    expect((await GET()).status).toBe(404);
    expect((await POST()).status).toBe(404);
    expect(auth).not.toHaveBeenCalled();
    expect(getRealtimePublicationStatus).not.toHaveBeenCalled();
    expect(retryLatestRealtimePublication).not.toHaveBeenCalled();
  });

  it("is reachable in production but still demands an administrator session", async () => {
    process.env.LOTTO_DEPLOYMENT_ENVIRONMENT = "production";
    auth.mockResolvedValue(null);
    const { GET, POST } = await import("@/app/api/state/realtime/route");

    // 403, not 404: the route exists in production and refuses on authority.
    expect((await GET()).status).toBe(403);
    expect((await POST()).status).toBe(403);
    expect(getRealtimePublicationStatus).not.toHaveBeenCalled();
    expect(retryLatestRealtimePublication).not.toHaveBeenCalled();
  });

  it("requires an administrator session for status and repair", async () => {
    auth.mockResolvedValue(null);
    const { GET, POST } = await import("@/app/api/state/realtime/route");

    expect((await GET()).status).toBe(403);
    expect((await POST()).status).toBe(403);
    expect(getRealtimePublicationStatus).not.toHaveBeenCalled();
    expect(retryLatestRealtimePublication).not.toHaveBeenCalled();
  });

  it("rejects a signed-in email outside the administrator policy", async () => {
    auth.mockResolvedValue({ user: { email: "other@example.org" } });
    const { POST } = await import("@/app/api/state/realtime/route");

    expect((await POST()).status).toBe(403);
    expect(retryLatestRealtimePublication).not.toHaveBeenCalled();
  });

  it("returns no-store publication metadata without payload or credentials", async () => {
    auth.mockResolvedValue({ user: { email: "admin@example.org" } });
    getRealtimePublicationStatus.mockResolvedValue({
      enabled: true,
      latest: {
        publicationId: "publication-15",
        revision: 15,
        status: "failed",
        attemptCount: 1,
        committedAt: "2026-09-01T20:00:00.000Z",
        lastAttemptAt: "2026-09-01T20:00:01.000Z",
        acceptedAt: null,
        lastError: "Realtime hub rejected publication (401).",
        updatedAt: "2026-09-01T20:00:01.000Z",
      },
    });
    const { GET } = await import("@/app/api/state/realtime/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      status: { enabled: true, latest: { revision: 15, status: "failed" } },
    });
    expect(JSON.stringify(body)).not.toContain("payload");
    expect(JSON.stringify(body)).not.toContain("PUBLISH_TOKEN");
  });

  it("performs exactly one newest-publication repair attempt", async () => {
    auth.mockResolvedValue({ user: { email: "admin@example.org" } });
    retryLatestRealtimePublication.mockResolvedValue({
      enabled: true,
      attempted: true,
      revision: 15,
      accepted: true,
    });
    const { POST } = await import("@/app/api/state/realtime/route");

    const response = await POST();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      repair: { enabled: true, attempted: true, revision: 15, accepted: true },
    });
    expect(retryLatestRealtimePublication).toHaveBeenCalledTimes(1);
  });

  it("returns generic non-leaking errors when status or repair fails", async () => {
    auth.mockResolvedValue({ user: { email: "admin@example.org" } });
    getRealtimePublicationStatus.mockRejectedValue(new Error("postgres://secret@host/db"));
    retryLatestRealtimePublication.mockRejectedValue(new Error("Bearer secret-token"));
    const { GET, POST } = await import("@/app/api/state/realtime/route");

    const statusBody = JSON.stringify(await (await GET()).json());
    const repairBody = JSON.stringify(await (await POST()).json());

    expect(statusBody).toContain("REALTIME_STATUS_FAILED");
    expect(repairBody).toContain("REALTIME_REPAIR_FAILED");
    expect(statusBody).not.toContain("postgres://");
    expect(repairBody).not.toContain("secret-token");
  });
});
