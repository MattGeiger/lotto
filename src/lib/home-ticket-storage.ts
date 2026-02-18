const HOMEPAGE_TICKET_STORAGE_KEY = "homepage-ticket-selection-v1";

type PersistedTicketSelection = {
  ticketNumber: number;
  expiresAt: number;
  savedAt: number;
};

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function isValidTicketNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99;
}

function isValidPersistedTicketSelection(value: unknown): value is PersistedTicketSelection {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<PersistedTicketSelection>;
  return (
    isValidTicketNumber(maybe.ticketNumber) &&
    typeof maybe.expiresAt === "number" &&
    Number.isFinite(maybe.expiresAt) &&
    typeof maybe.savedAt === "number" &&
    Number.isFinite(maybe.savedAt)
  );
}

export function getNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

export function clearPersistedHomepageTicket(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(HOMEPAGE_TICKET_STORAGE_KEY);
}

export function readPersistedHomepageTicket(nowMs: number = Date.now()): number | null {
  if (!hasWindow()) return null;
  const raw = window.localStorage.getItem(HOMEPAGE_TICKET_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidPersistedTicketSelection(parsed)) {
      clearPersistedHomepageTicket();
      return null;
    }

    if (parsed.expiresAt <= nowMs) {
      clearPersistedHomepageTicket();
      return null;
    }

    return parsed.ticketNumber;
  } catch {
    clearPersistedHomepageTicket();
    return null;
  }
}

export function writePersistedHomepageTicket(ticketNumber: number, now: Date = new Date()): void {
  if (!hasWindow()) return;
  if (!isValidTicketNumber(ticketNumber)) return;

  const payload: PersistedTicketSelection = {
    ticketNumber,
    expiresAt: getNextLocalMidnight(now),
    savedAt: now.getTime(),
  };

  window.localStorage.setItem(HOMEPAGE_TICKET_STORAGE_KEY, JSON.stringify(payload));
}

export { HOMEPAGE_TICKET_STORAGE_KEY };
export type { PersistedTicketSelection };

