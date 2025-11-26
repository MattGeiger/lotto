export type Mode = "random" | "sequential";

export type RaffleState = {
  startNumber: number;
  endNumber: number;
  mode: Mode;
  generatedOrder: number[];
  currentlyServing: number | null;
  orderLocked: boolean;
  timestamp: number | null;
  displayUrl: string | null;
};

export const defaultState: RaffleState = {
  startNumber: 0,
  endNumber: 0,
  mode: "random",
  generatedOrder: [],
  currentlyServing: null,
  orderLocked: false,
  timestamp: null,
  displayUrl: null,
};

export const formatTimestamp = (timestamp: number) => {
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
