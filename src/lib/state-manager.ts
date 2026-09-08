// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { randomInt } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  defaultState,
  formatTimestamp,
  type Announcement,
  type DisplayLanguageRotation,
  type Mode,
  type OperatingHours,
  type RaffleState,
} from "./state-types";
import { createDbStateManager } from "./state-manager-db";
import { UserInputError } from "./user-input-error";
import {
  addIssuedTickets,
  createStoredQueueSessionSummary,
  recordFirstCall,
  recordModeTransition,
  type StoredQueueSessionSummary,
} from "./queue-session";

export { defaultState } from "./state-types";
export type {
  Mode,
  RaffleState,
  OperatingHours,
  DayOfWeek,
  DisplayLanguageRotation,
} from "./state-types";

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

const MAX_TICKET_NUMBER = 999_999;

export const createStateManager = (baseDir = path.join(process.cwd(), "data")) => {
  const statePath = path.join(baseDir, "state.json");
  const queueSummariesDir = path.join(baseDir, "queue-summaries");
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

  const validateRange = (
    start: number,
    end: number,
    options?: { requireStrictEnd?: boolean },
  ) => {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new UserInputError("Start and end must be integers.");
    }
    if (start <= 0 || end <= 0) {
      throw new UserInputError("Start and end must be positive numbers.");
    }
    if (start > MAX_TICKET_NUMBER || end > MAX_TICKET_NUMBER) {
      throw new UserInputError("Start and end must be 6 digits or fewer.");
    }
    if (options?.requireStrictEnd ? end <= start : end < start) {
      throw new UserInputError(
        options?.requireStrictEnd
          ? "End number must be greater than start number."
          : "End number must be greater than or equal to start number.",
      );
    }
  };

  const validateNewEndNumber = (value: number) => {
    if (!Number.isInteger(value) || value <= 0) {
      throw new UserInputError("End number must be a positive integer.");
    }
    if (value > MAX_TICKET_NUMBER) {
      throw new UserInputError("End number must be 6 digits or fewer.");
    }
  };

  const countUndrawnTickets = (state: RaffleState) => {
    const drawn = new Set(state.generatedOrder);
    let undrawn = 0;
    for (let ticket = state.startNumber; ticket <= state.endNumber; ticket += 1) {
      if (!drawn.has(ticket)) {
        undrawn += 1;
      }
    }
    return undrawn;
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
  const loadStateWithRevision = async () => ({
    state: await safeReadState(),
    revision: null,
  });

  const generateState = async (input: {
    startNumber: number;
    endNumber: number;
    mode: Mode;
  }) => {
    const current = await safeReadState();

    if (current.orderLocked) {
      throw new UserInputError(
        "Order is locked. Cannot regenerate—this would change all client positions. Use Reset to start a new lottery.",
      );
    }

    validateRange(input.startNumber, input.endNumber, { requireStrictEnd: true });
    const generatedOrder = generateOrder(input.startNumber, input.endNumber, input.mode);
    const issuedAt = Date.now();
    return persist(addIssuedTickets({
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
      displayLanguageRotation: current.displayLanguageRotation ?? null,
      announcement: current.announcement ?? null,
      queueSession: null,
    }, generatedOrder, "full", issuedAt));
  };

  const appendTickets = async (newEndNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);
    validateNewEndNumber(newEndNumber);

    if (newEndNumber <= current.endNumber) {
      throw new UserInputError(
        `The end number is currently ${current.endNumber}. Please choose a number greater than ${current.endNumber}.`,
      );
    }

    const undrawnCount = countUndrawnTickets(current);
    if (undrawnCount > 0) {
      throw new UserInputError(
        `All tickets in the current range must be drawn before appending. ${undrawnCount} ticket${
          undrawnCount === 1 ? " remains" : "s remain"
        } undrawn. Use Generate batch to finish the current range first.`,
      );
    }

    const additions = buildRange(current.endNumber + 1, newEndNumber);
    const newBatch = current.mode === "random" ? shuffle(additions) : additions;
    const generatedOrder = [...current.generatedOrder, ...newBatch];

    const issuedAt = Date.now();
    return persist(addIssuedTickets({
      ...current,
      endNumber: newEndNumber,
      generatedOrder,
    }, newBatch, "append", issuedAt));
  };

  const extendRange = async (newEndNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);
    validateNewEndNumber(newEndNumber);
    if (newEndNumber <= current.endNumber) {
      throw new UserInputError(
        `The end number is currently ${current.endNumber}. Please choose a number greater than ${current.endNumber}.`,
      );
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
      throw new UserInputError("Batch size must be a positive integer.");
    }

    // Determine effective range: use current if set, otherwise set from input
    const hasRange = current.startNumber !== 0 || current.endNumber !== 0;
    let effectiveStart = current.startNumber;
    let effectiveEnd = current.endNumber;

    if (!hasRange) {
      validateRange(input.startNumber, input.endNumber, { requireStrictEnd: true });
      effectiveStart = input.startNumber;
      effectiveEnd = input.endNumber;
    } else {
      if (input.startNumber !== current.startNumber) {
        throw new UserInputError(
          `Start number is locked at ${current.startNumber} after the first draw. Reset to start a new range.`,
        );
      }
      validateNewEndNumber(input.endNumber);
      if (input.endNumber < current.endNumber) {
        throw new UserInputError(
          `The end number is currently ${current.endNumber}. Please choose a number greater than ${current.endNumber}.`,
        );
      }
      effectiveStart = current.startNumber;
      effectiveEnd = input.endNumber;
    }

    // Compute undrawn pool: tickets in range NOT already in generatedOrder
    const drawn = new Set(current.generatedOrder);
    const pool = buildRange(effectiveStart, effectiveEnd).filter(
      (ticket) => !drawn.has(ticket),
    );

    if (pool.length === 0) {
      throw new UserInputError("All tickets in the range have already been drawn.");
    }

    if (batchSize > pool.length) {
      throw new UserInputError(
        `Batch size (${batchSize}) exceeds remaining undrawn tickets (${pool.length}).`,
      );
    }

    // Random: shuffle pool and take first N. Sequential: take lowest N.
    const selected =
      current.mode === "random"
        ? shuffle(pool).slice(0, batchSize)
        : pool.slice(0, batchSize);

    const issuedAt = Date.now();
    return persist(addIssuedTickets({
      ...current,
      startNumber: effectiveStart,
      endNumber: effectiveEnd,
      generatedOrder: [...current.generatedOrder, ...selected],
      orderLocked: true,
    }, selected, "batch", issuedAt));
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
      const issuedAt = Date.now();
      return persist(addIssuedTickets({
        ...current,
        mode,
        generatedOrder,
      }, generatedOrder, "full", issuedAt));
    }

    return persist(recordModeTransition({
      ...current,
      mode,
    }, current.mode, mode));
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
    const calledAt = Date.now();
    if (value !== null) {
      nextCalledAt[value] = calledAt;
    }

    const nextState = {
      ...current,
      currentlyServing: value,
      calledAt: nextCalledAt,
    };
    return persist(value === null ? nextState : recordFirstCall(nextState, value, calledAt));
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
    const calledAt = Date.now();
    nextCalledAt[nextTicket] = calledAt;

    return persist(recordFirstCall({
      ...current,
      currentlyServing: nextTicket,
      calledAt: nextCalledAt,
    }, nextTicket, calledAt));
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
    let autoCalledAt: number | null = null;
    if (ticketNumber === current.currentlyServing) {
      const currentIndex = current.generatedOrder.indexOf(ticketNumber);
      if (currentIndex !== -1) {
        nextServing = null;
        for (let i = currentIndex + 1; i < current.generatedOrder.length; i += 1) {
          const nextTicket = current.generatedOrder[i];
          if (nextStatus[nextTicket] !== "returned") {
            nextServing = nextTicket;
            autoCalledAt = Date.now();
            nextCalledAt[nextTicket] = autoCalledAt;
            break;
          }
        }
      }
    }

    const nextState = {
      ...current,
      ticketStatus: nextStatus,
      currentlyServing: nextServing,
      calledAt: nextCalledAt,
    };
    return persist(
      nextServing !== null && autoCalledAt !== null
        ? recordFirstCall(nextState, nextServing, autoCalledAt)
        : nextState,
    );
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

  const revertTicketStatus = async (ticketNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
      throw new Error("Ticket number must be a positive integer.");
    }
    if (ticketNumber < current.startNumber || ticketNumber > current.endNumber) {
      throw new Error("Ticket number must be within the active range.");
    }

    const currentStatus = current.ticketStatus?.[ticketNumber];
    if (currentStatus !== "returned" && currentStatus !== "unclaimed") {
      // Nothing to revert — leave state unchanged (idempotent, race-safe).
      return current;
    }

    const nextStatus = { ...(current.ticketStatus ?? {}) } as RaffleState["ticketStatus"];
    delete nextStatus[ticketNumber];

    // Clearing the flag only restores the ticket's "not called" state; it does
    // not rewind currentlyServing/calledAt (which advanced when it was marked).
    return persist({
      ...current,
      ticketStatus: nextStatus,
    });
  };

  const resetState = async () => {
    const current = await safeReadState();
    const closedAt = Date.now();
    const prior = current.queueSession
      ? (await listQueueSummaries()).filter(
          (summary) => summary.sessionId === current.queueSession?.sessionId,
        )
      : [];
    const closeout = createStoredQueueSessionSummary(current, closedAt, prior);
    if (closeout) {
      await ensureDir(queueSummariesDir);
      await fs.writeFile(
        path.join(queueSummariesDir, `${closeout.summaryId}.json`),
        JSON.stringify(closeout, null, 2),
        { encoding: "utf-8", flag: "wx" },
      );
    }
    return persist({
      ...defaultState,
      ticketStatus: {},
      calledAt: {},
      operatingHours: current.operatingHours ?? defaultState.operatingHours,
      timezone: current.timezone ?? defaultState.timezone,
      displayLanguageRotation: current.displayLanguageRotation ?? null,
      announcement: current.announcement ?? null,
      queueSession: null,
    });
  };

  const listQueueSummaries = async (): Promise<StoredQueueSessionSummary[]> => {
    await ensureDir(queueSummariesDir);
    const files = (await fs.readdir(queueSummariesDir)).filter((file) => file.endsWith(".json"));
    const summaries = await Promise.all(files.map(async (file) => {
      const contents = await fs.readFile(path.join(queueSummariesDir, file), "utf-8");
      return JSON.parse(contents) as StoredQueueSessionSummary;
    }));
    return summaries.sort((left, right) =>
      left.recordedAt === right.recordedAt
        ? left.summaryId.localeCompare(right.summaryId)
        : left.recordedAt.localeCompare(right.recordedAt));
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

  const setDisplayLanguageRotation = async (config: DisplayLanguageRotation | null) => {
    const current = await safeReadState();
    return persist({ ...current, displayLanguageRotation: config });
  };

  const setAnnouncement = async (announcement: Announcement | null) => {
    const current = await safeReadState();
    return persist({ ...current, announcement });
  };

  const getDisplayUrl = async () => {
    const current = await safeReadState();
    return current.displayUrl || null;
  };

  return {
    loadState,
    loadStateWithRevision,
    generateState,
    generateBatch,
    appendTickets,
    extendRange,
    setMode,
    updateCurrentlyServing,
    advanceServing,
    markTicketReturned,
    markTicketUnclaimed,
    revertTicketStatus,
    resetState,
    listQueueSummaries,
    listSnapshots,
    restoreSnapshot,
    undo,
    redo,
    setDisplayUrl,
    getDisplayUrl,
    setOperatingHours,
    setDisplayLanguageRotation,
    setAnnouncement,
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
