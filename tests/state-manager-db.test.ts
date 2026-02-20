import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultState } from "@/lib/state-types";
import { UserInputError } from "@/lib/user-input-error";

// --- Mock the neon SQL client ---

let mockQueryResults: unknown[];
let mockTransactionFn: ReturnType<typeof vi.fn>;

// Tagged template function that simulates neon's sql``
const mockSql = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => {
  return mockQueryResults.shift() ?? [];
}) as unknown as ReturnType<typeof import("@neondatabase/serverless").neon>;

// Attach .transaction to the mock sql function
mockTransactionFn = vi.fn(async (callback: (tx: unknown) => unknown[]) => {
  // tx is a tagged template too — simulate it but don't execute real SQL
  const mockTx = vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) =>
    Promise.resolve([]),
  );
  const statements = callback(mockTx);
  await Promise.all(statements as Promise<unknown>[]);
  return [];
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
  mockQueryResults.push([{ payload: state }]);
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
      mockQueryResults.push([{ payload: partialPayload }]);
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
