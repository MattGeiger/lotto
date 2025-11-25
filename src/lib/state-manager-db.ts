import { neon } from "@neondatabase/serverless";

import { defaultState, formatTimestamp, type Mode, type RaffleState } from "./state-types";

const buildRange = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const shuffle = (values: number[]) => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const withTimestamp = (state: RaffleState) => ({
  ...state,
  timestamp: Date.now(),
});

const insertAtRandomPositions = (base: number[], additions: number[]) => {
  const result = [...base];
  for (const value of additions) {
    const index = Math.floor(Math.random() * (result.length + 1));
    result.splice(index, 0, value);
  }
  return result;
};

export const createDbStateManager = (databaseUrl = process.env.DATABASE_URL) => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to use the Postgres state manager.");
  }

  const sql = neon(databaseUrl);
  let lastRedoSnapshot: { id: string; timestamp: number } | null = null;
  let lastPersistTs = 0;

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

  const reshuffleUntilDifferent = (
    original: number[],
    startNumber: number,
    endNumber: number,
  ) => {
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = generateOrder(startNumber, endNumber, "random");
      if (candidate.some((value, index) => value !== original[index])) {
        return candidate;
      }
    }
    return generateOrder(startNumber, endNumber, "random");
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

    await sql.transaction((tx) => {
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
    });

    return timestamped;
  };

  const safeReadState = async (): Promise<RaffleState> => {
    const rows = (await sql`
      select payload from raffle_state where id = 'singleton' limit 1;
    `) as Array<{ payload: RaffleState }>;
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
    validateRange(input.startNumber, input.endNumber);
    const generatedOrder = generateOrder(input.startNumber, input.endNumber, input.mode);
    return persist({
      startNumber: input.startNumber,
      endNumber: input.endNumber,
      mode: input.mode,
      generatedOrder,
      currentlyServing: null,
      timestamp: null,
    });
  };

  const appendTickets = async (newEndNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (newEndNumber <= current.endNumber) {
      throw new Error("New end number must be greater than the current end number.");
    }

    const additions = buildRange(current.endNumber + 1, newEndNumber);
    const generatedOrder =
      current.mode === "random"
        ? insertAtRandomPositions(current.generatedOrder, shuffle(additions))
        : [...current.generatedOrder, ...additions];

    return persist({
      ...current,
      endNumber: newEndNumber,
      generatedOrder,
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

  const rerandomize = async () => {
    const current = await safeReadState();
    ensureHasRange(current);

    const generatedOrder = reshuffleUntilDifferent(
      current.generatedOrder,
      current.startNumber,
      current.endNumber,
    );

    return persist({
      ...current,
      mode: "random",
      generatedOrder,
    });
  };

  const updateCurrentlyServing = async (value: number | null) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (value !== null && (value < current.startNumber || value > current.endNumber)) {
      throw new Error("Currently serving must be within the active range.");
    }

    return persist({
      ...current,
      currentlyServing: value,
    });
  };

  const resetState = async () => persist(defaultState);

  const listSnapshots = async () => {
    const rows = (await sql`
      select id, created_at, payload from raffle_snapshots order by created_at desc, id desc;
    `) as Array<{ id: string; created_at: string; payload: RaffleState }>;
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      path: row.id,
    }));
  };

  const restoreSnapshot = async (id: string) => {
    const rows = (await sql`
      select payload from raffle_snapshots where id = ${id} limit 1;
    `) as Array<{ payload: RaffleState }>;
    const snapshot = rows[0];
    if (!snapshot) {
      throw new Error("Snapshot not found.");
    }
    return persist(snapshot.payload, { preserveTimestamp: true });
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

  return {
    loadState,
    generateState,
    appendTickets,
    setMode,
    updateCurrentlyServing,
    resetState,
    rerandomize,
    listSnapshots,
    restoreSnapshot,
    undo,
    redo,
    setDisplayUrl,
  };
};
