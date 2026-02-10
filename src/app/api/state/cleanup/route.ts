import { NextResponse } from "next/server";
import { z } from "zod";

import { stateManager } from "@/lib/state-manager";

export const runtime = "nodejs";

const cleanupSchema = z.object({
  retentionDays: z.number().int().min(1).max(365).optional().default(30),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = cleanupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid retention days" }, { status: 400 });
    }

  if ("cleanupOldSnapshots" in stateManager) {
    const manager = stateManager as typeof stateManager & {
      cleanupOldSnapshots?: (days?: number) => Promise<number>;
    };
    if (typeof manager.cleanupOldSnapshots === "function") {
      const deleted = await manager.cleanupOldSnapshots(parsed.data.retentionDays);
      return NextResponse.json({
        success: true,
        deletedCount: deleted,
        retentionDays: parsed.data.retentionDays,
        message: `Deleted ${deleted} snapshots older than ${parsed.data.retentionDays} days`,
      });
    }
    return NextResponse.json({
      success: false,
      message: "Cleanup not available in file storage mode",
    }, { status: 400 });
  }

  return NextResponse.json(
    { success: false, message: "Cleanup not available in file storage mode" },
    { status: 400 },
  );
  } catch (error) {
    console.error("[State] Cleanup failed:", error);
    return NextResponse.json(
      { error: "Cleanup failed. Please try again." },
      { status: 500 },
    );
  }
}
