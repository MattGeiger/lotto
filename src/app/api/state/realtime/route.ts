// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

import { NextResponse } from "next/server";

import { isAdminEmailAllowed } from "@/lib/admin-email-policy";
import { auth } from "@/lib/auth";
import { isRealtimeEligibleDeployment } from "@/lib/deployment-environment";
import { stateManager } from "@/lib/state-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RealtimeStateManager = {
  getRealtimePublicationStatus: () => Promise<unknown>;
  retryLatestRealtimePublication: () => Promise<unknown>;
};

const noStoreJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const unavailable = () =>
  noStoreJson(
    {
      error: {
        code: "REALTIME_DIAGNOSTICS_UNAVAILABLE",
        message: "Realtime publication diagnostics are unavailable.",
      },
    },
    404,
  );

const unauthorized = () =>
  noStoreJson(
    {
      error: {
        code: "ADMIN_REQUIRED",
        message: "Sign in with an authorized administrator email to manage realtime publication.",
      },
    },
    403,
  );

const hasAdministratorAuthority = async (): Promise<boolean> => {
  const isLocalDevelopment = process.env.NODE_ENV === "development" && !process.env.VERCEL;
  if (process.env.AUTH_BYPASS === "true" || isLocalDevelopment) return true;
  const session = await auth();
  return Boolean(
    session?.user?.email
      && isAdminEmailAllowed(session.user.email.toLowerCase().trim()),
  );
};

const getRealtimeStateManager = (): RealtimeStateManager | null => {
  const candidate = stateManager as Partial<RealtimeStateManager>;
  if (
    typeof candidate.getRealtimePublicationStatus !== "function"
    || typeof candidate.retryLatestRealtimePublication !== "function"
  ) {
    return null;
  }
  return candidate as RealtimeStateManager;
};

export async function GET() {
  if (!isRealtimeEligibleDeployment()) return unavailable();
  if (!(await hasAdministratorAuthority())) return unauthorized();

  const manager = getRealtimeStateManager();
  if (!manager) return unavailable();

  try {
    return noStoreJson({ status: await manager.getRealtimePublicationStatus() });
  } catch {
    console.error("[Realtime diagnostics] Unable to load publication status.");
    return noStoreJson(
      {
        error: {
          code: "REALTIME_STATUS_FAILED",
          message: "LOTTO could not load realtime publication status. Try again.",
        },
      },
      500,
    );
  }
}

export async function POST() {
  if (!isRealtimeEligibleDeployment()) return unavailable();
  if (!(await hasAdministratorAuthority())) return unauthorized();

  const manager = getRealtimeStateManager();
  if (!manager) return unavailable();

  try {
    return noStoreJson({ repair: await manager.retryLatestRealtimePublication() });
  } catch {
    console.error("[Realtime diagnostics] Unable to retry the latest publication.");
    return noStoreJson(
      {
        error: {
          code: "REALTIME_REPAIR_FAILED",
          message: "LOTTO could not retry the latest realtime publication. Try again.",
        },
      },
      500,
    );
  }
}
