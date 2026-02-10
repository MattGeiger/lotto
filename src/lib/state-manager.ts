import { randomInt } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  defaultState,
  formatTimestamp,
  type Mode,
  type OperatingHours,
  type RaffleState,
} from "./state-types";
import { createDbStateManager } from "./state-manager-db";

export { defaultState } from "./state-types";
export type { Mode, RaffleState, OperatingHours, DayOfWeek } from "./state-types";

const buildRange = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const shuffle = (values: number[]) => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

const withTimestamp = (state: RaffleState) => ({
  ...state,
  timestamp: Date.now(),
});

export const createStateManager = (baseDir = path.join(process.cwd(), "data")) => {
  const statePath = path.join(baseDir, "state.json");
  let lastRedoSnapshot: Snapshot | null = null;
  let lastPersistTs = 0;

  type Snapshot = {
    id: string;
    timestamp: number;
    path: string;
  };

  const persist = async (
    state: RaffleState,
    options?: { preserveTimestamp?: boolean; skipBackup?: boolean },
  ): Promise<RaffleState> => {
    await ensureDir(baseDir);
    const timestamped =
      options?.preserveTimestamp && state.timestamp !== null ? state : withTimestamp(state);
    let ts = timestamped.timestamp ?? Date.now();
    if (ts <= lastPersistTs) {
      ts = lastPersistTs + 1;
      timestamped.timestamp = ts;
    }
    lastPersistTs = ts;
    const uniqueSuffix = Math.random().toString(36).slice(2, 8);
    const tempPath = path.join(
      baseDir,
      `state-${ts}-${uniqueSuffix}.tmp`,
    );
    const payload = JSON.stringify(timestamped, null, 2);

    await fs.writeFile(tempPath, payload, "utf-8");
    if (!options?.skipBackup) {
      const backupName = `state-${formatTimestamp(ts)}-${uniqueSuffix}.json`;
      await fs.copyFile(tempPath, path.join(baseDir, backupName));
    }
    await fs.rename(tempPath, statePath);
    return timestamped;
  };

  const safeReadState = async (): Promise<RaffleState> => {
    try {
      const contents = await fs.readFile(statePath, "utf-8");
      const parsed = JSON.parse(contents) as Partial<RaffleState>;
      return {
        ...defaultState,
        ...parsed,
        timestamp: parsed.timestamp ?? Date.now(),
      };
    } catch {
      return persist(defaultState);
    }
  };

  const validateRange = (start: number, end: number) => {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new Error("Start and end must be integers.");
    }
    if (start <= 0 || end <= 0) {
      throw new Error("Start and end must be positive numbers.");
    }
    if (end < start) {
      throw new Error("End number must be greater than or equal to start number.");
    }
  };

  const ensureHasRange = (state: RaffleState) => {
    if (state.startNumber === 0 && state.endNumber === 0) {
      throw new Error("No active range is set yet.");
    }
  };

  const generateOrder = (startNumber: number, endNumber: number, mode: Mode) => {
    const range = buildRange(startNumber, endNumber);
    return mode === "random" ? shuffle(range) : range;
  };

  const loadState = async () => safeReadState();

  const generateState = async (input: {
    startNumber: number;
    endNumber: number;
    mode: Mode;
  }) => {
    const current = await safeReadState();

    if (current.orderLocked) {
      throw new Error(
        "Order is locked. Cannot regenerate—this would change all client positions. Use Reset to start a new lottery.",
      );
    }

    validateRange(input.startNumber, input.endNumber);
    const generatedOrder = generateOrder(input.startNumber, input.endNumber, input.mode);
    return persist({
      startNumber: input.startNumber,
      endNumber: input.endNumber,
      mode: input.mode,
      generatedOrder,
      currentlyServing: null,
      ticketStatus: {},
      calledAt: {},
      orderLocked: true,
      timestamp: null,
      displayUrl: current.displayUrl ?? null,
      operatingHours: current.operatingHours ?? defaultState.operatingHours,
      timezone: current.timezone ?? defaultState.timezone,
    });
  };

  const appendTickets = async (newEndNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (newEndNumber <= current.endNumber) {
      throw new Error("New end number must be greater than the current end number.");
    }

    const additions = buildRange(current.endNumber + 1, newEndNumber);
    const newBatch = current.mode === "random" ? shuffle(additions) : additions;
    const generatedOrder = [...current.generatedOrder, ...newBatch];

    return persist({
      ...current,
      endNumber: newEndNumber,
      generatedOrder,
    });
  };

  const extendRange = async (newEndNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);
    if (newEndNumber <= current.endNumber) {
      throw new Error("New end number must be greater than the current end number.");
    }
    return persist({
      ...current,
      endNumber: newEndNumber,
    });
  };

  const generateBatch = async (input: {
    startNumber: number;
    endNumber: number;
    batchSize: number;
  }) => {
    const current = await safeReadState();
    const { batchSize } = input;

    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error("Batch size must be a positive integer.");
    }

    // Determine effective range: use current if set, otherwise set from input
    const hasRange = current.startNumber !== 0 || current.endNumber !== 0;
    let effectiveStart = current.startNumber;
    let effectiveEnd = current.endNumber;

    if (!hasRange) {
      validateRange(input.startNumber, input.endNumber);
      effectiveStart = input.startNumber;
      effectiveEnd = input.endNumber;
    }

    // Compute undrawn pool: tickets in range NOT already in generatedOrder
    const drawn = new Set(current.generatedOrder);
    const pool = buildRange(effectiveStart, effectiveEnd).filter(
      (ticket) => !drawn.has(ticket),
    );

    if (pool.length === 0) {
      throw new Error("All tickets in the range have already been drawn.");
    }

    if (batchSize > pool.length) {
      throw new Error(
        `Batch size (${batchSize}) exceeds remaining undrawn tickets (${pool.length}).`,
      );
    }

    // Random: shuffle pool and take first N. Sequential: take lowest N.
    const selected =
      current.mode === "random"
        ? shuffle(pool).slice(0, batchSize)
        : pool.slice(0, batchSize);

    return persist({
      ...current,
      startNumber: effectiveStart,
      endNumber: effectiveEnd,
      generatedOrder: [...current.generatedOrder, ...selected],
      orderLocked: true,
    });
  };

  const setMode = async (mode: Mode) => {
    const current = await safeReadState();
    const hasRange = current.startNumber !== 0 || current.endNumber !== 0;

    if (!hasRange) {
      return persist({ ...current, mode });
    }

    const hasOrder = current.generatedOrder.length > 0;

    if (!hasOrder) {
      const generatedOrder = generateOrder(
        current.startNumber,
        current.endNumber,
        mode,
      );
      return persist({
        ...current,
        mode,
        generatedOrder,
      });
    }

    return persist({
      ...current,
      mode,
    });
  };

  const updateCurrentlyServing = async (value: number | null) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (
      value !== null &&
      (value < current.startNumber || value > current.endNumber)
    ) {
      throw new Error("Currently serving must be within the active range.");
    }

    const nextCalledAt = { ...(current.calledAt ?? {}) } as RaffleState["calledAt"];
    if (value !== null) {
      nextCalledAt[value] = Date.now();
    }

    return persist({
      ...current,
      currentlyServing: value,
      calledAt: nextCalledAt,
    });
  };

  const advanceServing = async (direction: "next" | "prev") => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (current.generatedOrder.length === 0) {
      throw new Error("Generate tickets first.");
    }

    const order = current.generatedOrder;
    const status = current.ticketStatus ?? {};
    const currentIndex =
      current.currentlyServing !== null ? order.indexOf(current.currentlyServing) : -1;
    const step = direction === "next" ? 1 : -1;
    const startIndex = currentIndex === -1 ? -1 : currentIndex;

    const findNextIndex = (start: number, stepValue: number) => {
      for (let i = start + stepValue; i >= 0 && i < order.length; i += stepValue) {
        const ticketNumber = order[i];
        if (status[ticketNumber] !== "returned") {
          return i;
        }
      }
      return -1;
    };

    const nextIndex =
      direction === "prev" && currentIndex === -1
        ? findNextIndex(-1, 1)
        : findNextIndex(startIndex, step);

    if (nextIndex === -1) {
      return current;
    }

    const nextTicket = order[nextIndex];
    if (nextTicket === current.currentlyServing) {
      return current;
    }

    const nextCalledAt = { ...(current.calledAt ?? {}) } as RaffleState["calledAt"];
    nextCalledAt[nextTicket] = Date.now();

    return persist({
      ...current,
      currentlyServing: nextTicket,
      calledAt: nextCalledAt,
    });
  };

  const markTicketReturned = async (ticketNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
      throw new Error("Ticket number must be a positive integer.");
    }
    if (ticketNumber < current.startNumber || ticketNumber > current.endNumber) {
      throw new Error("Ticket number must be within the active range.");
    }
    if (current.generatedOrder.length === 0) {
      throw new Error("Generate tickets first.");
    }

    const nextStatus = {
      ...(current.ticketStatus ?? {}),
      [ticketNumber]: "returned",
    } as RaffleState["ticketStatus"];
    let nextServing = current.currentlyServing;
    const nextCalledAt = { ...(current.calledAt ?? {}) } as RaffleState["calledAt"];
    if (ticketNumber === current.currentlyServing) {
      const currentIndex = current.generatedOrder.indexOf(ticketNumber);
      if (currentIndex !== -1) {
        nextServing = null;
        for (let i = currentIndex + 1; i < current.generatedOrder.length; i += 1) {
          const nextTicket = current.generatedOrder[i];
          if (nextStatus[nextTicket] !== "returned") {
            nextServing = nextTicket;
            nextCalledAt[nextTicket] = Date.now();
            break;
          }
        }
      }
    }

    return persist({
      ...current,
      ticketStatus: nextStatus,
      currentlyServing: nextServing,
      calledAt: nextCalledAt,
    });
  };

  const markTicketUnclaimed = async (ticketNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
      throw new Error("Ticket number must be a positive integer.");
    }
    if (ticketNumber < current.startNumber || ticketNumber > current.endNumber) {
      throw new Error("Ticket number must be within the active range.");
    }
    if (current.generatedOrder.length === 0) {
      throw new Error("Generate tickets first.");
    }

    const currentIndex =
      current.currentlyServing !== null
        ? current.generatedOrder.indexOf(current.currentlyServing)
        : -1;
    if (currentIndex === -1) {
      throw new Error("No draw position has been called yet.");
    }

    const ticketIndex = current.generatedOrder.indexOf(ticketNumber);
    if (ticketIndex === -1) {
      throw new Error("Ticket number is not in the current order.");
    }
    if (ticketIndex > currentIndex) {
      throw new Error("Ticket must be called before it can be marked unclaimed.");
    }

    const nextStatus = {
      ...(current.ticketStatus ?? {}),
      [ticketNumber]: "unclaimed",
    } as RaffleState["ticketStatus"];

    return persist({
      ...current,
      ticketStatus: nextStatus,
    });
  };

  const resetState = async () => {
    const current = await safeReadState();
    return persist({
      ...defaultState,
      ticketStatus: {},
      calledAt: {},
      operatingHours: current.operatingHours ?? defaultState.operatingHours,
      timezone: current.timezone ?? defaultState.timezone,
    });
  };

  const parseSnapshot = async (file: string): Promise<Snapshot | null> => {
    const fullPath = path.join(baseDir, file);
    const stats = await fs.stat(fullPath);
    try {
      const contents = await fs.readFile(fullPath, "utf-8");
      const parsed = JSON.parse(contents) as Partial<RaffleState>;
      const ts = typeof parsed.timestamp === "number" ? parsed.timestamp : stats.mtimeMs;
      return { id: file, timestamp: ts, path: fullPath };
    } catch {
      return { id: file, timestamp: stats.mtimeMs, path: fullPath };
    }
  };

  const listSnapshots = async () => {
    await ensureDir(baseDir);
    const files = await fs.readdir(baseDir);
    const snapshots = (
      await Promise.all(
        files
          .filter(
            (file) => file !== "state.json" && file.startsWith("state-") && file.endsWith(".json"),
          )
          .map((file) => parseSnapshot(file)),
      )
    ).filter((item): item is Snapshot => Boolean(item));

    return snapshots.sort((a, b) => {
      if (b.timestamp === a.timestamp) {
        return b.id.localeCompare(a.id);
      }
      return b.timestamp - a.timestamp;
    });
  };

  const restoreSnapshot = async (id: string) => {
    const snapshots = await listSnapshots();
    const snapshot = snapshots.find((snap) => snap.id === id);
    if (!snapshot) {
      throw new Error("Snapshot not found.");
    }
    const contents = await fs.readFile(snapshot.path, "utf-8");
    const parsed = JSON.parse(contents) as RaffleState;
    return persist(parsed, { preserveTimestamp: true });
  };

  const undo = async () => {
    const snapshots = await listSnapshots();
    if (snapshots.length < 2) {
      throw new Error("No history available.");
    }
    lastRedoSnapshot = snapshots[0];
    const previous = snapshots[1];
    if (!previous) {
      throw new Error("No earlier snapshot to undo to.");
    }
    return restoreSnapshot(previous.id);
  };

  const redo = async () => {
    const target = lastRedoSnapshot;
    lastRedoSnapshot = null;
    if (!target) {
      throw new Error("No later snapshot to redo to.");
    }
    return restoreSnapshot(target.id);
  };

  const setDisplayUrl = async (url: string | null) => {
    const current = await safeReadState();
    return persist({ ...current, displayUrl: url });
  };

  const setOperatingHours = async (hours: OperatingHours, timezone: string) => {
    const current = await safeReadState();
    return persist({ ...current, operatingHours: hours, timezone });
  };

  const getDisplayUrl = async () => {
    const current = await safeReadState();
    return current.displayUrl || null;
  };

  return {
    loadState,
    generateState,
    generateBatch,
    appendTickets,
    extendRange,
    setMode,
    updateCurrentlyServing,
    advanceServing,
    markTicketReturned,
    markTicketUnclaimed,
    resetState,
    listSnapshots,
    restoreSnapshot,
    undo,
    redo,
    setDisplayUrl,
    getDisplayUrl,
    setOperatingHours,
  };
};

const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for production deployment. File system storage is not supported in production.",
  );
}

if (!databaseUrl && !isProduction) {
  console.warn("[State] DATABASE_URL is not set; using file-based storage for development.");
}

const storageMode = process.env.STATE_STORAGE?.toLowerCase();
const useDatabase = storageMode === "db" || (!storageMode && Boolean(databaseUrl));

export const stateManager = useDatabase ? createDbStateManager(databaseUrl) : createStateManager();
