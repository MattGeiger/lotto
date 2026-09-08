// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { z } from "zod";

import type { RaffleState } from "@/lib/state-types";

export const PUBLIC_STATE_PROTOCOL_VERSION = 1 as const;

const dayScheduleSchema = z
  .object({
    isOpen: z.boolean(),
    openTime: z.string().min(1).max(16),
    closeTime: z.string().min(1).max(16),
  })
  .strict();

const operatingHoursSchema = z
  .object({
    sunday: dayScheduleSchema,
    monday: dayScheduleSchema,
    tuesday: dayScheduleSchema,
    wednesday: dayScheduleSchema,
    thursday: dayScheduleSchema,
    friday: dayScheduleSchema,
    saturday: dayScheduleSchema,
  })
  .strict();

const positiveIntegerKeySchema = z.string().regex(/^[1-9]\d*$/);

/**
 * The intentionally allowlisted state that may leave the trusted application
 * boundary. Internal queue-session evidence is never part of this schema.
 */
export const publicRaffleStateSchema = z
  .object({
    startNumber: z.number().int().nonnegative(),
    endNumber: z.number().int().nonnegative(),
    mode: z.enum(["random", "sequential"]),
    generatedOrder: z.array(z.number().int().positive()).max(100_000),
    currentlyServing: z.number().int().positive().nullable(),
    ticketStatus: z.record(
      positiveIntegerKeySchema,
      z.enum(["returned", "unclaimed"]),
    ),
    calledAt: z.record(
      positiveIntegerKeySchema,
      z.number().int().nonnegative(),
    ),
    orderLocked: z.boolean(),
    timestamp: z.number().int().nonnegative().nullable(),
    displayUrl: z.string().url().max(2_048).nullable(),
    operatingHours: operatingHoursSchema.nullable(),
    timezone: z.string().min(1).max(100),
    displayLanguageRotation: z
      .object({
        enabled: z.boolean(),
        languages: z.array(z.string().min(1).max(32)).min(1).max(100),
        intervalSeconds: z.number().int().min(1).max(86_400),
      })
      .strict()
      .nullable(),
    announcement: z
      .object({
        enabled: z.boolean(),
        markdown: z.string().max(1_800),
        startsAt: z.number().int().nonnegative().nullable(),
        endsAt: z.number().int().nonnegative().nullable(),
        updatedAt: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type PublicRaffleState = z.infer<typeof publicRaffleStateSchema>;

export const agencyIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const publicStateEnvelopeSchema = z
  .object({
    protocolVersion: z.literal(PUBLIC_STATE_PROTOCOL_VERSION),
    agencyId: agencyIdSchema,
    publicationId: z.string().uuid(),
    revision: z.number().int().positive().safe(),
    committedAt: z.string().datetime({ offset: true }),
    publishedAt: z.string().datetime({ offset: true }),
    checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    state: publicRaffleStateSchema,
  })
  .strict();

export type PublicStateEnvelope = z.infer<typeof publicStateEnvelopeSchema>;

export const toPublicRaffleState = (state: RaffleState): PublicRaffleState => {
  const publicState = { ...state };
  delete publicState.queueSession;
  return publicRaffleStateSchema.parse(publicState);
};

export const toRenderableRaffleState = (
  state: PublicRaffleState,
  previous: RaffleState | null,
): RaffleState => ({
  ...state,
  queueSession: previous?.queueSession ?? null,
});

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }
  return value;
};

export const stableStringify = (value: unknown): string =>
  JSON.stringify(canonicalize(value));

export const hashPublicState = async (
  state: PublicRaffleState,
): Promise<string> => {
  const bytes = new TextEncoder().encode(stableStringify(state));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `sha256:${hex}`;
};

type BuildPublicStateEnvelopeInput = {
  agencyId: string;
  revision: number;
  state: RaffleState | PublicRaffleState;
  publicationId?: string;
  committedAt?: string;
  publishedAt?: string;
};

export const buildPublicStateEnvelope = async ({
  agencyId,
  revision,
  state,
  publicationId = crypto.randomUUID(),
  committedAt = new Date().toISOString(),
  publishedAt = new Date().toISOString(),
}: BuildPublicStateEnvelopeInput): Promise<PublicStateEnvelope> => {
  const publicState = toPublicRaffleState(state as RaffleState);
  return publicStateEnvelopeSchema.parse({
    protocolVersion: PUBLIC_STATE_PROTOCOL_VERSION,
    agencyId,
    publicationId,
    revision,
    committedAt,
    publishedAt,
    checksum: await hashPublicState(publicState),
    state: publicState,
  });
};
