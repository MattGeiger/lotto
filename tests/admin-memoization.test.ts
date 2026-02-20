import { describe, expect, it } from "vitest";

import type { RaffleState } from "@/lib/state-types";

// --- Pure function replicas of v1.5.1 memoized computations ---
// These mirror the inline logic in admin/page.tsx so we can test correctness
// without rendering the component.

const computeReturnedTickets = (ticketStatus?: RaffleState["ticketStatus"]) => {
  if (!ticketStatus) return [];
  return Object.entries(ticketStatus)
    .filter(([, status]) => status === "returned")
    .map(([ticket]) => Number(ticket))
    .filter((ticket) => Number.isInteger(ticket))
    .sort((a, b) => a - b);
};

const computeUnclaimedTickets = (ticketStatus?: RaffleState["ticketStatus"]) => {
  if (!ticketStatus) return [];
  return Object.entries(ticketStatus)
    .filter(([, status]) => status === "unclaimed")
    .map(([ticket]) => Number(ticket))
    .filter((ticket) => Number.isInteger(ticket))
    .sort((a, b) => a - b);
};

const computeCurrentIndex = (
  generatedOrder?: number[],
  currentlyServing?: number | null,
) => {
  if (!generatedOrder || currentlyServing === null || currentlyServing === undefined)
    return -1;
  return generatedOrder.indexOf(currentlyServing);
};

const computeServerUndrawnCount = (
  startNumber: number,
  endNumber: number,
  generatedOrder: number[],
) => {
  if (startNumber === 0 && endNumber === 0) return 0;
  const drawnSet = new Set(generatedOrder);
  let count = 0;
  for (let i = startNumber; i <= endNumber; i++) {
    if (!drawnSet.has(i)) count++;
  }
  return count;
};

const computeNextServingIndex = (
  generatedOrder: number[] | undefined,
  ticketStatus: RaffleState["ticketStatus"] | undefined,
  currentIndex: number,
) => {
  if (!generatedOrder?.length) return -1;
  const status = ticketStatus ?? {};
  for (let i = currentIndex + 1; i < generatedOrder.length; i++) {
    if (status[generatedOrder[i]] !== "returned") return i;
  }
  return -1;
};

const computePrevServingIndex = (
  generatedOrder: number[] | undefined,
  ticketStatus: RaffleState["ticketStatus"] | undefined,
  currentIndex: number,
) => {
  if (!generatedOrder?.length) return -1;
  const status = ticketStatus ?? {};
  if (currentIndex === -1) {
    // Find first non-returned
    for (let i = 0; i < generatedOrder.length; i++) {
      if (status[generatedOrder[i]] !== "returned") return i;
    }
    return -1;
  }
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (status[generatedOrder[i]] !== "returned") return i;
  }
  return -1;
};

describe("Admin memoized derived values", () => {
  describe("returnedTickets", () => {
    it("returns empty for undefined status", () => {
      expect(computeReturnedTickets(undefined)).toEqual([]);
    });

    it("returns empty for no returned tickets", () => {
      expect(computeReturnedTickets({})).toEqual([]);
    });

    it("filters and sorts returned tickets", () => {
      const status = { 5: "returned", 3: "returned", 8: "unclaimed" } as RaffleState["ticketStatus"];
      expect(computeReturnedTickets(status)).toEqual([3, 5]);
    });
  });

  describe("unclaimedTickets", () => {
    it("returns empty for undefined status", () => {
      expect(computeUnclaimedTickets(undefined)).toEqual([]);
    });

    it("filters and sorts unclaimed tickets", () => {
      const status = { 5: "unclaimed", 3: "returned", 8: "unclaimed" } as RaffleState["ticketStatus"];
      expect(computeUnclaimedTickets(status)).toEqual([5, 8]);
    });
  });

  describe("currentIndex", () => {
    it("returns -1 when no order", () => {
      expect(computeCurrentIndex(undefined, 3)).toBe(-1);
    });

    it("returns -1 when currentlyServing is null", () => {
      expect(computeCurrentIndex([1, 2, 3], null)).toBe(-1);
    });

    it("finds correct index", () => {
      expect(computeCurrentIndex([5, 3, 7, 1], 7)).toBe(2);
    });

    it("returns -1 when ticket not in order", () => {
      expect(computeCurrentIndex([1, 2, 3], 99)).toBe(-1);
    });
  });

  describe("serverUndrawnCount", () => {
    it("returns 0 for empty range (0, 0)", () => {
      expect(computeServerUndrawnCount(0, 0, [])).toBe(0);
    });

    it("counts all as undrawn when no tickets generated", () => {
      expect(computeServerUndrawnCount(1, 10, [])).toBe(10);
    });

    it("counts correctly with partial draw", () => {
      expect(computeServerUndrawnCount(1, 10, [1, 3, 5, 7, 9])).toBe(5);
    });

    it("returns 0 when all drawn", () => {
      expect(
        computeServerUndrawnCount(1, 5, [1, 2, 3, 4, 5]),
      ).toBe(0);
    });
  });

  describe("nextServingIndex", () => {
    it("returns -1 for empty order", () => {
      expect(computeNextServingIndex([], {}, 0)).toBe(-1);
    });

    it("returns next non-returned index", () => {
      const order = [3, 7, 1, 9, 5];
      expect(computeNextServingIndex(order, {}, 0)).toBe(1);
    });

    it("skips returned tickets", () => {
      const order = [3, 7, 1, 9, 5];
      const status = { 7: "returned" } as RaffleState["ticketStatus"];
      expect(computeNextServingIndex(order, status, 0)).toBe(2); // index of 1
    });

    it("returns -1 when at end", () => {
      expect(computeNextServingIndex([3, 7], {}, 1)).toBe(-1);
    });
  });

  describe("prevServingIndex", () => {
    it("returns first non-returned when currentIndex is -1", () => {
      const order = [3, 7, 1];
      expect(computePrevServingIndex(order, {}, -1)).toBe(0);
    });

    it("skips returned tickets going backwards", () => {
      const order = [3, 7, 1, 9];
      const status = { 7: "returned" } as RaffleState["ticketStatus"];
      // From index 2 (ticket 1), prev skipping 7 → index 0 (ticket 3)
      expect(computePrevServingIndex(order, status, 2)).toBe(0);
    });

    it("returns -1 when at beginning", () => {
      expect(computePrevServingIndex([3, 7], {}, 0)).toBe(-1);
    });
  });
});
