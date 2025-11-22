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

  it("switches modes and reshapes the generated order", async () => {
    await manager.generateState({ startNumber: 5, endNumber: 7, mode: "random" });
    const sequential = await manager.setMode("sequential");

    expect(sequential.mode).toBe<Mode>("sequential");
    expect(sequential.generatedOrder).toEqual([5, 6, 7]);
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
});
