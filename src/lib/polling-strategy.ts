import type { DayOfWeek, OperatingHours } from "./state-types";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;

const OPEN_ACTIVE_LADDER_MS = [10, 20, 30, 45, 60, 120].map((seconds) => seconds * SECOND_MS);
const OPEN_IDLE_LADDERS = [
  { minIdleMs: 120 * MINUTE_MS, ladder: [60, 120].map((m) => m * MINUTE_MS), name: "open-idle-120m" },
  { minIdleMs: 60 * MINUTE_MS, ladder: [45, 60].map((m) => m * MINUTE_MS), name: "open-idle-60m" },
  { minIdleMs: 30 * MINUTE_MS, ladder: [15, 30].map((m) => m * MINUTE_MS), name: "open-idle-30m" },
  { minIdleMs: 10 * MINUTE_MS, ladder: [5, 10].map((m) => m * MINUTE_MS), name: "open-idle-10m" },
];
const CLOSED_LADDER_MS = [5, 10, 20, 45, 60, 120].map((m) => m * MINUTE_MS);
const CLOSED_MAX_MS = 120 * MINUTE_MS;
const DEFAULT_SLACK_MINUTES = 15;

const DAYS: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const parseTime = (time24: string) => {
  const [hoursRaw, minutesRaw, secondsRaw] = time24.split(":");
  const hours = Number(hoursRaw ?? 0);
  const minutes = Number(minutesRaw ?? 0);
  const seconds = Number(secondsRaw ?? 0);
  return { hours, minutes, seconds };
};

const withTime = (base: Date, time24: string) => {
  const { hours, minutes, seconds } = parseTime(time24);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hours,
    minutes,
    seconds,
    0,
  );
};

const addDays = (base: Date, days: number) => {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const getNextOpenAt = (hours: OperatingHours, now: Date, slackMinutes: number) => {
  const slackMs = slackMinutes * MINUTE_MS;
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(now, offset);
    const day = DAYS[candidate.getDay()];
    const config = hours[day];
    if (config?.isOpen) {
      const openAt = withTime(candidate, config.openTime);
      return new Date(openAt.getTime() - slackMs);
    }
  }
  return null;
};

export type PollingWindowStatus = {
  isOpenWindow: boolean;
  nextOpenAt: Date | null;
};

export const getPollingWindowStatus = (
  hours: OperatingHours | null,
  now: Date,
  slackMinutes = DEFAULT_SLACK_MINUTES,
): PollingWindowStatus => {
  if (!hours) {
    return { isOpenWindow: true, nextOpenAt: null };
  }

  const today = DAYS[now.getDay()];
  const config = hours[today];
  const slackMs = slackMinutes * MINUTE_MS;

  if (config?.isOpen) {
    const openAt = withTime(now, config.openTime);
    const closeAt = withTime(now, config.closeTime);
    const openStart = new Date(openAt.getTime() - slackMs);
    const openEnd = new Date(closeAt.getTime() + slackMs);

    if (now >= openStart && now <= openEnd) {
      return { isOpenWindow: true, nextOpenAt: null };
    }
    if (now < openStart) {
      return { isOpenWindow: false, nextOpenAt: openStart };
    }
  }

  return { isOpenWindow: false, nextOpenAt: getNextOpenAt(hours, now, slackMinutes) };
};

const selectOpenLadder = (timeSinceChangeMs: number) => {
  for (const tier of OPEN_IDLE_LADDERS) {
    if (timeSinceChangeMs >= tier.minIdleMs) {
      return { ladder: tier.ladder, name: tier.name };
    }
  }
  return { ladder: OPEN_ACTIVE_LADDER_MS, name: "open-active" };
};

export type PollingIntervalInput = {
  now: Date;
  lastChangeAt: number | null;
  operatingHours: OperatingHours | null;
  pollStep: number;
  slackMinutes?: number;
};

export type PollingIntervalResult = {
  delayMs: number;
  ladder: string;
  isOpenWindow: boolean;
  capMs?: number;
};

export const getPollingIntervalMs = ({
  now,
  lastChangeAt,
  operatingHours,
  pollStep,
  slackMinutes = DEFAULT_SLACK_MINUTES,
}: PollingIntervalInput): PollingIntervalResult => {
  const timeSinceChangeMs =
    typeof lastChangeAt === "number" ? Math.max(0, now.getTime() - lastChangeAt) : 0;
  const windowStatus = getPollingWindowStatus(operatingHours, now, slackMinutes);

  if (windowStatus.isOpenWindow) {
    const { ladder, name } = selectOpenLadder(timeSinceChangeMs);
    const stepIndex = Math.min(pollStep, ladder.length - 1);
    return {
      delayMs: ladder[stepIndex],
      ladder: name,
      isOpenWindow: true,
    };
  }

  const stepIndex = Math.min(pollStep, CLOSED_LADDER_MS.length - 1);
  const baseDelay = CLOSED_LADDER_MS[stepIndex];
  let capMs = CLOSED_MAX_MS;
  if (windowStatus.nextOpenAt) {
    const timeToOpenMs = windowStatus.nextOpenAt.getTime() - now.getTime();
    if (timeToOpenMs > 0) {
      capMs = Math.min(CLOSED_MAX_MS, Math.floor(timeToOpenMs / 2));
    }
  }

  return {
    delayMs: Math.min(baseDelay, capMs),
    ladder: "closed",
    isOpenWindow: false,
    capMs,
  };
};
