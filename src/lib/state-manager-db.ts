import { randomInt } from "node:crypto";

import { neon } from "@neondatabase/serverless";

import {
  defaultState,
  formatTimestamp,
  type Mode,
  type OperatingHours,
  type RaffleState,
} from "./state-types";
import { UserInputError } from "./user-input-error";

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

const withTimestamp = (state: RaffleState) => ({
  ...state,
  timestamp: Date.now(),
});

const MAX_TICKET_NUMBER = 999_999;

export const createDbStateManager = (databaseUrl = process.env.DATABASE_URL) => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to use the Postgres state manager.");
  }

  const sql = neon(databaseUrl);
  const withTimeout = async <T>(promise: Promise<T>) => {
    const timeoutMs = Number(process.env.DATABASE_TIMEOUT_MS ?? "5000");
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Database request timed out after ${timeoutMs}ms.`)),
        timeoutMs,
      );
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  };
  let lastRedoSnapshot: { id: string; timestamp: number } | null = null;
  let lastPersistTs = 0;

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

  const persist = async (
    state: RaffleState,
    options?: { preserveTimestamp?: boolean; skipBackup?: boolean },
  ): Promise<RaffleState> => {
    const timestamped =
      options?.preserveTimestamp && state.timestamp !== null ? state : withTimestamp(state);
    let ts = timestamped.timestamp ?? Date.now();
    if (ts <= lastPersistTs) {
      ts = lastPersistTs + 1;
      timestamped.timestamp = ts;
    }
    lastPersistTs = ts;
    const uniqueSuffix = Math.random().toString(36).slice(2, 8);
    const snapshotId = `state-${formatTimestamp(ts)}-${uniqueSuffix}.json`;

    const payload = JSON.stringify(timestamped);

    await withTimeout(
      sql.transaction((tx) => {
        const statements = [];
        if (!options?.skipBackup) {
          statements.push(tx`
          insert into raffle_snapshots (id, payload)
          values (${snapshotId}, ${payload}::jsonb)
          on conflict (id) do nothing;
        `);
        }
        statements.push(tx`
        insert into raffle_state (id, payload, updated_at)
        values ('singleton', ${payload}::jsonb, now())
        on conflict (id) do update set payload = excluded.payload, updated_at = excluded.updated_at;
      `);
        return statements;
      }),
    );

    return timestamped;
  };

  const safeReadState = async (): Promise<RaffleState> => {
    const rows = (await withTimeout(sql`
      select payload from raffle_state where id = 'singleton' limit 1;
    `)) as Array<{ payload: RaffleState }>;
    if (rows.length === 0) {
      return persist(defaultState);
    }
    const payload = rows[0]?.payload ?? defaultState;
    return {
      ...defaultState,
      ...payload,
      timestamp: payload.timestamp ?? Date.now(),
    };
  };

  const loadState = async () => safeReadState();

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

    return persist({
      ...current,
      endNumber: newEndNumber,
      generatedOrder,
    });
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
      const generatedOrder = generateOrder(current.startNumber, current.endNumber, mode);
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

    if (value !== null && (value < current.startNumber || value > current.endNumber)) {
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
    cleanupOldSnapshots(30).catch((error) => {
      console.warn("[State] Snapshot cleanup failed:", error);
    });
    return persist({
      ...defaultState,
      ticketStatus: {},
      calledAt: {},
      operatingHours: current.operatingHours ?? defaultState.operatingHours,
      timezone: current.timezone ?? defaultState.timezone,
    });
  };

  const listSnapshots = async () => {
    const rows = (await withTimeout(sql`
      select id, created_at from raffle_snapshots order by created_at desc, id desc;
    `)) as Array<{ id: string; created_at: string }>;
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      path: row.id,
    }));
  };

  const restoreSnapshot = async (id: string) => {
    const rows = (await withTimeout(sql`
      select payload from raffle_snapshots where id = ${id} limit 1;
    `)) as Array<{ payload: RaffleState }>;
    const snapshot = rows[0];
    if (!snapshot) {
      throw new Error("Snapshot not found.");
    }
    return persist(snapshot.payload, { preserveTimestamp: true });
  };

  const cleanupOldSnapshots = async (retentionDays = 30) => {
    const rows = (await withTimeout(sql`
      delete from raffle_snapshots
      where created_at < now() - make_interval(days => ${retentionDays})
      returning id;
    `)) as Array<{ id: string }>;
    return rows.length;
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
    setOperatingHours,
    cleanupOldSnapshots,
  };
};
