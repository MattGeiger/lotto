import fs from "node:fs/promises";
import path from "node:path";

export type Mode = "random" | "sequential";

export type RaffleState = {
  startNumber: number;
  endNumber: number;
  mode: Mode;
  generatedOrder: number[];
  currentlyServing: number | null;
  timestamp: number | null;
};

export const defaultState: RaffleState = {
  startNumber: 0,
  endNumber: 0,
  mode: "random",
  generatedOrder: [],
  currentlyServing: null,
  timestamp: null,
};

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (value: number, length = 2) => value.toString().padStart(length, "0");
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds()) +
    pad(date.getMilliseconds(), 3)
  );
};

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

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
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

export const createStateManager = (baseDir = path.join(process.cwd(), "data")) => {
  const statePath = path.join(baseDir, "state.json");

  const persist = async (state: RaffleState): Promise<RaffleState> => {
    await ensureDir(baseDir);
    const timestamped = withTimestamp(state);
    const uniqueSuffix = Math.random().toString(36).slice(2, 8);
    const tempPath = path.join(
      baseDir,
      `state-${timestamped.timestamp}-${uniqueSuffix}.tmp`,
    );
    const payload = JSON.stringify(timestamped, null, 2);

    await fs.writeFile(tempPath, payload, "utf-8");
    const backupName = `state-${formatTimestamp(timestamped.timestamp)}-${uniqueSuffix}.json`;
    await fs.copyFile(tempPath, path.join(baseDir, backupName));
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

  const loadState = async () => safeReadState();

  const generateState = async (input: {
    startNumber: number;
    endNumber: number;
    mode: Mode;
  }) => {
    validateRange(input.startNumber, input.endNumber);
    const generatedOrder = generateOrder(
      input.startNumber,
      input.endNumber,
      input.mode,
    );
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

    if (
      value !== null &&
      (value < current.startNumber || value > current.endNumber)
    ) {
      throw new Error("Currently serving must be within the active range.");
    }

    return persist({
      ...current,
      currentlyServing: value,
    });
  };

  const resetState = async () => persist(defaultState);

  return {
    loadState,
    generateState,
    appendTickets,
    setMode,
    updateCurrentlyServing,
    resetState,
    rerandomize,
  };
};

export const stateManager = createStateManager();
