// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RealtimeCanaryMount from "@/components/realtime-canary-mount";
import { defaultState } from "@/lib/state-types";

vi.mock("@/components/realtime-canary-observer", () => ({
  default: ({ polledRevision }: { polledRevision: number | null }) => (
    <div data-testid="mounted-realtime-observer" data-revision={polledRevision ?? undefined} />
  ),
}));

vi.mock("@/components/realtime-source-canary", () => ({
  default: ({ polledRevision }: { polledRevision: number | null }) => (
    <div data-testid="mounted-realtime-source" data-revision={polledRevision ?? undefined} />
  ),
}));

const config = {
  agencyId: "william-temple-house",
  eventsUrl:
    "wss://lotto-realtime-beta.et2-geiger.workers.dev/v1/agencies/william-temple-house/events",
};

describe("RealtimeCanaryMount", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("loads the observer only for the exact opted-in browser URL", async () => {
    window.history.replaceState({}, "", "/inventory?realtime=observe");
    render(
      <RealtimeCanaryMount
        config={config}
        polledState={structuredClone(defaultState)}
        polledRevision={16}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("mounted-realtime-observer")).toHaveAttribute(
        "data-revision",
        "16",
      );
    });
  });

  it("loads the source by default on an ordinary URL", async () => {
    const callbacks = {
      onSourceState: vi.fn(),
      onSourceAuthorityChange: vi.fn(),
    };
    render(
      <RealtimeCanaryMount
        config={config}
        sourceConfig={config}
        polledState={structuredClone(defaultState)}
        polledRevision={16}
        {...callbacks}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("mounted-realtime-source")).toHaveAttribute(
        "data-revision",
        "16",
      );
    });
  });

  it("keeps the explicit polling control free of realtime sockets", async () => {
    window.history.replaceState({}, "", "/?realtime=poll");
    render(
      <RealtimeCanaryMount
        config={config}
        sourceConfig={config}
        polledState={structuredClone(defaultState)}
        polledRevision={16}
        onSourceState={vi.fn()}
        onSourceAuthorityChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId("mounted-realtime-source")).not.toBeInTheDocument();
      expect(screen.queryByTestId("mounted-realtime-observer")).not.toBeInTheDocument();
    });
  });

  it("retains the explicit source alias plus independent server configuration", async () => {
    window.history.replaceState({}, "", "/display?realtime=source");
    const callbacks = {
      onSourceState: vi.fn(),
      onSourceAuthorityChange: vi.fn(),
    };
    const { rerender } = render(
      <RealtimeCanaryMount
        config={config}
        sourceConfig={config}
        polledState={structuredClone(defaultState)}
        polledRevision={21}
        {...callbacks}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("mounted-realtime-source")).toHaveAttribute(
        "data-revision",
        "21",
      );
    });
    expect(screen.queryByTestId("mounted-realtime-observer")).not.toBeInTheDocument();

    rerender(
      <RealtimeCanaryMount
        config={config}
        sourceConfig={null}
        polledState={structuredClone(defaultState)}
        polledRevision={21}
        {...callbacks}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId("mounted-realtime-source")).not.toBeInTheDocument();
    });
  });

  it("does not load an unavailable mode or an unknown realtime query value", async () => {
    window.history.replaceState({}, "", "/?realtime=unexpected");
    const { rerender } = render(
      <RealtimeCanaryMount
        config={config}
        sourceConfig={config}
        polledState={structuredClone(defaultState)}
        polledRevision={16}
        onSourceState={vi.fn()}
        onSourceAuthorityChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId("mounted-realtime-source")).not.toBeInTheDocument();
    });

    window.history.replaceState({}, "", "/?realtime=observe");
    rerender(
      <RealtimeCanaryMount
        config={null}
        sourceConfig={null}
        polledState={structuredClone(defaultState)}
        polledRevision={16}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId("mounted-realtime-observer")).not.toBeInTheDocument();
    });
  });
});
