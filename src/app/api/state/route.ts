import { NextResponse } from "next/server";
import { z } from "zod";

import { stateManager, type Mode } from "@/lib/state-manager";

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
    action: z.literal("setMode"),
    mode: z.custom<Mode>((value) => value === "random" || value === "sequential"),
  }),
  z.object({
    action: z.literal("updateServing"),
    currentlyServing: z.number().int().positive().nullable(),
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
    url: z.string().max(64).url().nullable(),
  }),
  z.object({
    action: z.literal("getDisplayUrl"),
  }),
]);

export async function GET() {
  try {
    const state = await stateManager.loadState();
    return NextResponse.json(state, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load state", details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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
      case "setMode":
        return NextResponse.json(await stateManager.setMode(payload.mode));
      case "updateServing":
        return NextResponse.json(
          await stateManager.updateCurrentlyServing(payload.currentlyServing),
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
      default:
        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to process request", details: String(error) },
      { status: 500 },
    );
  }
}
