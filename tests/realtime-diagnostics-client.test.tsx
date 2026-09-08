// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RealtimeDiagnosticsClient from "@/app/admin/realtime/realtime-diagnostics-client";

const toastInfo = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfo(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const statusResponse = () =>
  new Response(
    JSON.stringify({
      status: {
        enabled: true,
        latest: {
          publicationId: "publication-15",
          revision: 15,
          status: "failed",
          attemptCount: 1,
          committedAt: "2026-09-01T20:00:00.000Z",
          lastAttemptAt: "2026-09-01T20:00:01.000Z",
          acceptedAt: null,
          lastError: "Realtime hub rejected publication (401).",
          updatedAt: "2026-09-01T20:00:01.000Z",
        },
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

describe("RealtimeDiagnosticsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads status once without issuing a recurring request", async () => {
    const fetchMock = vi.fn(async () => statusResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<RealtimeDiagnosticsClient />);

    expect(await screen.findByText("publication-15")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/state/realtime", { cache: "no-store" });
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("runs one repair and then performs one explicit status refresh", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(statusResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            repair: { enabled: true, attempted: true, revision: 15, accepted: true },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(statusResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<RealtimeDiagnosticsClient />);
    expect(await screen.findByText("publication-15")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry newest publication" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/state/realtime",
      { method: "POST" },
    ]);
    expect(toastSuccess).toHaveBeenCalledWith("Latest realtime publication accepted.");
  });
});
