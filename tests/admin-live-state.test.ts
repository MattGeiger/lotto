import { describe, expect, it } from "vitest";

/**
 * These tests verify the computation logic used in the admin page's
 * Live State card for the three new subcards: Tickets Called,
 * People Waiting, and Max Wait Time.
 *
 * The logic is inline in the React component, so we replicate the
 * exact same algorithms here to validate correctness.
 */

type TicketStatus = "returned" | "unclaimed";

// Mirrors the computation in src/app/admin/page.tsx
function computeTicketsCalled(
  generatedOrder: number[] | undefined,
  currentIndex: number,
  ticketStatus: Record<number, TicketStatus> | undefined,
): number {
  if (!generatedOrder || currentIndex < 0) return 0;
  let count = 0;
  for (let i = 0; i <= currentIndex; i++) {
    const ticket = generatedOrder[i];
    if (ticketStatus?.[ticket] !== "returned") {
      count++;
    }
  }
  return count;
}

function computePeopleWaiting(
  generatedOrder: number[] | undefined,
  currentIndex: number,
  totalTickets: number,
  ticketStatus: Record<number, TicketStatus> | undefined,
): number {
  if (!generatedOrder || currentIndex < 0) return totalTickets;
  let count = 0;
  for (let i = currentIndex + 1; i < generatedOrder.length; i++) {
    const ticket = generatedOrder[i];
    if (ticketStatus?.[ticket] !== "returned") {
      count++;
    }
  }
  return count;
}

function computeMaxWaitMinutes(peopleWaiting: number): number | null {
  const MINUTES_PER_TICKET = 2.2;
  return peopleWaiting > 0 ? Math.round(peopleWaiting * MINUTES_PER_TICKET) : null;
}

describe("Admin Live State: Tickets Called", () => {
  it("returns 0 when no tickets are generated", () => {
    expect(computeTicketsCalled(undefined, -1, undefined)).toBe(0);
  });

  it("returns 0 when nothing has been served yet", () => {
    const order = [5, 3, 1, 4, 2];
    expect(computeTicketsCalled(order, -1, undefined)).toBe(0);
  });

  it("counts tickets up to and including the current serving position", () => {
    const order = [5, 3, 1, 4, 2];
    // currentIndex 2 means ticket at index 2 (ticket #1) is being served
    // tickets called: index 0 (5), 1 (3), 2 (1) = 3
    expect(computeTicketsCalled(order, 2, undefined)).toBe(3);
  });

  it("excludes returned tickets from the count", () => {
    const order = [5, 3, 1, 4, 2];
    const status: Record<number, TicketStatus> = { 3: "returned" };
    // currentIndex 2: tickets 5, 3, 1 — but 3 is returned → 2
    expect(computeTicketsCalled(order, 2, status)).toBe(2);
  });

  it("includes unclaimed tickets in the count", () => {
    const order = [5, 3, 1, 4, 2];
    const status: Record<number, TicketStatus> = { 3: "unclaimed" };
    // currentIndex 2: tickets 5, 3, 1 — 3 is unclaimed but was still called → 3
    expect(computeTicketsCalled(order, 2, status)).toBe(3);
  });

  it("counts all tickets when serving the last one", () => {
    const order = [5, 3, 1, 4, 2];
    expect(computeTicketsCalled(order, 4, undefined)).toBe(5);
  });
});

describe("Admin Live State: People Waiting", () => {
  it("returns total tickets when nothing has been served yet", () => {
    const order = [5, 3, 1, 4, 2];
    expect(computePeopleWaiting(order, -1, 5, undefined)).toBe(5);
  });

  it("returns total tickets when generatedOrder is undefined", () => {
    expect(computePeopleWaiting(undefined, -1, 10, undefined)).toBe(10);
  });

  it("counts tickets after the current serving position", () => {
    const order = [5, 3, 1, 4, 2];
    // currentIndex 1: tickets after are 1, 4, 2 = 3
    expect(computePeopleWaiting(order, 1, 5, undefined)).toBe(3);
  });

  it("excludes returned tickets from the waiting count", () => {
    const order = [5, 3, 1, 4, 2];
    const status: Record<number, TicketStatus> = { 4: "returned" };
    // currentIndex 1: tickets after are 1, 4, 2 — 4 is returned → 2
    expect(computePeopleWaiting(order, 1, 5, status)).toBe(2);
  });

  it("returns 0 when serving the last ticket", () => {
    const order = [5, 3, 1, 4, 2];
    expect(computePeopleWaiting(order, 4, 5, undefined)).toBe(0);
  });

  it("returns 0 when all remaining are returned", () => {
    const order = [5, 3, 1, 4, 2];
    const status: Record<number, TicketStatus> = { 1: "returned", 4: "returned", 2: "returned" };
    // currentIndex 1: tickets after are 1, 4, 2 — all returned → 0
    expect(computePeopleWaiting(order, 1, 5, status)).toBe(0);
  });
});

describe("Admin Live State: Max Wait Time", () => {
  it("returns null when no one is waiting", () => {
    expect(computeMaxWaitMinutes(0)).toBeNull();
  });

  it("computes wait time using 2.2 min/ticket", () => {
    // 10 people waiting × 2.2 min = 22 min
    expect(computeMaxWaitMinutes(10)).toBe(22);
  });

  it("rounds to nearest minute", () => {
    // 3 people × 2.2 = 6.6 → rounds to 7
    expect(computeMaxWaitMinutes(3)).toBe(7);
  });

  it("handles large queues", () => {
    // 75 people × 2.2 = 165 min
    expect(computeMaxWaitMinutes(75)).toBe(165);
  });

  it("handles single person waiting", () => {
    // 1 person × 2.2 = 2.2 → rounds to 2
    expect(computeMaxWaitMinutes(1)).toBe(2);
  });
});
