import { NextResponse } from "next/server";
import { z } from "zod";

import { stateManager, type Mode, type OperatingHours } from "@/lib/state-manager";

export const runtime = "nodejs";

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

const dayScheduleSchema = z.object({
  isOpen: z.boolean(),
  openTime: z.string(),
  closeTime: z.string(),
});

const operatingHoursSchema = z.object({
  sunday: dayScheduleSchema,
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
});

const httpUrlSchema = z
  .string()
  .max(64)
  .url()
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "URL must use https:// or http:// scheme" },
  );

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    startNumber: z.number().int().positive(),
    endNumber: z.number().int().positive(),
    mode: z.custom<Mode>((value) => value === "random" || value === "sequential"),
  }),
  z.object({
    action: z.literal("append"),
    endNumber: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("generateBatch"),
    startNumber: z.number().int().positive(),
    endNumber: z.number().int().positive(),
    batchSize: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("setMode"),
    mode: z.custom<Mode>((value) => value === "random" || value === "sequential"),
  }),
  z.object({
    action: z.literal("updateServing"),
    currentlyServing: z.number().int().positive().nullable(),
  }),
  z.object({
    action: z.literal("advanceServing"),
    direction: z.enum(["next", "prev"]),
  }),
  z.object({
    action: z.literal("markReturned"),
    ticketNumber: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("markUnclaimed"),
    ticketNumber: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("reset"),
  }),
  z.object({
    action: z.literal("listSnapshots"),
  }),
  z.object({
    action: z.literal("restoreSnapshot"),
    id: z.string(),
  }),
  z.object({
    action: z.literal("undo"),
  }),
  z.object({
    action: z.literal("redo"),
  }),
  z.object({
    action: z.literal("setDisplayUrl"),
    url: httpUrlSchema.nullable(),
  }),
  z.object({
    action: z.literal("getDisplayUrl"),
  }),
  z.object({
    action: z.literal("setOperatingHours"),
    hours: operatingHoursSchema,
    timezone: z.string().min(1).refine(
      (value) => VALID_TIMEZONES.has(value) || value === "UTC",
      { message: "Must be a valid IANA timezone identifier" },
    ),
  }),
]);

// --- Rate limiting ---

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

const requestLog: number[] = [];

const isRateLimited = () => {
  const now = Date.now();
  // Prune entries older than the window
  while (requestLog.length > 0 && requestLog[0] < now - RATE_LIMIT_WINDOW_MS) {
    requestLog.shift();
  }
  if (requestLog.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  requestLog.push(now);
  return false;
};

// --- Handlers ---

export async function GET() {
  try {
    const state = await stateManager.loadState();
    return NextResponse.json(state, { status: 200 });
  } catch (error) {
    console.error("[State] GET failed:", error);
    return NextResponse.json(
      { error: "Unable to load state. Please try again shortly." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (isRateLimited()) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 },
    );
  }

  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    switch (payload.action) {
      case "generate":
        return NextResponse.json(
          await stateManager.generateState({
            startNumber: payload.startNumber,
            endNumber: payload.endNumber,
            mode: payload.mode,
          }),
        );
      case "append":
        return NextResponse.json(await stateManager.appendTickets(payload.endNumber));
      case "generateBatch":
        return NextResponse.json(
          await stateManager.generateBatch({
            startNumber: payload.startNumber,
            endNumber: payload.endNumber,
            batchSize: payload.batchSize,
          }),
        );
      case "setMode":
        return NextResponse.json(await stateManager.setMode(payload.mode));
      case "updateServing":
        return NextResponse.json(
          await stateManager.updateCurrentlyServing(payload.currentlyServing),
        );
      case "advanceServing":
        return NextResponse.json(
          await stateManager.advanceServing(payload.direction),
        );
      case "markReturned":
        return NextResponse.json(
          await stateManager.markTicketReturned(payload.ticketNumber),
        );
      case "markUnclaimed":
        return NextResponse.json(
          await stateManager.markTicketUnclaimed(payload.ticketNumber),
        );
      case "reset":
        return NextResponse.json(await stateManager.resetState());
      case "listSnapshots":
        return NextResponse.json(await stateManager.listSnapshots());
      case "restoreSnapshot":
        return NextResponse.json(await stateManager.restoreSnapshot(payload.id));
      case "undo":
        return NextResponse.json(await stateManager.undo());
      case "redo":
        return NextResponse.json(await stateManager.redo());
      case "setDisplayUrl":
        return NextResponse.json(await stateManager.setDisplayUrl(payload.url));
      case "getDisplayUrl": {
        const state = await stateManager.loadState();
        return NextResponse.json({ displayUrl: state.displayUrl || null });
      }
      case "setOperatingHours":
        return NextResponse.json(await stateManager.setOperatingHours(payload.hours, payload.timezone));
      default:
        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[State] POST failed:", error);
    return NextResponse.json(
      { error: "Unable to process request. Please try again." },
      { status: 500 },
    );
  }
}
