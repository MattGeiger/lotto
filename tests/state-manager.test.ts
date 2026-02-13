import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createStateManager,
  defaultState,
  type Mode,
  type RaffleState,
} from "@/lib/state-manager";

const expectTimestamped = (state: RaffleState) => {
  expect(state.timestamp).toBeTypeOf("number");
};

const expectOrderContainsRange = (
  order: number[],
  start: number,
  end: number,
) => {
  const needed = Array.from({ length: end - start + 1 }).map(
    (_, i) => start + i,
  );
  expect(new Set(order)).toEqual(new Set(needed));
};

const expectRelativeOrderPreserved = (
  original: number[],
  updated: number[],
) => {
  const positions = original.map((value) => updated.indexOf(value));
  const sorted = [...positions].sort((a, b) => a - b);
  expect(positions).toEqual(sorted);
};

describe("state manager", () => {
  let tempDir: string;
  let manager: ReturnType<typeof createStateManager>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raffle-state-"));
    manager = createStateManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates default state when no file exists", async () => {
    const state = await manager.loadState();

    expect(state).toMatchObject({ ...defaultState, timestamp: state.timestamp });
    expectTimestamped(state);

    const saved = JSON.parse(
      fs.readFileSync(path.join(tempDir, "state.json"), "utf-8"),
    );
    expect(saved.startNumber).toBe(0);
  });

  it("generates and persists a randomized order for a range", async () => {
    const state = await manager.generateState({
      startNumber: 10,
      endNumber: 15,
      mode: "random",
    });

    expect(state.generatedOrder).toHaveLength(6);
    expectOrderContainsRange(state.generatedOrder, 10, 15);
    expectTimestamped(state);
    expect(state.mode).toBe<Mode>("random");
  });

  it("supports sequential mode generation", async () => {
    const state = await manager.generateState({
      startNumber: 3,
      endNumber: 6,
      mode: "sequential",
    });

    expect(state.generatedOrder).toEqual([3, 4, 5, 6]);
    expectTimestamped(state);
  });

  it("rejects initial generation when end is not greater than start", async () => {
    await expect(
      manager.generateState({ startNumber: 10, endNumber: 10, mode: "random" }),
    ).rejects.toThrow(/greater than start number/i);
  });

  it("rejects range values longer than 6 digits", async () => {
    await expect(
      manager.generateState({ startNumber: 1, endNumber: 1_000_000, mode: "random" }),
    ).rejects.toThrow(/6 digits or fewer/i);
  });

  it("prevents regeneration when order is locked", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 3, mode: "random" });

    await expect(
      manager.generateState({ startNumber: 1, endNumber: 3, mode: "random" }),
    ).rejects.toThrow(/order is locked/i);

    const state = await manager.loadState();
    expect(state.orderLocked).toBe(true);
  });

  it("appends tickets in sequential order when in sequential mode", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 3, mode: "sequential" });
    const updated = await manager.appendTickets(5);

    expect(updated.generatedOrder).toEqual([1, 2, 3, 4, 5]);
    expect(updated.endNumber).toBe(5);
  });

  it("appends tickets randomly without breaking existing order in random mode", async () => {
    const base = await manager.generateState({
      startNumber: 1,
      endNumber: 4,
      mode: "random",
    });

    const updated = await manager.appendTickets(6);

    expect(updated.generatedOrder).toHaveLength(6);
    expectOrderContainsRange(updated.generatedOrder, 1, 6);
    expectRelativeOrderPreserved(base.generatedOrder, updated.generatedOrder);
  });

  it("random append shuffles new batch only, preserves exact existing positions", async () => {
    const base = await manager.generateState({
      startNumber: 1,
      endNumber: 3,
      mode: "random",
    });
    const originalOrder = [...base.generatedOrder];

    const updated = await manager.appendTickets(6);

    expect(updated.generatedOrder.slice(0, 3)).toEqual(originalOrder);

    const newTickets = updated.generatedOrder.slice(3);
    expect(new Set(newTickets)).toEqual(new Set([4, 5, 6]));
  });

  it("sequential append maintains strict order for new tickets", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 2, mode: "sequential" });
    const updated = await manager.appendTickets(5);

    expect(updated.generatedOrder).toEqual([1, 2, 3, 4, 5]);
  });

  it("switches modes without reshaping the existing order", async () => {
    const initial = await manager.generateState({ startNumber: 5, endNumber: 7, mode: "random" });
    const sequential = await manager.setMode("sequential");

    expect(sequential.mode).toBe<Mode>("sequential");
    expect(sequential.generatedOrder).toEqual(initial.generatedOrder);
  });

  it("applies new mode only to appended tickets", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 3, mode: "random" });
    const before = await manager.setMode("sequential");
    const appended = await manager.appendTickets(5);

    expect(before.mode).toBe<Mode>("sequential");
    expect(appended.generatedOrder.slice(0, 3)).toEqual(before.generatedOrder);
    expect(appended.generatedOrder.slice(-2)).toEqual([4, 5]);
  });

  it("updates currently serving within range", async () => {
    await manager.generateState({ startNumber: 10, endNumber: 12, mode: "random" });
    const updated = await manager.updateCurrentlyServing(11);

    expect(updated.currentlyServing).toBe(11);
    expect(updated.calledAt[11]).toBeTypeOf("number");
  });

  it("advances to the next non-returned ticket", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 4, mode: "sequential" });
    await manager.updateCurrentlyServing(1);
    await manager.markTicketReturned(2);

    const updated = await manager.advanceServing("next");

    expect(updated.currentlyServing).toBe(3);
    expect(updated.calledAt[3]).toBeTypeOf("number");
  });

  it("advances to the previous non-returned ticket", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 4, mode: "sequential" });
    await manager.updateCurrentlyServing(4);
    await manager.markTicketReturned(3);

    const updated = await manager.advanceServing("prev");

    expect(updated.currentlyServing).toBe(2);
  });

  it("marks tickets as returned", async () => {
    await manager.generateState({ startNumber: 10, endNumber: 12, mode: "random" });
    const updated = await manager.markTicketReturned(11);

    expect(updated.ticketStatus[11]).toBe("returned");
  });

  it("keeps multiple returned tickets", async () => {
    await manager.generateState({ startNumber: 10, endNumber: 12, mode: "random" });
    await manager.markTicketReturned(11);
    const updated = await manager.markTicketReturned(12);

    expect(updated.ticketStatus[11]).toBe("returned");
    expect(updated.ticketStatus[12]).toBe("returned");
  });

  it("auto-advances when the current ticket is marked returned", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 3, mode: "sequential" });
    await manager.updateCurrentlyServing(2);

    const updated = await manager.markTicketReturned(2);

    expect(updated.currentlyServing).toBe(3);
    expect(updated.ticketStatus[2]).toBe("returned");
  });

  it("clears now serving when no later tickets remain after a return", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 2, mode: "sequential" });
    await manager.updateCurrentlyServing(2);

    const updated = await manager.markTicketReturned(2);

    expect(updated.currentlyServing).toBeNull();
  });

  it("marks tickets as unclaimed after they are called", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 3, mode: "sequential" });
    await manager.updateCurrentlyServing(2);

    const updated = await manager.markTicketUnclaimed(1);

    expect(updated.ticketStatus[1]).toBe("unclaimed");
  });

  it("rejects unclaimed tickets before any draw position is called", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 3, mode: "sequential" });

    await expect(manager.markTicketUnclaimed(1)).rejects.toThrow(/draw position/i);
  });

  it("rejects unclaimed tickets that have not been called yet", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 3, mode: "sequential" });
    await manager.updateCurrentlyServing(1);

    await expect(manager.markTicketUnclaimed(2)).rejects.toThrow(/must be called/i);
  });

  it("rejects returned ticket updates outside range", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 2, mode: "random" });

    await expect(manager.markTicketReturned(10)).rejects.toThrow(
      /within the active range/i,
    );
  });

  it("clears returned ticket flags on reset", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 2, mode: "random" });
    await manager.markTicketReturned(1);
    await manager.updateCurrentlyServing(1);

    const reset = await manager.resetState();

    expect(reset.ticketStatus).toEqual({});
    expect(reset.calledAt).toEqual({});
  });

  it("rejects invalid currently serving updates", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 2, mode: "random" });

    await expect(manager.updateCurrentlyServing(10)).rejects.toThrow(
      /must be within the active range/i,
    );
  });

  it("resets state and keeps backups", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 3, mode: "random" });
    const reset = await manager.resetState();

    expect(reset).toMatchObject({ ...defaultState, timestamp: reset.timestamp });
    expectTimestamped(reset);

    const backupFiles = fs
      .readdirSync(tempDir)
      .filter((file) => file.startsWith("state-") && file.endsWith(".json"));
    expect(backupFiles.length).toBeGreaterThanOrEqual(2);
  });

  it("lists snapshots", async () => {
    await manager.generateState({ startNumber: 1, endNumber: 3, mode: "random" });
    const snapshots = await manager.listSnapshots();

    expect(snapshots.length).toBeGreaterThan(0);
  });

  it("undoes and redoes using snapshots", async () => {
    const generated = await manager.generateState({ startNumber: 5, endNumber: 7, mode: "random" });
    await manager.updateCurrentlyServing(6);

    const undone = await manager.undo();
    expect(undone.currentlyServing).toBeNull();
    expect(undone.generatedOrder).toEqual(generated.generatedOrder);

    const redone = await manager.redo();
    expect(redone.currentlyServing).toBe(6);
  });

  describe("generateBatch", () => {
    it("draws a batch from a fresh range as the first action", async () => {
      const result = await manager.generateBatch({
        startNumber: 1,
        endNumber: 50,
        batchSize: 10,
      });

      expect(result.generatedOrder).toHaveLength(10);
      expect(result.orderLocked).toBe(true);
      expect(result.startNumber).toBe(1);
      expect(result.endNumber).toBe(50);
      for (const ticket of result.generatedOrder) {
        expect(ticket).toBeGreaterThanOrEqual(1);
        expect(ticket).toBeLessThanOrEqual(50);
      }
      expect(new Set(result.generatedOrder).size).toBe(10);
    });

    it("rejects first batch when end is not greater than start", async () => {
      await expect(
        manager.generateBatch({
          startNumber: 10,
          endNumber: 10,
          batchSize: 1,
        }),
      ).rejects.toThrow(/greater than start number/i);
    });

    it("appends a second batch without changing existing positions", async () => {
      const first = await manager.generateBatch({
        startNumber: 1,
        endNumber: 20,
        batchSize: 5,
      });
      const firstOrder = [...first.generatedOrder];

      const second = await manager.generateBatch({
        startNumber: 1,
        endNumber: 20,
        batchSize: 5,
      });

      expect(second.generatedOrder).toHaveLength(10);
      expect(second.generatedOrder.slice(0, 5)).toEqual(firstOrder);
      expect(new Set(second.generatedOrder).size).toBe(10);
    });

    it("rejects start mismatch after the first draw with a specific lock message", async () => {
      await manager.generateBatch({
        startNumber: 1,
        endNumber: 40,
        batchSize: 5,
      });

      await expect(
        manager.generateBatch({
          startNumber: 2,
          endNumber: 40,
          batchSize: 5,
        }),
      ).rejects.toThrow(
        "Start number is locked at 1 after the first draw. Reset to start a new range.",
      );
    });

    it("rejects end shrink after the first draw with a specific bound message", async () => {
      await manager.generateBatch({
        startNumber: 1,
        endNumber: 40,
        batchSize: 5,
      });

      await expect(
        manager.generateBatch({
          startNumber: 1,
          endNumber: 39,
          batchSize: 1,
        }),
      ).rejects.toThrow(
        "The end number is currently 40. Please choose a number greater than 40.",
      );
    });

    it("draws sequential batches in sequential mode", async () => {
      await manager.setMode("sequential");

      const first = await manager.generateBatch({
        startNumber: 1,
        endNumber: 20,
        batchSize: 5,
      });
      expect(first.generatedOrder).toEqual([1, 2, 3, 4, 5]);

      const second = await manager.generateBatch({
        startNumber: 1,
        endNumber: 20,
        batchSize: 5,
      });
      expect(second.generatedOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("rejects batch size exceeding remaining pool", async () => {
      await manager.generateBatch({
        startNumber: 1,
        endNumber: 10,
        batchSize: 8,
      });

      await expect(
        manager.generateBatch({
          startNumber: 1,
          endNumber: 10,
          batchSize: 5,
        }),
      ).rejects.toThrow(/exceeds remaining/i);
    });

    it("rejects when all tickets are already drawn", async () => {
      await manager.generateBatch({
        startNumber: 1,
        endNumber: 3,
        batchSize: 3,
      });

      await expect(
        manager.generateBatch({
          startNumber: 1,
          endNumber: 3,
          batchSize: 1,
        }),
      ).rejects.toThrow(/already been drawn/i);
    });

    it("rejects zero or negative batch size", async () => {
      await expect(
        manager.generateBatch({
          startNumber: 1,
          endNumber: 10,
          batchSize: 0,
        }),
      ).rejects.toThrow(/positive integer/i);
    });

    it("persists an expanded end number after a successful batch draw", async () => {
      await manager.generateBatch({
        startNumber: 1,
        endNumber: 40,
        batchSize: 10,
      });

      const expanded = await manager.generateBatch({
        startNumber: 1,
        endNumber: 50,
        batchSize: 5,
      });
      expect(expanded.endNumber).toBe(50);

      const reloaded = await manager.loadState();
      expect(reloaded.endNumber).toBe(50);

      const followUp = await manager.generateBatch({
        startNumber: 1,
        endNumber: 50,
        batchSize: 1,
      });
      expect(followUp.endNumber).toBe(50);
    });

    it("does not persist expanded end number when batch draw fails", async () => {
      await manager.generateBatch({
        startNumber: 1,
        endNumber: 40,
        batchSize: 40,
      });
      const before = await manager.loadState();
      expect(before.endNumber).toBe(40);

      await expect(
        manager.generateBatch({
          startNumber: 1,
          endNumber: 50,
          batchSize: 11,
        }),
      ).rejects.toThrow("Batch size (11) exceeds remaining undrawn tickets (10).");

      const after = await manager.loadState();
      expect(after.endNumber).toBe(40);
    });
  });

  it("rejects append while tickets remain undrawn in the current range", async () => {
    await manager.generateBatch({
      startNumber: 1,
      endNumber: 10,
      batchSize: 4,
    });

    await expect(manager.appendTickets(12)).rejects.toThrow(
      /All tickets in the current range must be drawn before appending/i,
    );
  });

  describe("extendRange", () => {
    it("extends range without modifying generatedOrder", async () => {
      await manager.generateState({ startNumber: 1, endNumber: 50, mode: "random" });
      const before = await manager.loadState();
      const originalOrder = [...before.generatedOrder];

      const result = await manager.extendRange(65);

      expect(result.endNumber).toBe(65);
      expect(result.startNumber).toBe(1);
      expect(result.generatedOrder).toEqual(originalOrder);
    });

    it("rejects newEnd less than or equal to currentEnd", async () => {
      await manager.generateState({ startNumber: 1, endNumber: 50, mode: "random" });

      await expect(manager.extendRange(50)).rejects.toThrow(/greater than/i);
      await expect(manager.extendRange(30)).rejects.toThrow(/greater than/i);
    });

    it("rejects when no range is set", async () => {
      await expect(manager.extendRange(65)).rejects.toThrow();
    });
  });
});
