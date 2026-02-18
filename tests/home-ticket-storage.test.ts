import { beforeEach, describe, expect, it } from "vitest";

import {
  HOMEPAGE_TICKET_STORAGE_KEY,
  clearPersistedHomepageTicket,
  getNextLocalMidnight,
  readPersistedHomepageTicket,
  writePersistedHomepageTicket,
} from "@/lib/home-ticket-storage";

describe("home ticket storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the next local midnight timestamp", () => {
    const now = new Date(2026, 1, 18, 14, 45, 30, 123);
    const midnightMs = getNextLocalMidnight(now);
    const midnight = new Date(midnightMs);

    expect(midnight.getFullYear()).toBe(2026);
    expect(midnight.getMonth()).toBe(1);
    expect(midnight.getDate()).toBe(19);
    expect(midnight.getHours()).toBe(0);
    expect(midnight.getMinutes()).toBe(0);
    expect(midnight.getSeconds()).toBe(0);
    expect(midnight.getMilliseconds()).toBe(0);
  });

  it("writes and reads a valid unexpired ticket", () => {
    const now = new Date(2026, 1, 18, 9, 0, 0, 0);
    writePersistedHomepageTicket(53, now);

    const read = readPersistedHomepageTicket(now.getTime() + 1_000);
    expect(read).toBe(53);
  });

  it("removes expired entries and returns null", () => {
    window.localStorage.setItem(
      HOMEPAGE_TICKET_STORAGE_KEY,
      JSON.stringify({
        ticketNumber: 12,
        expiresAt: 1_000,
        savedAt: 500,
      }),
    );

    const read = readPersistedHomepageTicket(2_000);
    expect(read).toBeNull();
    expect(window.localStorage.getItem(HOMEPAGE_TICKET_STORAGE_KEY)).toBeNull();
  });

  it("removes malformed json and returns null", () => {
    window.localStorage.setItem(HOMEPAGE_TICKET_STORAGE_KEY, "{not valid json");

    const read = readPersistedHomepageTicket();
    expect(read).toBeNull();
    expect(window.localStorage.getItem(HOMEPAGE_TICKET_STORAGE_KEY)).toBeNull();
  });

  it("removes invalid schema and returns null", () => {
    window.localStorage.setItem(
      HOMEPAGE_TICKET_STORAGE_KEY,
      JSON.stringify({
        ticketNumber: 123,
        expiresAt: Date.now() + 10_000,
        savedAt: Date.now(),
      }),
    );

    const read = readPersistedHomepageTicket();
    expect(read).toBeNull();
    expect(window.localStorage.getItem(HOMEPAGE_TICKET_STORAGE_KEY)).toBeNull();
  });

  it("clears persisted ticket with helper", () => {
    writePersistedHomepageTicket(7, new Date(2026, 1, 18, 12, 0, 0, 0));
    clearPersistedHomepageTicket();
    expect(window.localStorage.getItem(HOMEPAGE_TICKET_STORAGE_KEY)).toBeNull();
  });
});

