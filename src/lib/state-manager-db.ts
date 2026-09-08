// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { randomInt, randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";

import {
  defaultState,
  formatTimestamp,
  type Announcement,
  type DisplayLanguageRotation,
  type Mode,
  type OperatingHours,
  type RaffleState,
} from "./state-types";
import { UserInputError } from "./user-input-error";
import {
  addIssuedTickets,
  createStoredQueueSessionSummary,
  recordFirstCall,
  recordModeTransition,
  type StoredQueueSessionSummary,
} from "./queue-session";
import {
  hashPublicState,
  publicRaffleStateSchema,
  toPublicRaffleState,
  type PublicRaffleState,
} from "./realtime/public-state-protocol";
import {
  publishPublicStateShadow,
  resolveShadowPublicationConfig,
  type ShadowPublicationOutcome,
  type ShadowPublicationIntent,
} from "./realtime/shadow-publication";

const buildRange = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const shuffle = (values: number[]) => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const withTimestamp = (state: RaffleState) => ({
  ...state,
  timestamp: Date.now(),
});

const MAX_TICKET_NUMBER = 999_999;

type DbStateManagerOptions = {
  environment?: Readonly<Record<string, string | undefined>>;
  fetchImpl?: typeof fetch;
};

export const createDbStateManager = (
  databaseUrl = process.env.DATABASE_URL,
  options: DbStateManagerOptions = {},
) => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to use the Postgres state manager.");
  }

  const sql = neon(databaseUrl);
  const environment = options.environment ?? process.env;
  const shadowPublication = resolveShadowPublicationConfig(environment);
  const fetchImpl = options.fetchImpl ?? fetch;
  const withTimeout = async <T>(promise: Promise<T>) => {
    const timeoutMs = Number(environment.DATABASE_TIMEOUT_MS ?? "5000");
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Database request timed out after ${timeoutMs}ms.`)),
        timeoutMs,
      );
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  };
  let lastRedoSnapshot: { id: string; timestamp: number } | null = null;
  let lastPersistTs = 0;

  const recordShadowPublicationOutcome = async (
    publicationId: string,
    revision: number,
    outcome: ShadowPublicationOutcome,
  ) => {
    try {
      if (outcome.accepted) {
        await withTimeout(sql`
          update raffle_public_state_publications
          set status = 'accepted',
              attempt_count = attempt_count + 1,
              last_attempt_at = now(),
              accepted_at = now(),
              last_error = null,
              updated_at = now()
          where publication_id = ${publicationId};
        `);
      } else {
        await withTimeout(sql`
          update raffle_public_state_publications
          set status = 'failed',
              attempt_count = attempt_count + 1,
              last_attempt_at = now(),
              last_error = ${outcome.error.slice(0, 500)},
              updated_at = now()
          where publication_id = ${publicationId};
        `);
      }
    } catch {
      console.warn(
        `[Realtime] Publication evidence update failed for revision ${revision}.`,
      );
    }
  };

  const attemptShadowPublication = async (
    intent: ShadowPublicationIntent,
  ): Promise<ShadowPublicationOutcome> => {
    if (!shadowPublication.enabled) {
      return { accepted: false, error: "Realtime shadow publication is disabled." };
    }

    let outcome: ShadowPublicationOutcome;
    try {
      outcome = await publishPublicStateShadow(
        shadowPublication,
        intent,
        fetchImpl,
      );
    } catch {
      outcome = {
        accepted: false,
        error: "Realtime publication failed unexpectedly.",
      };
    }

    await recordShadowPublicationOutcome(
      intent.publicationId,
      intent.revision,
      outcome,
    );
    if (!outcome.accepted) {
      console.warn(
        `[Realtime] Shadow publication delayed for revision ${intent.revision}: ${outcome.error}`,
      );
    }
    return outcome;
  };

  const validateRange = (
    start: number,
    end: number,
    options?: { requireStrictEnd?: boolean },
  ) => {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new UserInputError("Start and end must be integers.");
    }
    if (start <= 0 || end <= 0) {
      throw new UserInputError("Start and end must be positive numbers.");
    }
    if (start > MAX_TICKET_NUMBER || end > MAX_TICKET_NUMBER) {
      throw new UserInputError("Start and end must be 6 digits or fewer.");
    }
    if (options?.requireStrictEnd ? end <= start : end < start) {
      throw new UserInputError(
        options?.requireStrictEnd
          ? "End number must be greater than start number."
          : "End number must be greater than or equal to start number.",
      );
    }
  };

  const validateNewEndNumber = (value: number) => {
    if (!Number.isInteger(value) || value <= 0) {
      throw new UserInputError("End number must be a positive integer.");
    }
    if (value > MAX_TICKET_NUMBER) {
      throw new UserInputError("End number must be 6 digits or fewer.");
    }
  };

  const countUndrawnTickets = (state: RaffleState) => {
    const drawn = new Set(state.generatedOrder);
    let undrawn = 0;
    for (let ticket = state.startNumber; ticket <= state.endNumber; ticket += 1) {
      if (!drawn.has(ticket)) {
        undrawn += 1;
      }
    }
    return undrawn;
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

  const persistVersioned = async (
    state: RaffleState,
    options?: {
      preserveTimestamp?: boolean;
      skipBackup?: boolean;
      closeout?: StoredQueueSessionSummary | null;
    },
  ): Promise<{ state: RaffleState; revision: number }> => {
    const timestamped =
      options?.preserveTimestamp && state.timestamp !== null ? state : withTimestamp(state);
    let ts = timestamped.timestamp ?? Date.now();
    if (ts <= lastPersistTs) {
      ts = lastPersistTs + 1;
      timestamped.timestamp = ts;
    }
    lastPersistTs = ts;
    const uniqueSuffix = Math.random().toString(36).slice(2, 8);
    const snapshotId = `state-${formatTimestamp(ts)}-${uniqueSuffix}.json`;

    const payload = JSON.stringify(timestamped);

    const publicState = shadowPublication.enabled
      ? toPublicRaffleState(timestamped)
      : null;
    const publicationId = publicState ? randomUUID() : null;
    const publicChecksum = publicState
      ? await hashPublicState(publicState)
      : null;
    const publicPayload = publicState ? JSON.stringify(publicState) : null;

    const transactionResults = (await withTimeout(
      sql.transaction((tx) => {
        const statements = [];
        if (options?.closeout) {
          const closeout = options.closeout;
          const facts = JSON.stringify(closeout.facts);
          statements.push(tx`
            insert into raffle_session_summaries (
              summary_id, session_id, revision, supersedes_summary_id,
              content_hash, service_date, closed_at, recorded_at, payload
            ) values (
              ${closeout.summaryId}, ${closeout.sessionId}, ${closeout.revision},
              ${closeout.supersedesSummaryId}, ${closeout.contentHash},
              ${closeout.facts.serviceDate}, ${closeout.closedAt},
              ${closeout.recordedAt}, ${facts}::jsonb
            )
            on conflict (session_id, content_hash) do nothing;
          `);
        }
        if (!options?.skipBackup) {
          statements.push(tx`
          insert into raffle_snapshots (id, payload)
          values (${snapshotId}, ${payload}::jsonb)
          on conflict (id) do nothing;
        `);
        }
        if (
          shadowPublication.enabled &&
          publicationId &&
          publicChecksum &&
          publicPayload
        ) {
          statements.push(tx`
            with committed as (
              insert into raffle_state (id, payload, revision, updated_at)
              values ('singleton', ${payload}::jsonb, 1, now())
              on conflict (id) do update set
                payload = excluded.payload,
                revision = raffle_state.revision + 1,
                updated_at = excluded.updated_at
              returning revision, updated_at
            ), superseded as (
              update raffle_public_state_publications
              set status = 'superseded', updated_at = now()
              where status in ('pending', 'failed')
                and revision < (select revision from committed)
              returning publication_id
            )
            insert into raffle_public_state_publications (
              publication_id, revision, protocol_version, checksum, payload,
              status, committed_at, created_at, updated_at
            )
            select
              ${publicationId}, committed.revision, 1, ${publicChecksum},
              ${publicPayload}::jsonb, 'pending', committed.updated_at, now(), now()
            from committed
            returning revision, committed_at;
          `);
        } else {
          statements.push(tx`
            insert into raffle_state (id, payload, revision, updated_at)
            values ('singleton', ${payload}::jsonb, 1, now())
            on conflict (id) do update set
              payload = excluded.payload,
              revision = raffle_state.revision + 1,
              updated_at = excluded.updated_at
            returning revision, updated_at as committed_at;
          `);
        }
        return statements;
      }),
    )) as Array<Array<{ revision: number | string; committed_at: string | Date }>>;

    const commitRow = transactionResults.at(-1)?.[0];
    const revision = Number(commitRow?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1 || !commitRow?.committed_at) {
      throw new Error("State transaction did not return a valid revision.");
    }

    if (
      shadowPublication.enabled &&
      publicationId &&
      publicChecksum &&
      publicState
    ) {
      const intent: ShadowPublicationIntent = {
        publicationId,
        revision,
        committedAt: new Date(commitRow.committed_at).toISOString(),
        checksum: publicChecksum,
        state: publicState,
      };

      await attemptShadowPublication(intent);
    }

    return { state: timestamped, revision };
  };

  const persist = async (
    state: RaffleState,
    options?: {
      preserveTimestamp?: boolean;
      skipBackup?: boolean;
      closeout?: StoredQueueSessionSummary | null;
    },
  ): Promise<RaffleState> => (await persistVersioned(state, options)).state;

  const safeReadStateWithRevision = async (): Promise<{
    state: RaffleState;
    revision: number;
  }> => {
    const rows = (await withTimeout(sql`
      select payload, revision from raffle_state where id = 'singleton' limit 1;
    `)) as Array<{ payload: RaffleState; revision: number | string }>;
    if (rows.length === 0) {
      return persistVersioned(defaultState);
    }
    const payload = rows[0]?.payload ?? defaultState;
    const revision = Number(rows[0]?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) {
      throw new Error("Stored state revision is invalid.");
    }
    return {
      state: {
        ...defaultState,
        ...payload,
        timestamp: payload.timestamp ?? Date.now(),
      },
      revision,
    };
  };

  const safeReadState = async (): Promise<RaffleState> =>
    (await safeReadStateWithRevision()).state;
  const loadState = async () => safeReadState();
  const loadStateWithRevision = async () => safeReadStateWithRevision();

  const generateState = async (input: {
    startNumber: number;
    endNumber: number;
    mode: Mode;
  }) => {
    const current = await safeReadState();

    if (current.orderLocked) {
      throw new UserInputError(
        "Order is locked. Cannot regenerate—this would change all client positions. Use Reset to start a new lottery.",
      );
    }

    validateRange(input.startNumber, input.endNumber, { requireStrictEnd: true });
    const generatedOrder = generateOrder(input.startNumber, input.endNumber, input.mode);
    const issuedAt = Date.now();
    return persist(addIssuedTickets({
      startNumber: input.startNumber,
      endNumber: input.endNumber,
      mode: input.mode,
      generatedOrder,
      currentlyServing: null,
      ticketStatus: {},
      calledAt: {},
      orderLocked: true,
      timestamp: null,
      displayUrl: current.displayUrl ?? null,
      operatingHours: current.operatingHours ?? defaultState.operatingHours,
      timezone: current.timezone ?? defaultState.timezone,
      displayLanguageRotation: current.displayLanguageRotation ?? null,
      announcement: current.announcement ?? null,
      queueSession: null,
    }, generatedOrder, "full", issuedAt));
  };

  const appendTickets = async (newEndNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);
    validateNewEndNumber(newEndNumber);

    if (newEndNumber <= current.endNumber) {
      throw new UserInputError(
        `The end number is currently ${current.endNumber}. Please choose a number greater than ${current.endNumber}.`,
      );
    }

    const undrawnCount = countUndrawnTickets(current);
    if (undrawnCount > 0) {
      throw new UserInputError(
        `All tickets in the current range must be drawn before appending. ${undrawnCount} ticket${
          undrawnCount === 1 ? " remains" : "s remain"
        } undrawn. Use Generate batch to finish the current range first.`,
      );
    }

    const additions = buildRange(current.endNumber + 1, newEndNumber);
    const newBatch = current.mode === "random" ? shuffle(additions) : additions;
    const generatedOrder = [...current.generatedOrder, ...newBatch];

    const issuedAt = Date.now();
    return persist(addIssuedTickets({
      ...current,
      endNumber: newEndNumber,
      generatedOrder,
    }, newBatch, "append", issuedAt));
  };

  const extendRange = async (newEndNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);
    validateNewEndNumber(newEndNumber);
    if (newEndNumber <= current.endNumber) {
      throw new UserInputError(
        `The end number is currently ${current.endNumber}. Please choose a number greater than ${current.endNumber}.`,
      );
    }
    return persist({
      ...current,
      endNumber: newEndNumber,
    });
  };

  const generateBatch = async (input: {
    startNumber: number;
    endNumber: number;
    batchSize: number;
  }) => {
    const current = await safeReadState();
    const { batchSize } = input;

    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new UserInputError("Batch size must be a positive integer.");
    }

    // Determine effective range: use current if set, otherwise set from input
    const hasRange = current.startNumber !== 0 || current.endNumber !== 0;
    let effectiveStart = current.startNumber;
    let effectiveEnd = current.endNumber;

    if (!hasRange) {
      validateRange(input.startNumber, input.endNumber, { requireStrictEnd: true });
      effectiveStart = input.startNumber;
      effectiveEnd = input.endNumber;
    } else {
      if (input.startNumber !== current.startNumber) {
        throw new UserInputError(
          `Start number is locked at ${current.startNumber} after the first draw. Reset to start a new range.`,
        );
      }
      validateNewEndNumber(input.endNumber);
      if (input.endNumber < current.endNumber) {
        throw new UserInputError(
          `The end number is currently ${current.endNumber}. Please choose a number greater than ${current.endNumber}.`,
        );
      }
      effectiveStart = current.startNumber;
      effectiveEnd = input.endNumber;
    }

    // Compute undrawn pool: tickets in range NOT already in generatedOrder
    const drawn = new Set(current.generatedOrder);
    const pool = buildRange(effectiveStart, effectiveEnd).filter(
      (ticket) => !drawn.has(ticket),
    );

    if (pool.length === 0) {
      throw new UserInputError("All tickets in the range have already been drawn.");
    }

    if (batchSize > pool.length) {
      throw new UserInputError(
        `Batch size (${batchSize}) exceeds remaining undrawn tickets (${pool.length}).`,
      );
    }

    // Random: shuffle pool and take first N. Sequential: take lowest N.
    const selected =
      current.mode === "random"
        ? shuffle(pool).slice(0, batchSize)
        : pool.slice(0, batchSize);

    const issuedAt = Date.now();
    return persist(addIssuedTickets({
      ...current,
      startNumber: effectiveStart,
      endNumber: effectiveEnd,
      generatedOrder: [...current.generatedOrder, ...selected],
      orderLocked: true,
    }, selected, "batch", issuedAt));
  };

  const setMode = async (mode: Mode) => {
    const current = await safeReadState();
    const hasRange = current.startNumber !== 0 || current.endNumber !== 0;

    if (!hasRange) {
      return persist({ ...current, mode });
    }

    const hasOrder = current.generatedOrder.length > 0;

    if (!hasOrder) {
      const generatedOrder = generateOrder(current.startNumber, current.endNumber, mode);
      const issuedAt = Date.now();
      return persist(addIssuedTickets({
        ...current,
        mode,
        generatedOrder,
      }, generatedOrder, "full", issuedAt));
    }

    return persist(recordModeTransition({
      ...current,
      mode,
    }, current.mode, mode));
  };

  const updateCurrentlyServing = async (value: number | null) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (value !== null && (value < current.startNumber || value > current.endNumber)) {
      throw new Error("Currently serving must be within the active range.");
    }

    const nextCalledAt = { ...(current.calledAt ?? {}) } as RaffleState["calledAt"];
    const calledAt = Date.now();
    if (value !== null) {
      nextCalledAt[value] = calledAt;
    }

    const nextState = {
      ...current,
      currentlyServing: value,
      calledAt: nextCalledAt,
    };
    return persist(value === null ? nextState : recordFirstCall(nextState, value, calledAt));
  };

  const advanceServing = async (direction: "next" | "prev") => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (current.generatedOrder.length === 0) {
      throw new Error("Generate tickets first.");
    }

    const order = current.generatedOrder;
    const status = current.ticketStatus ?? {};
    const currentIndex =
      current.currentlyServing !== null ? order.indexOf(current.currentlyServing) : -1;
    const step = direction === "next" ? 1 : -1;
    const startIndex = currentIndex === -1 ? -1 : currentIndex;

    const findNextIndex = (start: number, stepValue: number) => {
      for (let i = start + stepValue; i >= 0 && i < order.length; i += stepValue) {
        const ticketNumber = order[i];
        if (status[ticketNumber] !== "returned") {
          return i;
        }
      }
      return -1;
    };

    const nextIndex =
      direction === "prev" && currentIndex === -1
        ? findNextIndex(-1, 1)
        : findNextIndex(startIndex, step);

    if (nextIndex === -1) {
      return current;
    }

    const nextTicket = order[nextIndex];
    if (nextTicket === current.currentlyServing) {
      return current;
    }

    const nextCalledAt = { ...(current.calledAt ?? {}) } as RaffleState["calledAt"];
    const calledAt = Date.now();
    nextCalledAt[nextTicket] = calledAt;

    return persist(recordFirstCall({
      ...current,
      currentlyServing: nextTicket,
      calledAt: nextCalledAt,
    }, nextTicket, calledAt));
  };

  const markTicketReturned = async (ticketNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
      throw new Error("Ticket number must be a positive integer.");
    }
    if (ticketNumber < current.startNumber || ticketNumber > current.endNumber) {
      throw new Error("Ticket number must be within the active range.");
    }
    if (current.generatedOrder.length === 0) {
      throw new Error("Generate tickets first.");
    }

    const nextStatus = {
      ...(current.ticketStatus ?? {}),
      [ticketNumber]: "returned",
    } as RaffleState["ticketStatus"];
    let nextServing = current.currentlyServing;
    const nextCalledAt = { ...(current.calledAt ?? {}) } as RaffleState["calledAt"];
    let autoCalledAt: number | null = null;
    if (ticketNumber === current.currentlyServing) {
      const currentIndex = current.generatedOrder.indexOf(ticketNumber);
      if (currentIndex !== -1) {
        nextServing = null;
        for (let i = currentIndex + 1; i < current.generatedOrder.length; i += 1) {
          const nextTicket = current.generatedOrder[i];
          if (nextStatus[nextTicket] !== "returned") {
            nextServing = nextTicket;
            autoCalledAt = Date.now();
            nextCalledAt[nextTicket] = autoCalledAt;
            break;
          }
        }
      }
    }

    const nextState = {
      ...current,
      ticketStatus: nextStatus,
      currentlyServing: nextServing,
      calledAt: nextCalledAt,
    };
    return persist(
      nextServing !== null && autoCalledAt !== null
        ? recordFirstCall(nextState, nextServing, autoCalledAt)
        : nextState,
    );
  };

  const markTicketUnclaimed = async (ticketNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
      throw new Error("Ticket number must be a positive integer.");
    }
    if (ticketNumber < current.startNumber || ticketNumber > current.endNumber) {
      throw new Error("Ticket number must be within the active range.");
    }
    if (current.generatedOrder.length === 0) {
      throw new Error("Generate tickets first.");
    }

    const currentIndex =
      current.currentlyServing !== null
        ? current.generatedOrder.indexOf(current.currentlyServing)
        : -1;
    if (currentIndex === -1) {
      throw new Error("No draw position has been called yet.");
    }

    const ticketIndex = current.generatedOrder.indexOf(ticketNumber);
    if (ticketIndex === -1) {
      throw new Error("Ticket number is not in the current order.");
    }
    if (ticketIndex > currentIndex) {
      throw new Error("Ticket must be called before it can be marked unclaimed.");
    }

    const nextStatus = {
      ...(current.ticketStatus ?? {}),
      [ticketNumber]: "unclaimed",
    } as RaffleState["ticketStatus"];

    return persist({
      ...current,
      ticketStatus: nextStatus,
    });
  };

  const revertTicketStatus = async (ticketNumber: number) => {
    const current = await safeReadState();
    ensureHasRange(current);

    if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
      throw new Error("Ticket number must be a positive integer.");
    }
    if (ticketNumber < current.startNumber || ticketNumber > current.endNumber) {
      throw new Error("Ticket number must be within the active range.");
    }

    const currentStatus = current.ticketStatus?.[ticketNumber];
    if (currentStatus !== "returned" && currentStatus !== "unclaimed") {
      // Nothing to revert — leave state unchanged (idempotent, race-safe).
      return current;
    }

    const nextStatus = { ...(current.ticketStatus ?? {}) } as RaffleState["ticketStatus"];
    delete nextStatus[ticketNumber];

    // Clearing the flag only restores the ticket's "not called" state; it does
    // not rewind currentlyServing/calledAt (which advanced when it was marked).
    return persist({
      ...current,
      ticketStatus: nextStatus,
    });
  };

  const resetState = async () => {
    const current = await safeReadState();
    const closedAt = Date.now();
    const sessionId = current.queueSession?.sessionId;
    const prior = sessionId
      ? await listQueueSummariesForSession(sessionId)
      : [];
    const closeout = createStoredQueueSessionSummary(current, closedAt, prior);
    cleanupOldSnapshots(30).catch((error) => {
      console.warn("[State] Snapshot cleanup failed:", error);
    });
    return persist({
      ...defaultState,
      ticketStatus: {},
      calledAt: {},
      operatingHours: current.operatingHours ?? defaultState.operatingHours,
      timezone: current.timezone ?? defaultState.timezone,
      displayLanguageRotation: current.displayLanguageRotation ?? null,
      announcement: current.announcement ?? null,
      queueSession: null,
    }, { closeout });
  };

  const mapQueueSummaryRow = (row: {
    summary_id: string;
    session_id: string;
    revision: number;
    supersedes_summary_id: string | null;
    content_hash: string;
    closed_at: string;
    recorded_at: string;
    payload: StoredQueueSessionSummary["facts"];
  }): StoredQueueSessionSummary => ({
    summaryId: row.summary_id,
    sessionId: row.session_id,
    revision: row.revision,
    supersedesSummaryId: row.supersedes_summary_id,
    contentHash: row.content_hash,
    closedAt: new Date(row.closed_at).toISOString(),
    recordedAt: new Date(row.recorded_at).toISOString(),
    facts: row.payload,
  });

  async function listQueueSummariesForSession(sessionId: string) {
    const rows = (await withTimeout(sql`
      select summary_id, session_id, revision, supersedes_summary_id,
             content_hash, closed_at, recorded_at, payload
      from raffle_session_summaries
      where session_id = ${sessionId}
      order by revision asc;
    `)) as Parameters<typeof mapQueueSummaryRow>[0][];
    return rows.map(mapQueueSummaryRow);
  }

  const listQueueSummaries = async () => {
    const rows = (await withTimeout(sql`
      select summary_id, session_id, revision, supersedes_summary_id,
             content_hash, closed_at, recorded_at, payload
      from raffle_session_summaries
      order by recorded_at asc, summary_id asc;
    `)) as Parameters<typeof mapQueueSummaryRow>[0][];
    return rows.map(mapQueueSummaryRow);
  };

  const listSnapshots = async () => {
    const rows = (await withTimeout(sql`
      select id, created_at from raffle_snapshots order by created_at desc, id desc;
    `)) as Array<{ id: string; created_at: string }>;
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      path: row.id,
    }));
  };

  const restoreSnapshot = async (id: string) => {
    const rows = (await withTimeout(sql`
      select payload from raffle_snapshots where id = ${id} limit 1;
    `)) as Array<{ payload: RaffleState }>;
    const snapshot = rows[0];
    if (!snapshot) {
      throw new Error("Snapshot not found.");
    }
    return persist(snapshot.payload, { preserveTimestamp: true });
  };

  const cleanupOldSnapshots = async (retentionDays = 30) => {
    const rows = (await withTimeout(sql`
      delete from raffle_snapshots
      where created_at < now() - make_interval(days => ${retentionDays})
      returning id;
    `)) as Array<{ id: string }>;
    return rows.length;
  };

  const retryLatestRealtimePublication = async () => {
    if (!shadowPublication.enabled) {
      return { enabled: false as const, attempted: false as const };
    }

    const rows = (await withTimeout(sql`
      select publication_id, revision, checksum, payload, committed_at
      from raffle_public_state_publications
      where status in ('pending', 'failed')
      order by revision desc
      limit 1;
    `)) as Array<{
      publication_id: string;
      revision: number | string;
      checksum: string;
      payload: unknown;
      committed_at: string | Date;
    }>;
    const row = rows[0];
    if (!row) {
      return { enabled: true as const, attempted: false as const };
    }

    const revision = Number(row.revision);
    const parsedState = publicRaffleStateSchema.safeParse(row.payload);
    const committedAt = new Date(row.committed_at);
    let validationError: string | null = null;
    let state: PublicRaffleState | null = null;

    if (!Number.isSafeInteger(revision) || revision < 1) {
      validationError = "Stored realtime revision is invalid.";
    } else if (Number.isNaN(committedAt.getTime())) {
      validationError = "Stored realtime commit timestamp is invalid.";
    } else if (!parsedState.success) {
      validationError = "Stored public-state payload is invalid.";
    } else {
      state = parsedState.data;
      const calculatedChecksum = await hashPublicState(state);
      if (calculatedChecksum !== row.checksum) {
        validationError = "Stored public-state checksum mismatch.";
      }
    }

    if (validationError || !state) {
      const outcome: ShadowPublicationOutcome = {
        accepted: false,
        error: validationError ?? "Stored public-state publication is invalid.",
      };
      await recordShadowPublicationOutcome(row.publication_id, revision, outcome);
      console.warn(
        `[Realtime] Repair rejected invalid publication evidence for revision ${revision}.`,
      );
      return {
        enabled: true as const,
        attempted: true as const,
        revision,
        accepted: false as const,
        error: outcome.error,
      };
    }

    const outcome = await attemptShadowPublication({
      publicationId: row.publication_id,
      revision,
      checksum: row.checksum,
      committedAt: committedAt.toISOString(),
      state,
    });
    return {
      enabled: true as const,
      attempted: true as const,
      revision,
      accepted: outcome.accepted,
      ...(outcome.accepted ? {} : { error: outcome.error }),
    };
  };

  const getRealtimePublicationStatus = async () => {
    if (!shadowPublication.enabled) {
      return { enabled: false as const };
    }

    const rows = (await withTimeout(sql`
      select publication_id, revision, status, attempt_count, committed_at,
             last_attempt_at, accepted_at, last_error, updated_at
      from raffle_public_state_publications
      order by revision desc
      limit 1;
    `)) as Array<{
      publication_id: string;
      revision: number | string;
      status: "pending" | "accepted" | "failed" | "superseded";
      attempt_count: number | string;
      committed_at: string | Date;
      last_attempt_at: string | Date | null;
      accepted_at: string | Date | null;
      last_error: string | null;
      updated_at: string | Date;
    }>;
    const row = rows[0];
    if (!row) {
      return { enabled: true as const, latest: null };
    }

    return {
      enabled: true as const,
      latest: {
        publicationId: row.publication_id,
        revision: Number(row.revision),
        status: row.status,
        attemptCount: Number(row.attempt_count),
        committedAt: new Date(row.committed_at).toISOString(),
        lastAttemptAt: row.last_attempt_at
          ? new Date(row.last_attempt_at).toISOString()
          : null,
        acceptedAt: row.accepted_at
          ? new Date(row.accepted_at).toISOString()
          : null,
        lastError: row.last_error,
        updatedAt: new Date(row.updated_at).toISOString(),
      },
    };
  };

  const undo = async () => {
    const snapshots = await listSnapshots();
    if (snapshots.length < 2) {
      throw new Error("No history available.");
    }
    lastRedoSnapshot = snapshots[0];
    const previous = snapshots[1];
    if (!previous) {
      throw new Error("No earlier snapshot to undo to.");
    }
    return restoreSnapshot(previous.id);
  };

  const redo = async () => {
    const target = lastRedoSnapshot;
    lastRedoSnapshot = null;
    if (!target) {
      throw new Error("No later snapshot to redo to.");
    }
    return restoreSnapshot(target.id);
  };

  const setDisplayUrl = async (url: string | null) => {
    const current = await safeReadState();
    return persist({ ...current, displayUrl: url });
  };

  const setOperatingHours = async (hours: OperatingHours, timezone: string) => {
    const current = await safeReadState();
    return persist({ ...current, operatingHours: hours, timezone });
  };

  const setDisplayLanguageRotation = async (config: DisplayLanguageRotation | null) => {
    const current = await safeReadState();
    return persist({ ...current, displayLanguageRotation: config });
  };

  const setAnnouncement = async (announcement: Announcement | null) => {
    const current = await safeReadState();
    return persist({ ...current, announcement });
  };

  return {
    loadState,
    loadStateWithRevision,
    generateState,
    generateBatch,
    appendTickets,
    extendRange,
    setMode,
    updateCurrentlyServing,
    advanceServing,
    markTicketReturned,
    markTicketUnclaimed,
    revertTicketStatus,
    resetState,
    listQueueSummaries,
    listSnapshots,
    restoreSnapshot,
    undo,
    redo,
    setDisplayUrl,
    setOperatingHours,
    setDisplayLanguageRotation,
    setAnnouncement,
    cleanupOldSnapshots,
    retryLatestRealtimePublication,
    getRealtimePublicationStatus,
  };
};
