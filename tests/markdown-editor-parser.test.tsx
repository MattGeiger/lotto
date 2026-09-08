// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE.

/*
 * Coverage for the announcement editor's Markdown pipeline
 * (tiptap-markdown -> markdown-it -> linkify-it).
 *
 * This path previously had no tests: `admin-range-locking.test.tsx` mocks the
 * editor out entirely, and `markdown-guide-legacy-safe.test.tsx` exercises the
 * separate *render* pipeline (react-markdown + remarkGfmSafe), not this one.
 *
 * The gap surfaced while resolving the `linkify-it` advisory (quadratic
 * complexity in the `mailto:` validator, fixed in 5.0.2). The lockfile had
 * pinned a stale `markdown-it@14.2.0`, holding `linkify-it` at 5.0.1; a
 * resolution refresh moves to 14.3.0 and 5.0.2 with no override needed. These
 * assertions cover the parse path across that move.
 */

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "@/components/markdown-editor";

/** The rich-text surface. The raw-code textarea shares its aria-label. */
const renderEditor = (value: string) => {
  const { container } = render(
    <MarkdownEditor value={value} onChange={vi.fn()} ariaLabel="Announcement message" />,
  );
  return () => container.querySelector(".ProseMirror") as HTMLElement | null;
};

describe("announcement Markdown pipeline", () => {
  it("opens the formatting section of the combined announcement guide", () => {
    const { container } = render(
      <MarkdownEditor value="" onChange={vi.fn()} ariaLabel="Announcement message" />,
    );

    expect(container.querySelector("a[href='/help/announcements#formatting-announcements']"))
      .not.toBeNull();
  });

  it("parses inline emphasis into rendered nodes", async () => {
    const surface = renderEditor("Pantry closes at **3 PM** today.");
    await waitFor(() => {
      expect(surface()?.querySelector("strong")?.textContent).toBe("3 PM");
    });
  });

  it("renders list structure rather than literal Markdown syntax", async () => {
    const surface = renderEditor("- bring a bag\n- arrive early");
    await waitFor(() => {
      expect(surface()?.querySelectorAll("li").length).toBe(2);
    });
    expect(surface()?.textContent).not.toContain("- bring a bag");
  });

  it("keeps explicit links intact", async () => {
    const surface = renderEditor("See [the schedule](https://example.org/schedule).");
    await waitFor(() => {
      expect(surface()?.querySelector("a")?.getAttribute("href")).toBe(
        "https://example.org/schedule",
      );
    });
  });

  it("bounds the cost of pathological mailto input", async () => {
    // A staff member can paste arbitrary text into the announcement editor, so
    // the cost of a long `mailto:` run is bounded rather than assumed.
    //
    // This is a smoke bound, NOT a regression guard for the linkify-it
    // advisory: it was measured at ~30ms on both 5.0.1 and 5.0.2, so it does
    // not distinguish the vulnerable version. Do not read a pass here as
    // evidence that the advisory is fixed — check the resolved version.
    const hostile = `mailto:${"a".repeat(20000)}`;
    const started = Date.now();
    const surface = renderEditor(hostile);
    await waitFor(() => {
      expect(surface()).not.toBeNull();
    });
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
