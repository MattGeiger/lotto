import { fromZonedTime, toZonedTime } from "date-fns-tz";

import type { DayOfWeek, OperatingHours } from "./state-types";
import { resolveTimeZone } from "./timezone-utils";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;

const PRE_OPEN_SLACK_MINUTES = 30;
const POST_CLOSE_SLACK_MINUTES = 30;

const BASELINE_CLOSED_MS = 30 * MINUTE_MS;
const BASELINE_PRE_OPEN_MS = 5 * MINUTE_MS;
const BASELINE_OPEN_MS = 5 * MINUTE_MS;
const OPEN_MAX_MS = 15 * MINUTE_MS;
const BURST_INTERVAL_MS = 30 * SECOND_MS;

export type PollingWindow = "closed" | "pre-open" | "open";

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

const addDays = (base: Date, days: number) => {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const buildZonedDateTime = (baseZonedDate: Date, timeZone: string, time24: string) => {
  const { hours, minutes, seconds } = parseTime(time24);
  const local = new Date(
    baseZonedDate.getFullYear(),
    baseZonedDate.getMonth(),
    baseZonedDate.getDate(),
    hours,
    minutes,
    seconds,
    0,
  );
  return fromZonedTime(local, timeZone);
};

const getNextPreOpenAt = (hours: OperatingHours, now: Date, timeZone: string) => {
  const zonedNow = toZonedTime(now, timeZone);
  const preSlackMs = PRE_OPEN_SLACK_MINUTES * MINUTE_MS;
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(zonedNow, offset);
    const day = DAYS[candidate.getDay()];
    const config = hours[day];
    if (config?.isOpen) {
      const openAt = buildZonedDateTime(candidate, timeZone, config.openTime);
      return new Date(openAt.getTime() - preSlackMs);
    }
  }
  return null;
};

export type PollingWindowStatus = {
  window: PollingWindow;
  nextPreOpenAt: Date | null;
};

export const getPollingWindowStatus = (
  hours: OperatingHours | null,
  now: Date,
  timeZone?: string | null,
): PollingWindowStatus => {
  if (!hours) {
    return { window: "open", nextPreOpenAt: null };
  }

  const resolvedTimeZone = resolveTimeZone(timeZone);
  const zonedNow = toZonedTime(now, resolvedTimeZone);
  const today = DAYS[zonedNow.getDay()];
  const config = hours[today];
  const preSlackMs = PRE_OPEN_SLACK_MINUTES * MINUTE_MS;
  const postSlackMs = POST_CLOSE_SLACK_MINUTES * MINUTE_MS;

  if (config?.isOpen) {
    const openAt = buildZonedDateTime(zonedNow, resolvedTimeZone, config.openTime);
    const closeAt = buildZonedDateTime(zonedNow, resolvedTimeZone, config.closeTime);
    const preOpenStart = new Date(openAt.getTime() - preSlackMs);
    const postCloseEnd = new Date(closeAt.getTime() + postSlackMs);

    if (now >= openAt && now <= postCloseEnd) {
      return { window: "open", nextPreOpenAt: null };
    }
    if (now >= preOpenStart && now < openAt) {
      return { window: "pre-open", nextPreOpenAt: null };
    }
    if (now < preOpenStart) {
      return { window: "closed", nextPreOpenAt: preOpenStart };
    }
  }

  return {
    window: "closed",
    nextPreOpenAt: getNextPreOpenAt(hours, now, resolvedTimeZone),
  };
};

const getBaselineDelayMs = (window: PollingWindow) => {
  switch (window) {
    case "pre-open":
      return BASELINE_PRE_OPEN_MS;
    case "open":
      return BASELINE_OPEN_MS;
    default:
      return BASELINE_CLOSED_MS;
  }
};

const getActiveDelayMs = (timeSinceChangeMs: number, window: PollingWindow) => {
  if (timeSinceChangeMs < 10 * MINUTE_MS) return 1 * MINUTE_MS;
  if (timeSinceChangeMs < 30 * MINUTE_MS) return 2 * MINUTE_MS;
  if (timeSinceChangeMs < 60 * MINUTE_MS) return 5 * MINUTE_MS;
  if (timeSinceChangeMs < 240 * MINUTE_MS) return 10 * MINUTE_MS;
  return window === "closed" ? 30 * MINUTE_MS : 15 * MINUTE_MS;
};

export type PollingIntervalInput = {
  now: Date;
  lastChangeAt: number | null;
  burstUntil?: number | null;
  operatingHours: OperatingHours | null;
  timeZone?: string | null;
};

export type PollingIntervalResult = {
  delayMs: number;
  window: PollingWindow;
  nextPreOpenAt: Date | null;
};

export const getPollingIntervalMs = ({
  now,
  lastChangeAt,
  burstUntil,
  operatingHours,
  timeZone,
}: PollingIntervalInput): PollingIntervalResult => {
  const windowStatus = getPollingWindowStatus(operatingHours, now, timeZone);
  const nowMs = now.getTime();

  if (typeof burstUntil === "number" && nowMs < burstUntil) {
    return {
      delayMs: BURST_INTERVAL_MS,
      window: windowStatus.window,
      nextPreOpenAt: windowStatus.nextPreOpenAt,
    };
  }

  const timeSinceChangeMs =
    typeof lastChangeAt === "number" ? Math.max(0, nowMs - lastChangeAt) : null;
  let delayMs =
    timeSinceChangeMs === null
      ? getBaselineDelayMs(windowStatus.window)
      : getActiveDelayMs(timeSinceChangeMs, windowStatus.window);

  if (windowStatus.window === "pre-open") {
    delayMs = Math.min(delayMs, BASELINE_PRE_OPEN_MS);
  }
  if (windowStatus.window === "open") {
    delayMs = Math.min(delayMs, OPEN_MAX_MS);
  }

  if (windowStatus.window === "closed" && windowStatus.nextPreOpenAt) {
    const timeToPreOpenMs = windowStatus.nextPreOpenAt.getTime() - nowMs;
    if (timeToPreOpenMs > 0) {
      delayMs = Math.min(delayMs, timeToPreOpenMs);
    }
  }

  return {
    delayMs,
    window: windowStatus.window,
    nextPreOpenAt: windowStatus.nextPreOpenAt,
  };
};
