import * as React from "react";
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MorphingText } from "@/components/animate-ui/primitives/texts/morphing";
import { MOTION_TIER_STORAGE_KEY } from "@/lib/motion-tier";

describe("MorphingText hydration", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hydrates cleanly when stored motion tier is full", async () => {
    const serverMarkup = renderToString(
      <MorphingText text="Now Serving" wordWrap="word" />,
    );

    // Simulate a stored preference that appears before client hydration.
    window.localStorage.setItem(MOTION_TIER_STORAGE_KEY, "full");

    container!.innerHTML = serverMarkup;

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await act(async () => {
      root = hydrateRoot(
        container!,
        <MorphingText text="Now Serving" wordWrap="word" />,
      );
      await Promise.resolve();
    });

    const hydrationErrors = consoleErrorSpy.mock.calls
      .map(([firstArg]) => String(firstArg))
      .filter(
        (message) =>
          message.includes("Hydration failed") ||
          message.includes("didn't match"),
      );

    expect(hydrationErrors).toHaveLength(0);
  });
});
