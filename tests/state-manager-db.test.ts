// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hashPublicState,
  publicStateEnvelopeSchema,
  toPublicRaffleState,
} from "@/lib/realtime/public-state-protocol";
import { defaultState, type DisplayLanguageRotation } from "@/lib/state-types";
import { UserInputError } from "@/lib/user-input-error";

// --- Mock the neon SQL client ---

let mockQueryResults: unknown[];
let mockTransactionResults: unknown[];
let mockDirectSql: string[];
let mockTransactionSql: string[];

// Tagged template function that simulates neon's sql``
const mockSql = vi.fn(async (strings: TemplateStringsArray) => {
  mockDirectSql.push(strings.join("?"));
  const result = mockQueryResults.shift() ?? [];
  if (result instanceof Error) throw result;
  return result;
}) as unknown as ReturnType<typeof import("@neondatabase/serverless").neon>;

// Attach .transaction to the mock sql function
const mockTransactionFn = vi.fn(async (callback: (tx: unknown) => unknown[]) => {
  // tx is a tagged template too — simulate it but don't execute real SQL
  const mockTx = vi.fn((strings: TemplateStringsArray) => {
    mockTransactionSql.push(strings.join("?"));
    const result = mockTransactionResults.shift() ?? [
      { revision: 1, committed_at: "2026-09-01T12:00:00.000Z" },
    ];
    if (result instanceof Error) return Promise.reject(result);
    return Promise.resolve(result);
  });
  const statements = callback(mockTx);
  return Promise.all(statements as Promise<unknown>[]);
});
(mockSql as unknown as Record<string, unknown>).transaction = mockTransactionFn;

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

// Helper: build a state with an active range and generated order
const activeState = (overrides?: Partial<typeof defaultState>) => ({
  ...defaultState,
  startNumber: 1,
  endNumber: 10,
  mode: "random" as const,
  generatedOrder: [3, 7, 1, 9, 5, 2, 10, 4, 8, 6],
  currentlyServing: 3,
  ticketStatus: {},
  calledAt: {},
  orderLocked: true,
  timestamp: Date.now(),
  ...overrides,
});

// Helper: queue a SELECT result that returns a state payload
const queueStateRow = (state: typeof defaultState) => {
  mockQueryResults.push([{ payload: state, revision: 11 }]);
};

// Helper: queue an empty SELECT result (no state in DB)
const queueEmptyState = () => {
  mockQueryResults.push([]);
};

describe("createDbStateManager", () => {
  let manager: ReturnType<typeof import("@/lib/state-manager-db").createDbStateManager>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockQueryResults = [];
    mockTransactionResults = [];
    mockDirectSql = [];
    mockTransactionSql = [];
    // Reset redo state by re-creating the manager
    const { createDbStateManager } = await import("@/lib/state-manager-db");
    manager = createDbStateManager("postgresql://test:test@localhost:5432/test");
  });

  describe("initialization", () => {
    it("throws without DATABASE_URL", async () => {
      const { createDbStateManager } = await import("@/lib/state-manager-db");
      expect(() => createDbStateManager("")).toThrow("DATABASE_URL is required");
    });
  });

  describe("loadState", () => {
    it("returns state from DB when present", async () => {
      const state = activeState();
      queueStateRow(state);
      const result = await manager.loadState();
      expect(result.startNumber).toBe(1);
      expect(result.endNumber).toBe(10);
      expect(result.currentlyServing).toBe(3);
    });

    it("returns the state and authoritative revision from one read", async () => {
      const state = activeState();
      queueStateRow(state);
      await expect(manager.loadStateWithRevision()).resolves.toMatchObject({
        state: { currentlyServing: 3 },
        revision: 11,
      });
      expect(mockDirectSql[0]).toContain("select payload, revision from raffle_state");
      expect(mockDirectSql).toHaveLength(1);
    });

    it("returns default state when DB is empty (and persists it)", async () => {
      queueEmptyState();
      // persist will call sql.transaction
      const result = await manager.loadState();
      expect(result.startNumber).toBe(0);
      expect(result.endNumber).toBe(0);
      expect(result.generatedOrder).toEqual([]);
      expect(mockTransactionFn).toHaveBeenCalled();
    });

    it("merges DB payload with defaults for missing fields", async () => {
      // Simulate a payload that's missing some fields (e.g., operatingHours)
      const partialPayload = {
        startNumber: 1,
        endNumber: 5,
        mode: "sequential",
        generatedOrder: [1, 2, 3, 4, 5],
        currentlyServing: 1,
        timestamp: Date.now(),
      };
      mockQueryResults.push([{ payload: partialPayload, revision: 12 }]);
      const result = await manager.loadState();
      expect(result.startNumber).toBe(1);
      // Should have defaults merged in
      expect(result).toHaveProperty("ticketStatus");
      expect(result).toHaveProperty("orderLocked");
    });
  });

  describe("generateState", () => {
    it("generates sequential order when mode is sequential", async () => {
      queueStateRow(defaultState);
      const result = await manager.generateState({
        startNumber: 1,
        endNumber: 5,
        mode: "sequential",
      });
      expect(result.generatedOrder).toEqual([1, 2, 3, 4, 5]);
      expect(result.startNumber).toBe(1);
      expect(result.endNumber).toBe(5);
      expect(result.orderLocked).toBe(true);
    });

    it("generates shuffled order when mode is random", async () => {
      queueStateRow(defaultState);
      const result = await manager.generateState({
        startNumber: 1,
        endNumber: 5,
        mode: "random",
      });
      // Should contain the same elements, possibly in different order
      expect(new Set(result.generatedOrder)).toEqual(new Set([1, 2, 3, 4, 5]));
      expect(result.generatedOrder).toHaveLength(5);
    });

    it("throws UserInputError for invalid range", async () => {
      queueStateRow(defaultState);
      await expect(
        manager.generateState({ startNumber: -1, endNumber: 5, mode: "random" }),
      ).rejects.toThrow(UserInputError);
    });

    it("throws UserInputError when end <= start (requireStrictEnd)", async () => {
      queueStateRow(defaultState);
      await expect(
        manager.generateState({ startNumber: 5, endNumber: 5, mode: "random" }),
      ).rejects.toThrow("End number must be greater than start number.");
    });

    it("throws UserInputError when order is locked", async () => {
      queueStateRow(activeState());
      await expect(
        manager.generateState({ startNumber: 1, endNumber: 10, mode: "random" }),
      ).rejects.toThrow("Order is locked");
    });

    it("throws UserInputError for numbers exceeding 999999", async () => {
      queueStateRow(defaultState);
      await expect(
        manager.generateState({ startNumber: 1, endNumber: 1_000_000, mode: "random" }),
      ).rejects.toThrow("6 digits or fewer");
    });
  });

  describe("advanceServing", () => {
    it("advances to the next ticket", async () => {
      const state = activeState({ currentlyServing: 3 });
      // generatedOrder: [3, 7, 1, 9, 5, 2, 10, 4, 8, 6]
      // currentIndex of 3 is 0, next is index 1 = ticket 7
      queueStateRow(state);
      const result = await manager.advanceServing("next");
      expect(result.currentlyServing).toBe(7);
    });

    it("advances to the previous ticket", async () => {
      const state = activeState({ currentlyServing: 7 });
      // currentIndex of 7 is 1, prev is index 0 = ticket 3
      queueStateRow(state);
      const result = await manager.advanceServing("prev");
      expect(result.currentlyServing).toBe(3);
    });

    it("skips returned tickets when advancing next", async () => {
      const state = activeState({
        currentlyServing: 3,
        ticketStatus: { 7: "returned" } as Record<number, "returned">,
      });
      // next after 3 (index 0) should skip 7 (index 1) → land on 1 (index 2)
      queueStateRow(state);
      const result = await manager.advanceServing("next");
      expect(result.currentlyServing).toBe(1);
    });

    it("starts from first ticket when nothing is currently serving", async () => {
      const state = activeState({ currentlyServing: null });
      queueStateRow(state);
      const result = await manager.advanceServing("next");
      expect(result.currentlyServing).toBe(3);
    });

    it("returns current state when no next ticket exists", async () => {
      const state = activeState({
        currentlyServing: 6, // last in order
      });
      queueStateRow(state);
      const result = await manager.advanceServing("next");
      // Should return unchanged
      expect(result.currentlyServing).toBe(6);
    });

    it("throws when no range is set", async () => {
      queueStateRow(defaultState);
      await expect(manager.advanceServing("next")).rejects.toThrow(
        "No active range is set yet.",
      );
    });

    it("throws when no tickets are generated", async () => {
      queueStateRow({
        ...defaultState,
        startNumber: 1,
        endNumber: 10,
        generatedOrder: [],
      });
      await expect(manager.advanceServing("next")).rejects.toThrow(
        "Generate tickets first.",
      );
    });
  });

  describe("markTicketReturned", () => {
    it("marks a ticket as returned", async () => {
      const state = activeState();
      queueStateRow(state);
      const result = await manager.markTicketReturned(5);
      expect(result.ticketStatus[5]).toBe("returned");
    });

    it("auto-advances serving when currently serving ticket is returned", async () => {
      const state = activeState({ currentlyServing: 3 });
      // currentlyServing=3 is at index 0, next non-returned is 7 at index 1
      queueStateRow(state);
      const result = await manager.markTicketReturned(3);
      expect(result.ticketStatus[3]).toBe("returned");
      expect(result.currentlyServing).toBe(7);
    });

    it("throws for ticket outside range", async () => {
      queueStateRow(activeState());
      await expect(manager.markTicketReturned(99)).rejects.toThrow(
        "within the active range",
      );
    });

    it("throws for non-positive integer", async () => {
      queueStateRow(activeState());
      await expect(manager.markTicketReturned(0)).rejects.toThrow(
        "positive integer",
      );
    });
  });

  describe("markTicketUnclaimed", () => {
    it("marks a called ticket as unclaimed", async () => {
      // Ticket 3 is at index 0, currentlyServing is 7 at index 1 → 3 has been called
      const state = activeState({ currentlyServing: 7 });
      queueStateRow(state);
      const result = await manager.markTicketUnclaimed(3);
      expect(result.ticketStatus[3]).toBe("unclaimed");
    });

    it("throws for ticket not yet called (ahead of current)", async () => {
      const state = activeState({ currentlyServing: 3 });
      // Ticket 7 is at index 1, current is at index 0 → 7 hasn't been called
      queueStateRow(state);
      await expect(manager.markTicketUnclaimed(7)).rejects.toThrow(
        "called before it can be marked unclaimed",
      );
    });

    it("throws when nothing is currently serving", async () => {
      queueStateRow(activeState({ currentlyServing: null }));
      await expect(manager.markTicketUnclaimed(3)).rejects.toThrow(
        "No draw position has been called yet.",
      );
    });
  });

  describe("appendTickets", () => {
    it("appends tickets after all current are drawn", async () => {
      // All 10 tickets drawn (generatedOrder covers 1-10), no undrawn
      const state = activeState();
      queueStateRow(state);
      const result = await manager.appendTickets(15);
      expect(result.endNumber).toBe(15);
      // New tickets 11-15 should be added to order
      expect(result.generatedOrder.length).toBe(15);
      const newTickets = result.generatedOrder.slice(10);
      expect(new Set(newTickets)).toEqual(new Set([11, 12, 13, 14, 15]));
    });

    it("throws when undrawn tickets remain", async () => {
      // Only 5 of 10 tickets drawn
      const state = activeState({
        generatedOrder: [3, 7, 1, 9, 5],
      });
      queueStateRow(state);
      await expect(manager.appendTickets(15)).rejects.toThrow(
        "must be drawn before appending",
      );
    });

    it("throws when new end is not greater than current end", async () => {
      const state = activeState();
      queueStateRow(state);
      await expect(manager.appendTickets(5)).rejects.toThrow(
        "greater than 10",
      );
    });
  });

  describe("extendRange", () => {
    it("extends end number without adding to order", async () => {
      const state = activeState();
      queueStateRow(state);
      const result = await manager.extendRange(20);
      expect(result.endNumber).toBe(20);
      // Order should remain unchanged
      expect(result.generatedOrder).toHaveLength(10);
    });

    it("throws when new end is not greater", async () => {
      queueStateRow(activeState());
      await expect(manager.extendRange(8)).rejects.toThrow(
        "greater than 10",
      );
    });
  });

  describe("generateBatch", () => {
    it("generates a batch of undrawn tickets", async () => {
      // Current range 1-10, order has [3,7,1,9,5], so 2,4,6,8,10 are undrawn
      const state = activeState({
        generatedOrder: [3, 7, 1, 9, 5],
        mode: "sequential",
      });
      queueStateRow(state);
      const result = await manager.generateBatch({
        startNumber: 1,
        endNumber: 10,
        batchSize: 3,
      });
      // Should add 3 more undrawn tickets
      expect(result.generatedOrder).toHaveLength(8);
      // New tickets should all be from undrawn pool
      const newTickets = result.generatedOrder.slice(5);
      const undrawnPool = [2, 4, 6, 8, 10];
      for (const ticket of newTickets) {
        expect(undrawnPool).toContain(ticket);
      }
    });

    it("throws when batch size exceeds remaining undrawn", async () => {
      const state = activeState({
        generatedOrder: [3, 7, 1, 9, 5, 2, 10, 4, 8],
        // Only ticket 6 is undrawn
      });
      queueStateRow(state);
      await expect(
        manager.generateBatch({ startNumber: 1, endNumber: 10, batchSize: 5 }),
      ).rejects.toThrow("exceeds remaining undrawn tickets");
    });

    it("throws when all tickets are drawn", async () => {
      queueStateRow(activeState());
      await expect(
        manager.generateBatch({ startNumber: 1, endNumber: 10, batchSize: 1 }),
      ).rejects.toThrow("already been drawn");
    });

    it("throws when start number changes after first draw", async () => {
      const state = activeState();
      queueStateRow(state);
      await expect(
        manager.generateBatch({ startNumber: 5, endNumber: 10, batchSize: 1 }),
      ).rejects.toThrow("locked at 1");
    });
  });

  describe("setMode", () => {
    it("sets mode on empty state", async () => {
      queueStateRow(defaultState);
      const result = await manager.setMode("sequential");
      expect(result.mode).toBe("sequential");
    });

    it("regenerates order when range exists but no order yet", async () => {
      const state = {
        ...defaultState,
        startNumber: 1,
        endNumber: 5,
        generatedOrder: [],
      };
      queueStateRow(state);
      const result = await manager.setMode("sequential");
      expect(result.mode).toBe("sequential");
      expect(result.generatedOrder).toEqual([1, 2, 3, 4, 5]);
    });

    it("preserves existing order when tickets already generated", async () => {
      const state = activeState();
      queueStateRow(state);
      const result = await manager.setMode("sequential");
      expect(result.mode).toBe("sequential");
      // Order should remain the same (already generated)
      expect(result.generatedOrder).toEqual(state.generatedOrder);
    });
  });

  describe("resetState", () => {
    it("resets to default but preserves operating hours and timezone", async () => {
      const hours = {
        ...defaultState.operatingHours!,
        monday: { isOpen: false, openTime: "09:00:00", closeTime: "17:00:00" },
      };
      const state = activeState({
        operatingHours: hours,
        timezone: "Europe/London",
      });
      queueStateRow(state);
      // cleanupOldSnapshots will also call sql`` — queue a result for it
      mockQueryResults.push([]);
      const result = await manager.resetState();
      expect(result.startNumber).toBe(0);
      expect(result.endNumber).toBe(0);
      expect(result.generatedOrder).toEqual([]);
      expect(result.currentlyServing).toBeNull();
      expect(result.operatingHours).toEqual(hours);
      expect(result.timezone).toBe("Europe/London");
    });
  });

  describe("listSnapshots", () => {
    it("returns metadata only (id, timestamp)", async () => {
      mockQueryResults.push([
        { id: "state-20260219-abc123.json", created_at: "2026-02-19T10:00:00Z" },
        { id: "state-20260219-def456.json", created_at: "2026-02-19T09:00:00Z" },
      ]);
      const snapshots = await manager.listSnapshots();
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].id).toBe("state-20260219-abc123.json");
      expect(snapshots[0]).toHaveProperty("timestamp");
      expect(snapshots[0]).toHaveProperty("path");
      // Should NOT contain payload
      expect(snapshots[0]).not.toHaveProperty("payload");
    });

    it("returns empty array when no snapshots exist", async () => {
      mockQueryResults.push([]);
      const snapshots = await manager.listSnapshots();
      expect(snapshots).toHaveLength(0);
    });
  });

  describe("restoreSnapshot", () => {
    it("restores state from a snapshot by id", async () => {
      const snapshotState = activeState({ currentlyServing: 7 });
      mockQueryResults.push([{ payload: snapshotState }]);
      const result = await manager.restoreSnapshot("state-20260219-abc123.json");
      expect(result.currentlyServing).toBe(7);
    });

    it("throws when snapshot not found", async () => {
      mockQueryResults.push([]);
      await expect(
        manager.restoreSnapshot("nonexistent"),
      ).rejects.toThrow("Snapshot not found");
    });
  });

  describe("undo / redo", () => {
    it("undo restores the previous snapshot", async () => {
      // listSnapshots returns 2+ snapshots
      mockQueryResults.push([
        { id: "snap-current", created_at: "2026-02-19T10:01:00Z" },
        { id: "snap-previous", created_at: "2026-02-19T10:00:00Z" },
      ]);
      // restoreSnapshot fetches payload for snap-previous
      const prevState = activeState({ currentlyServing: 1 });
      mockQueryResults.push([{ payload: prevState }]);
      const result = await manager.undo();
      expect(result.currentlyServing).toBe(1);
    });

    it("undo throws when fewer than 2 snapshots", async () => {
      mockQueryResults.push([
        { id: "snap-only", created_at: "2026-02-19T10:00:00Z" },
      ]);
      await expect(manager.undo()).rejects.toThrow("No history available");
    });

    it("redo restores the undone snapshot", async () => {
      // First: undo (sets lastRedoSnapshot)
      mockQueryResults.push([
        { id: "snap-current", created_at: "2026-02-19T10:01:00Z" },
        { id: "snap-previous", created_at: "2026-02-19T10:00:00Z" },
      ]);
      const prevState = activeState({ currentlyServing: 1 });
      mockQueryResults.push([{ payload: prevState }]);
      await manager.undo();

      // Now redo should restore snap-current
      const currentState = activeState({ currentlyServing: 7 });
      mockQueryResults.push([{ payload: currentState }]);
      const result = await manager.redo();
      expect(result.currentlyServing).toBe(7);
    });

    it("redo throws when no undo has been performed", async () => {
      await expect(manager.redo()).rejects.toThrow("No later snapshot to redo to");
    });
  });

  describe("setDisplayUrl", () => {
    it("persists a display URL", async () => {
      queueStateRow(activeState());
      const result = await manager.setDisplayUrl("https://example.com/display");
      expect(result.displayUrl).toBe("https://example.com/display");
    });

    it("clears display URL with null", async () => {
      queueStateRow(activeState({ displayUrl: "https://old.com" }));
      const result = await manager.setDisplayUrl(null);
      expect(result.displayUrl).toBeNull();
    });
  });

  describe("setOperatingHours", () => {
    it("persists operating hours and timezone", async () => {
      const hours = {
        ...defaultState.operatingHours!,
        sunday: { isOpen: true, openTime: "08:00:00", closeTime: "12:00:00" },
      };
      queueStateRow(activeState());
      const result = await manager.setOperatingHours(hours, "America/New_York");
      expect(result.operatingHours).toEqual(hours);
      expect(result.timezone).toBe("America/New_York");
    });
  });

  describe("setDisplayLanguageRotation", () => {
    it("persists a rotation config", async () => {
      const config: DisplayLanguageRotation = {
        enabled: true,
        languages: ["en", "es", "ar"],
        intervalSeconds: 120,
      };
      queueStateRow(activeState());
      const result = await manager.setDisplayLanguageRotation(config);
      expect(result.displayLanguageRotation).toEqual(config);
    });

    it("clears the rotation config with null", async () => {
      const existing: DisplayLanguageRotation = {
        enabled: true,
        languages: ["en"],
        intervalSeconds: 60,
      };
      queueStateRow(activeState({ displayLanguageRotation: existing }));
      const result = await manager.setDisplayLanguageRotation(null);
      expect(result.displayLanguageRotation).toBeNull();
    });

    it("preserves the rotation config across reset", async () => {
      const config: DisplayLanguageRotation = {
        enabled: true,
        languages: ["es"],
        intervalSeconds: 90,
      };
      queueStateRow(activeState({ displayLanguageRotation: config }));
      const result = await manager.resetState();
      expect(result.displayLanguageRotation).toEqual(config);
    });

    it("preserves the rotation config across generate", async () => {
      const config: DisplayLanguageRotation = {
        enabled: true,
        languages: ["ar"],
        intervalSeconds: 90,
      };
      queueStateRow(activeState({ orderLocked: false, displayLanguageRotation: config }));
      const result = await manager.generateState({
        startNumber: 1,
        endNumber: 5,
        mode: "sequential",
      });
      expect(result.displayLanguageRotation).toEqual(config);
    });
  });

  describe("cleanupOldSnapshots", () => {
    it("returns count of deleted snapshots", async () => {
      mockQueryResults.push([{ id: "old-1" }, { id: "old-2" }, { id: "old-3" }]);
      const deleted = await manager.cleanupOldSnapshots(30);
      expect(deleted).toBe(3);
    });

    it("returns 0 when nothing to clean up", async () => {
      mockQueryResults.push([]);
      const deleted = await manager.cleanupOldSnapshots(30);
      expect(deleted).toBe(0);
    });
  });

  describe("timestamp monotonicity", () => {
    it("ensures timestamps never go backwards", async () => {
      queueStateRow(defaultState);
      const result1 = await manager.generateState({
        startNumber: 1,
        endNumber: 5,
        mode: "sequential",
      });

      // Reset manager state to simulate second generate (need to reset orderLocked)
      const stateAfterFirst = { ...result1, orderLocked: false };
      queueStateRow(stateAfterFirst);
      const result2 = await manager.generateState({
        startNumber: 1,
        endNumber: 5,
        mode: "sequential",
      });

      expect(result2.timestamp!).toBeGreaterThanOrEqual(result1.timestamp!);
    });
  });

  describe("realtime shadow publication", () => {
    const enabledEnvironment = {
      LOTTO_DEPLOYMENT_ENVIRONMENT: "beta",
      LOTTO_REALTIME_SHADOW_PUBLISH: "true",
      LOTTO_REALTIME_HUB_URL: "https://lotto-realtime-beta.et2-geiger.workers.dev",
      LOTTO_REALTIME_AGENCY_ID: "william-temple-house",
      LOTTO_REALTIME_PUBLISH_TOKEN: "a".repeat(32),
      LOTTO_REALTIME_PUBLISH_TIMEOUT_MS: "1000",
    };

    type DbStateManager = ReturnType<
      (typeof import("@/lib/state-manager-db"))["createDbStateManager"]
    >;

    type MutationCase = {
      name: string;
      run: (
        candidate: DbStateManager,
        resetObservation: () => void,
      ) => Promise<unknown>;
    };

    const mutationCases: MutationCase[] = [
      {
        name: "generate",
        run: async (candidate) => {
          queueStateRow(defaultState);
          return candidate.generateState({
            startNumber: 1,
            endNumber: 5,
            mode: "sequential",
          });
        },
      },
      {
        name: "append",
        run: async (candidate) => {
          queueStateRow(activeState());
          return candidate.appendTickets(15);
        },
      },
      {
        name: "extend range",
        run: async (candidate) => {
          queueStateRow(activeState());
          return candidate.extendRange(15);
        },
      },
      {
        name: "generate batch",
        run: async (candidate) => {
          queueStateRow(activeState({
            generatedOrder: [1, 2, 3],
            mode: "sequential",
          }));
          return candidate.generateBatch({
            startNumber: 1,
            endNumber: 10,
            batchSize: 2,
          });
        },
      },
      {
        name: "set mode",
        run: async (candidate) => {
          queueStateRow(activeState());
          return candidate.setMode("sequential");
        },
      },
      {
        name: "set current ticket",
        run: async (candidate) => {
          queueStateRow(activeState({ currentlyServing: null }));
          return candidate.updateCurrentlyServing(5);
        },
      },
      {
        name: "clear current ticket",
        run: async (candidate) => {
          queueStateRow(activeState());
          return candidate.updateCurrentlyServing(null);
        },
      },
      {
        name: "advance serving next",
        run: async (candidate) => {
          queueStateRow(activeState({ currentlyServing: 3 }));
          return candidate.advanceServing("next");
        },
      },
      {
        name: "advance serving previous",
        run: async (candidate) => {
          queueStateRow(activeState({ currentlyServing: 7 }));
          return candidate.advanceServing("prev");
        },
      },
      {
        name: "mark returned",
        run: async (candidate) => {
          queueStateRow(activeState());
          return candidate.markTicketReturned(5);
        },
      },
      {
        name: "mark unclaimed",
        run: async (candidate) => {
          queueStateRow(activeState({ currentlyServing: 7 }));
          return candidate.markTicketUnclaimed(3);
        },
      },
      {
        name: "revert ticket status",
        run: async (candidate) => {
          queueStateRow(activeState({
            ticketStatus: { 5: "returned" },
          }));
          return candidate.revertTicketStatus(5);
        },
      },
      {
        name: "reset",
        run: async (candidate) => {
          queueStateRow(activeState());
          mockQueryResults.push([]);
          return candidate.resetState();
        },
      },
      {
        name: "restore snapshot",
        run: async (candidate) => {
          mockQueryResults.push([{ payload: activeState({ currentlyServing: 7 }) }]);
          return candidate.restoreSnapshot("snapshot-to-restore");
        },
      },
      {
        name: "undo",
        run: async (candidate) => {
          mockQueryResults.push(
            [
              { id: "snap-current", created_at: "2026-09-01T12:01:00.000Z" },
              { id: "snap-previous", created_at: "2026-09-01T12:00:00.000Z" },
            ],
            [{ payload: activeState({ currentlyServing: 1 }) }],
          );
          return candidate.undo();
        },
      },
      {
        name: "redo",
        run: async (candidate, resetObservation) => {
          mockQueryResults.push(
            [
              { id: "snap-current", created_at: "2026-09-01T12:01:00.000Z" },
              { id: "snap-previous", created_at: "2026-09-01T12:00:00.000Z" },
            ],
            [{ payload: activeState({ currentlyServing: 1 }) }],
          );
          await candidate.undo();
          resetObservation();
          mockQueryResults.push([{ payload: activeState({ currentlyServing: 7 }) }]);
          return candidate.redo();
        },
      },
      {
        name: "set display URL",
        run: async (candidate) => {
          queueStateRow(activeState());
          return candidate.setDisplayUrl("https://beta.williamtemple.app");
        },
      },
      {
        name: "set operating hours",
        run: async (candidate) => {
          queueStateRow(activeState());
          return candidate.setOperatingHours(
            defaultState.operatingHours!,
            "America/Los_Angeles",
          );
        },
      },
      {
        name: "set display-language rotation",
        run: async (candidate) => {
          queueStateRow(activeState());
          return candidate.setDisplayLanguageRotation({
            enabled: true,
            languages: ["en", "es"],
            intervalSeconds: 60,
          });
        },
      },
      {
        name: "clear display-language rotation",
        run: async (candidate) => {
          queueStateRow(activeState({
            displayLanguageRotation: {
              enabled: true,
              languages: ["en"],
              intervalSeconds: 60,
            },
          }));
          return candidate.setDisplayLanguageRotation(null);
        },
      },
      {
        name: "set announcement",
        run: async (candidate) => {
          queueStateRow(activeState());
          return candidate.setAnnouncement({
            enabled: true,
            markdown: "Phase 3 validation",
            startsAt: null,
            endsAt: null,
            updatedAt: Date.now(),
          });
        },
      },
      {
        name: "clear announcement",
        run: async (candidate) => {
          queueStateRow(activeState({
            announcement: {
              enabled: true,
              markdown: "Phase 3 validation",
              startsAt: null,
              endsAt: null,
              updatedAt: Date.now(),
            },
          }));
          return candidate.setAnnouncement(null);
        },
      },
    ];

    it("publishes the committed public projection and records acceptance", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accepted: true }), { status: 202 }),
      );
      const { createDbStateManager } = await import("@/lib/state-manager-db");
      const realtimeManager = createDbStateManager(
        "postgresql://test:test@localhost:5432/test",
        { environment: enabledEnvironment, fetchImpl },
      );
      queueStateRow(defaultState);

      const result = await realtimeManager.generateState({
        startNumber: 1,
        endNumber: 5,
        mode: "sequential",
      });

      expect(result.generatedOrder).toEqual([1, 2, 3, 4, 5]);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, request] = fetchImpl.mock.calls[0] as [URL, RequestInit];
      expect(url.toString()).toBe(
        "https://lotto-realtime-beta.et2-geiger.workers.dev/v1/agencies/william-temple-house/publish",
      );
      expect(request.headers).toMatchObject({
        authorization: `Bearer ${"a".repeat(32)}`,
      });
      const envelope = JSON.parse(String(request.body));
      expect(envelope.revision).toBe(1);
      expect(envelope.state.generatedOrder).toEqual([1, 2, 3, 4, 5]);
      expect(envelope.state).not.toHaveProperty("queueSession");
      expect(mockSql).toHaveBeenCalledTimes(2);
      expect(mockTransactionSql.join("\n")).toContain(
        "insert into raffle_public_state_publications",
      );
      expect(mockTransactionSql.join("\n")).toContain(
        "status = 'superseded'",
      );
    });

    it.each(mutationCases)(
      "publishes every persisted mutation: $name",
      async ({ run }) => {
        const fetchImpl = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ accepted: true }), { status: 202 }),
        );
        const { createDbStateManager } = await import("@/lib/state-manager-db");
        const realtimeManager = createDbStateManager(
          "postgresql://test:test@localhost:5432/test",
          { environment: enabledEnvironment, fetchImpl },
        );
        const resetObservation = () => {
          fetchImpl.mockClear();
          mockTransactionFn.mockClear();
          mockDirectSql = [];
          mockTransactionSql = [];
        };

        await run(realtimeManager, resetObservation);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(mockTransactionFn).toHaveBeenCalledTimes(1);
        expect(mockTransactionSql.join("\n")).toContain(
          "insert into raffle_public_state_publications",
        );
        expect(mockTransactionSql.join("\n")).toContain(
          "revision = raffle_state.revision + 1",
        );
        expect(mockDirectSql.join("\n")).toContain("set status = 'accepted'");

        const [url, request] = fetchImpl.mock.calls[0] as [URL, RequestInit];
        expect(url.toString()).toBe(
          "https://lotto-realtime-beta.et2-geiger.workers.dev/v1/agencies/william-temple-house/publish",
        );
        expect(request).toMatchObject({ method: "POST", cache: "no-store" });
        const envelope = publicStateEnvelopeSchema.parse(
          JSON.parse(String(request.body)),
        );
        expect(envelope.revision).toBe(1);
        expect(envelope.state).not.toHaveProperty("queueSession");
        await expect(hashPublicState(envelope.state)).resolves.toBe(
          envelope.checksum,
        );
      },
    );

    it("increments the authoritative revision without creating an outbox row when disabled", async () => {
      queueStateRow(activeState());

      await manager.setDisplayUrl("https://beta.williamtemple.app");

      expect(mockTransactionSql.join("\n")).toContain(
        "revision = raffle_state.revision + 1",
      );
      expect(mockTransactionSql.join("\n")).not.toContain(
        "raffle_public_state_publications",
      );
    });

    it("returns committed state when the hub rejects publication", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }),
      );
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const { createDbStateManager } = await import("@/lib/state-manager-db");
      const realtimeManager = createDbStateManager(
        "postgresql://test:test@localhost:5432/test",
        { environment: enabledEnvironment, fetchImpl },
      );
      queueStateRow(activeState());

      await expect(
        realtimeManager.setDisplayUrl("https://beta.williamtemple.app"),
      ).resolves.toMatchObject({
        displayUrl: "https://beta.williamtemple.app",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Shadow publication delayed for revision 1"),
      );
    });

    it("returns committed state when recording the hub outcome fails", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const { createDbStateManager } = await import("@/lib/state-manager-db");
      const realtimeManager = createDbStateManager(
        "postgresql://test:test@localhost:5432/test",
        { environment: enabledEnvironment, fetchImpl },
      );
      queueStateRow(activeState());
      mockQueryResults.push(new Error("database unavailable"));

      await expect(
        realtimeManager.setDisplayUrl("https://beta.williamtemple.app"),
      ).resolves.toMatchObject({
        displayUrl: "https://beta.williamtemple.app",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        "[Realtime] Publication evidence update failed for revision 1.",
      );
    });

    it("repairs only the newest pending or failed row with its original identity", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      const { createDbStateManager } = await import("@/lib/state-manager-db");
      const realtimeManager = createDbStateManager(
        "postgresql://test:test@localhost:5432/test",
        { environment: enabledEnvironment, fetchImpl },
      );
      const publicState = toPublicRaffleState(activeState());
      const checksum = await hashPublicState(publicState);
      mockQueryResults.push([
        {
          publication_id: "965104d8-44a2-41b7-b7d0-d82d9c9d3a50",
          revision: "42",
          checksum,
          payload: publicState,
          committed_at: "2026-09-01T12:00:00.000Z",
        },
      ]);

      await expect(
        realtimeManager.retryLatestRealtimePublication(),
      ).resolves.toEqual({
        enabled: true,
        attempted: true,
        revision: 42,
        accepted: true,
      });

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const envelope = JSON.parse(
        String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body),
      );
      expect(envelope).toMatchObject({
        publicationId: "965104d8-44a2-41b7-b7d0-d82d9c9d3a50",
        revision: 42,
        checksum,
        committedAt: "2026-09-01T12:00:00.000Z",
      });
      expect(mockDirectSql[0]).toContain("order by revision desc");
      expect(mockDirectSql[0]).toContain("limit 1");
      expect(mockDirectSql[0]).toContain("where status in ('pending', 'failed')");
    });

    it("does not query or publish when repair is disabled", async () => {
      await expect(manager.retryLatestRealtimePublication()).resolves.toEqual({
        enabled: false,
        attempted: false,
      });
      expect(mockSql).not.toHaveBeenCalled();
    });

    it("returns bounded publication diagnostics without payload or secrets", async () => {
      const fetchImpl = vi.fn();
      const { createDbStateManager } = await import("@/lib/state-manager-db");
      const realtimeManager = createDbStateManager(
        "postgresql://test:test@localhost:5432/test",
        { environment: enabledEnvironment, fetchImpl },
      );
      mockQueryResults.push([
        {
          publication_id: "965104d8-44a2-41b7-b7d0-d82d9c9d3a50",
          revision: "44",
          status: "failed",
          attempt_count: "1",
          committed_at: "2026-09-01T12:00:00.000Z",
          last_attempt_at: "2026-09-01T12:00:01.000Z",
          accepted_at: null,
          last_error: "Realtime hub returned HTTP 503.",
          updated_at: "2026-09-01T12:00:01.000Z",
        },
      ]);

      const status = await realtimeManager.getRealtimePublicationStatus();

      expect(status).toEqual({
        enabled: true,
        latest: {
          publicationId: "965104d8-44a2-41b7-b7d0-d82d9c9d3a50",
          revision: 44,
          status: "failed",
          attemptCount: 1,
          committedAt: "2026-09-01T12:00:00.000Z",
          lastAttemptAt: "2026-09-01T12:00:01.000Z",
          acceptedAt: null,
          lastError: "Realtime hub returned HTTP 503.",
          updatedAt: "2026-09-01T12:00:01.000Z",
        },
      });
      expect(status).not.toHaveProperty("payload");
      expect(JSON.stringify(status)).not.toContain("a".repeat(32));
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("does not query for diagnostics when shadow publication is disabled", async () => {
      await expect(manager.getRealtimePublicationStatus()).resolves.toEqual({
        enabled: false,
      });
      expect(mockSql).not.toHaveBeenCalled();
    });

    it("refuses malformed or checksum-mismatched repair evidence before transmission", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const { createDbStateManager } = await import("@/lib/state-manager-db");
      const realtimeManager = createDbStateManager(
        "postgresql://test:test@localhost:5432/test",
        { environment: enabledEnvironment, fetchImpl },
      );
      mockQueryResults.push([
        {
          publication_id: "965104d8-44a2-41b7-b7d0-d82d9c9d3a50",
          revision: 43,
          checksum: `sha256:${"a".repeat(64)}`,
          payload: {},
          committed_at: "2026-09-01T12:00:00.000Z",
        },
      ]);

      await expect(
        realtimeManager.retryLatestRealtimePublication(),
      ).resolves.toMatchObject({
        enabled: true,
        attempted: true,
        revision: 43,
        accepted: false,
        error: "Stored public-state payload is invalid.",
      });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        "[Realtime] Repair rejected invalid publication evidence for revision 43.",
      );
    });
  });

  describe("updateCurrentlyServing", () => {
    it("sets currently serving to a valid ticket", async () => {
      queueStateRow(activeState({ currentlyServing: null }));
      const result = await manager.updateCurrentlyServing(5);
      expect(result.currentlyServing).toBe(5);
      expect(result.calledAt[5]).toBeTypeOf("number");
    });

    it("clears currently serving with null", async () => {
      queueStateRow(activeState());
      const result = await manager.updateCurrentlyServing(null);
      expect(result.currentlyServing).toBeNull();
    });

    it("throws for ticket outside range", async () => {
      queueStateRow(activeState());
      await expect(manager.updateCurrentlyServing(99)).rejects.toThrow(
        "within the active range",
      );
    });
  });
});
