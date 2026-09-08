// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

import {
  buildPublicStateEnvelope,
  hashPublicState,
  publicRaffleStateSchema,
  publicStateEnvelopeSchema,
  stableStringify,
  toPublicRaffleState,
} from "@/lib/realtime/public-state-protocol";
import { defaultState } from "@/lib/state-types";

describe("public realtime state protocol", () => {
  it("removes internal queue-session evidence from the public state", () => {
    const state = {
      ...structuredClone(defaultState),
      queueSession: {
        sessionId: "internal-session",
        sessionStartedAt: null,
        serviceDate: "2026-08-31",
        serviceDateBasis: "closeout" as const,
        timezone: "America/Los_Angeles",
        operatingWindow: null,
        timingCoverage: "complete" as const,
        initialMode: "sequential" as const,
        switchedRandomToSequential: false,
        appendedTickets: false,
        batches: [],
        tickets: {},
      },
    };

    const publicState = toPublicRaffleState(state);

    expect(publicState).not.toHaveProperty("queueSession");
    expect(publicRaffleStateSchema.parse(publicState)).toEqual(publicState);
  });

  it("produces the same canonical form and checksum for reordered object keys", async () => {
    const left = { beta: { two: 2, one: 1 }, alpha: [3, 2, 1] };
    const right = { alpha: [3, 2, 1], beta: { one: 1, two: 2 } };

    expect(stableStringify(left)).toBe(stableStringify(right));

    const state = toPublicRaffleState(structuredClone(defaultState));
    const reorderedState = Object.fromEntries(
      Object.entries(state).reverse(),
    ) as typeof state;
    expect(await hashPublicState(state)).toBe(
      await hashPublicState(reorderedState),
    );
  });

  it("builds a validated, checksummed protocol v1 envelope", async () => {
    const state = {
      ...structuredClone(defaultState),
      startNumber: 1,
      endNumber: 3,
      generatedOrder: [1, 2, 3],
      currentlyServing: 2,
      timestamp: Date.parse("2026-08-31T20:00:00.000Z"),
    };

    const envelope = await buildPublicStateEnvelope({
      agencyId: "william-temple-house",
      revision: 7,
      state,
      publicationId: "965104d8-44a2-41b7-b7d0-d82d9c9d3a50",
      committedAt: "2026-08-31T20:00:00.000Z",
      publishedAt: "2026-08-31T20:00:00.100Z",
    });

    expect(publicStateEnvelopeSchema.parse(envelope)).toEqual(envelope);
    expect(envelope.revision).toBe(7);
    expect(envelope.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects an internal field even when a caller bypasses TypeScript", () => {
    const publicState = toPublicRaffleState(structuredClone(defaultState));

    expect(() =>
      publicRaffleStateSchema.parse({
        ...publicState,
        queueSession: { sessionId: "must-not-leak" },
      }),
    ).toThrow();
  });
});
