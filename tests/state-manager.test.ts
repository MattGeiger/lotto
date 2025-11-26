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

  it("re-randomizes the existing range", async () => {
    const initial = await manager.generateState({
      startNumber: 20,
      endNumber: 23,
      mode: "random",
    });

    const rerolled = await manager.rerandomize();

    expectOrderContainsRange(rerolled.generatedOrder, 20, 23);
    expect(rerolled.generatedOrder).not.toEqual(initial.generatedOrder);
  });

  it("updates currently serving within range", async () => {
    await manager.generateState({ startNumber: 10, endNumber: 12, mode: "random" });
    const updated = await manager.updateCurrentlyServing(11);

    expect(updated.currentlyServing).toBe(11);
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
});
