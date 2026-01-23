import { getTimezoneOffset } from "date-fns-tz";

export const resolveTimeZone = (timeZone?: string | null): string => {
  const trimmed = typeof timeZone === "string" ? timeZone.trim() : "";
  if (trimmed) return trimmed;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const getBrowserTimezoneOffsetMinutes = (at: Date = new Date()): number =>
  -at.getTimezoneOffset();

export const getTimezoneOffsetMinutes = (timeZone: string, at: Date = new Date()): number =>
  Math.round(getTimezoneOffset(timeZone, at) / 60_000);

export const shouldWarnTimezoneMismatch = (
  timeZone: string,
  at: Date = new Date(),
  thresholdMinutes = 55,
): boolean => {
  try {
    const resolved = resolveTimeZone(timeZone);
    const browserOffset = getBrowserTimezoneOffsetMinutes(at);
    const selectedOffset = getTimezoneOffsetMinutes(resolved, at);
    return Math.abs(browserOffset - selectedOffset) > thresholdMinutes;
  } catch {
    return false;
  }
};
