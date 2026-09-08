// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserInputError } from "@/lib/user-input-error";

const mockState = {
  startNumber: 1,
  endNumber: 10,
  mode: "random" as const,
  generatedOrder: [3, 7, 1, 9, 5, 2, 10, 4, 8, 6],
  currentlyServing: 3,
  ticketStatus: {},
  calledAt: {},
  orderLocked: true,
  timestamp: Date.now(),
  displayUrl: null,
  operatingHours: null,
  timezone: "America/Los_Angeles",
};

const mockSnapshots = [
  { id: "snap-1", timestamp: Date.now(), path: "snap-1" },
  { id: "snap-2", timestamp: Date.now() - 60_000, path: "snap-2" },
];

vi.mock("@/lib/state-manager", () => ({
  stateManager: {
    loadState: vi.fn().mockResolvedValue(mockState),
    loadStateWithRevision: vi.fn().mockResolvedValue({ state: mockState, revision: 42 }),
    generateState: vi.fn().mockResolvedValue(mockState),
    generateBatch: vi.fn().mockResolvedValue(mockState),
    appendTickets: vi.fn().mockResolvedValue(mockState),
    extendRange: vi.fn().mockResolvedValue(mockState),
    setMode: vi.fn().mockResolvedValue(mockState),
    updateCurrentlyServing: vi.fn().mockResolvedValue(mockState),
    advanceServing: vi.fn().mockResolvedValue({ ...mockState, currentlyServing: 7 }),
    markTicketReturned: vi.fn().mockResolvedValue(mockState),
    markTicketUnclaimed: vi.fn().mockResolvedValue(mockState),
    revertTicketStatus: vi.fn().mockResolvedValue(mockState),
    resetState: vi.fn().mockResolvedValue(mockState),
    listSnapshots: vi.fn().mockResolvedValue(mockSnapshots),
    restoreSnapshot: vi.fn().mockResolvedValue(mockState),
    undo: vi.fn().mockResolvedValue(mockState),
    redo: vi.fn().mockResolvedValue(mockState),
    setDisplayUrl: vi.fn().mockResolvedValue(mockState),
    setOperatingHours: vi.fn().mockResolvedValue(mockState),
    setDisplayLanguageRotation: vi.fn().mockResolvedValue(mockState),
    setAnnouncement: vi.fn().mockResolvedValue(mockState),
  },
}));

const makePostRequest = (body: Record<string, unknown>) =>
  new Request("http://localhost:3000/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("API /api/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("GET", () => {
    it("returns current state with 200", async () => {
      const { GET } = await import("@/app/api/state/route");
      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.startNumber).toBe(1);
      expect(body.endNumber).toBe(10);
      expect(body.currentlyServing).toBe(3);
      expect(response.headers.get("x-lotto-state-revision")).toBe("42");
    });

    it("returns 500 when loadState fails", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      vi.mocked(stateManager.loadStateWithRevision).mockRejectedValueOnce(
        new Error("DB connection failed"),
      );
      const { GET } = await import("@/app/api/state/route");
      const response = await GET();
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  describe("POST — action routing", () => {
    it("routes generate action to generateState", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({
          action: "generate",
          startNumber: 1,
          endNumber: 50,
          mode: "random",
        }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.generateState).toHaveBeenCalledWith({
        startNumber: 1,
        endNumber: 50,
        mode: "random",
      });
    });

    it("routes generateBatch action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({
          action: "generateBatch",
          startNumber: 1,
          endNumber: 50,
          batchSize: 10,
        }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.generateBatch).toHaveBeenCalledWith({
        startNumber: 1,
        endNumber: 50,
        batchSize: 10,
      });
    });

    it("routes append action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "append", endNumber: 20 }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.appendTickets).toHaveBeenCalledWith(20);
    });

    it("routes extendRange action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "extendRange", endNumber: 30 }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.extendRange).toHaveBeenCalledWith(30);
    });

    it("routes setMode action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "setMode", mode: "sequential" }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.setMode).toHaveBeenCalledWith("sequential");
    });

    it("routes advanceServing next", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "advanceServing", direction: "next" }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.advanceServing).toHaveBeenCalledWith("next");
    });

    it("routes advanceServing prev", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "advanceServing", direction: "prev" }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.advanceServing).toHaveBeenCalledWith("prev");
    });

    it("routes markReturned action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "markReturned", ticketNumber: 5 }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.markTicketReturned).toHaveBeenCalledWith(5);
    });

    it("routes markUnclaimed action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "markUnclaimed", ticketNumber: 7 }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.markTicketUnclaimed).toHaveBeenCalledWith(7);
    });

    it("routes revertTicketStatus action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "revertTicketStatus", ticketNumber: 5 }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.revertTicketStatus).toHaveBeenCalledWith(5);
    });

    it("rejects revertTicketStatus without a ticket number", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(makePostRequest({ action: "revertTicketStatus" }));
      expect(response.status).toBe(400);
    });

    it("routes setAnnouncement action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const announcement = {
        enabled: true,
        markdown: "## Hi",
        startsAt: null,
        endsAt: null,
        updatedAt: 123,
      };
      const response = await POST(makePostRequest({ action: "setAnnouncement", announcement }));
      expect(response.status).toBe(200);
      expect(stateManager.setAnnouncement).toHaveBeenCalledWith(announcement);
    });

    it("accepts a null announcement (clearing it)", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(makePostRequest({ action: "setAnnouncement", announcement: null }));
      expect(response.status).toBe(200);
    });

    it("rejects an announcement longer than 1800 characters", async () => {
      const { POST } = await import("@/app/api/state/route");
      const announcement = {
        enabled: true,
        markdown: "a".repeat(1801),
        startsAt: null,
        endsAt: null,
        updatedAt: 1,
      };
      const response = await POST(makePostRequest({ action: "setAnnouncement", announcement }));
      expect(response.status).toBe(400);
    });

    it("routes reset action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(makePostRequest({ action: "reset" }));
      expect(response.status).toBe(200);
      expect(stateManager.resetState).toHaveBeenCalled();
    });

    it("routes listSnapshots action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "listSnapshots" }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(2);
      expect(stateManager.listSnapshots).toHaveBeenCalled();
    });

    it("routes restoreSnapshot action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "restoreSnapshot", id: "snap-1" }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.restoreSnapshot).toHaveBeenCalledWith("snap-1");
    });

    it("routes undo action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(makePostRequest({ action: "undo" }));
      expect(response.status).toBe(200);
      expect(stateManager.undo).toHaveBeenCalled();
    });

    it("routes redo action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(makePostRequest({ action: "redo" }));
      expect(response.status).toBe(200);
      expect(stateManager.redo).toHaveBeenCalled();
    });

    it("routes updateServing with null (clear)", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "updateServing", currentlyServing: null }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.updateCurrentlyServing).toHaveBeenCalledWith(null);
    });

    it("routes getDisplayUrl action", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "getDisplayUrl" }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("displayUrl");
    });

    it("routes setOperatingHours action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const hours = {
        sunday: { isOpen: false, openTime: "09:00:00", closeTime: "17:00:00" },
        monday: { isOpen: true, openTime: "09:00:00", closeTime: "17:00:00" },
        tuesday: { isOpen: true, openTime: "09:00:00", closeTime: "17:00:00" },
        wednesday: { isOpen: true, openTime: "09:00:00", closeTime: "17:00:00" },
        thursday: { isOpen: true, openTime: "09:00:00", closeTime: "17:00:00" },
        friday: { isOpen: true, openTime: "09:00:00", closeTime: "17:00:00" },
        saturday: { isOpen: false, openTime: "09:00:00", closeTime: "17:00:00" },
      };
      const response = await POST(
        makePostRequest({
          action: "setOperatingHours",
          hours,
          timezone: "America/New_York",
        }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.setOperatingHours).toHaveBeenCalledWith(
        hours,
        "America/New_York",
      );
    });

    it("routes setDisplayLanguageRotation action", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const config = { enabled: true, languages: ["en", "es", "ar"], intervalSeconds: 120 };
      const response = await POST(
        makePostRequest({ action: "setDisplayLanguageRotation", config }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.setDisplayLanguageRotation).toHaveBeenCalledWith(config);
    });

    it("normalizes setDisplayLanguageRotation languages into canonical order", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({
          action: "setDisplayLanguageRotation",
          config: { enabled: true, languages: ["ar", "en", "es"], intervalSeconds: 120 },
        }),
      );

      expect(response.status).toBe(200);
      expect(stateManager.setDisplayLanguageRotation).toHaveBeenCalledWith({
        enabled: true,
        languages: ["en", "es", "ar"],
        intervalSeconds: 120,
      });
    });

    it("accepts a null setDisplayLanguageRotation config (disable)", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "setDisplayLanguageRotation", config: null }),
      );
      expect(response.status).toBe(200);
      expect(stateManager.setDisplayLanguageRotation).toHaveBeenCalledWith(null);
    });
  });

  describe("POST — validation errors", () => {
    it("rejects setDisplayLanguageRotation with an invalid language code", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({
          action: "setDisplayLanguageRotation",
          config: { enabled: true, languages: ["en", "xx"], intervalSeconds: 120 },
        }),
      );
      expect(response.status).toBe(400);
    });

    it("rejects setDisplayLanguageRotation with an out-of-range interval", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({
          action: "setDisplayLanguageRotation",
          config: { enabled: true, languages: ["en"], intervalSeconds: 99_999 },
        }),
      );
      expect(response.status).toBe(400);
    });

    it("rejects setDisplayLanguageRotation with an interval below one minute", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({
          action: "setDisplayLanguageRotation",
          config: { enabled: true, languages: ["en"], intervalSeconds: 59 },
        }),
      );
      expect(response.status).toBe(400);
    });

    it("rejects setDisplayLanguageRotation with duplicate languages", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({
          action: "setDisplayLanguageRotation",
          config: { enabled: true, languages: ["en", "en"], intervalSeconds: 120 },
        }),
      );
      expect(response.status).toBe(400);
    });

    it("rejects setDisplayLanguageRotation with no languages", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({
          action: "setDisplayLanguageRotation",
          config: { enabled: true, languages: [], intervalSeconds: 120 },
        }),
      );
      expect(response.status).toBe(400);
    });

    it("rejects invalid action payload with 400", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "generate", startNumber: "abc" }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it("rejects unknown action with 400", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "nonexistent" }),
      );
      expect(response.status).toBe(400);
    });

    it("rejects empty body with 400", async () => {
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(makePostRequest({}));
      expect(response.status).toBe(400);
    });
  });

  describe("POST — error handling", () => {
    it("returns 400 for UserInputError from state manager", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      vi.mocked(stateManager.advanceServing).mockRejectedValueOnce(
        new UserInputError("No tickets have been generated yet."),
      );
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(
        makePostRequest({ action: "advanceServing", direction: "next" }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("No tickets have been generated yet.");
    });

    it("returns 500 for generic errors", async () => {
      const { stateManager } = await import("@/lib/state-manager");
      vi.mocked(stateManager.resetState).mockRejectedValueOnce(
        new Error("Unexpected DB error"),
      );
      const { POST } = await import("@/app/api/state/route");
      const response = await POST(makePostRequest({ action: "reset" }));
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Unable to process request. Please try again.");
    });
  });
});
