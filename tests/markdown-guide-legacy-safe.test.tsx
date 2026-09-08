// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

// Behavioral contract for the shared markdown renderer after dropping
// `remark-gfm` in favor of the legacy-safe `remarkGfmSafe` plugin (no
// autolink-literal). This guards against someone reintroducing `remark-gfm`,
// which bundles a lookbehind regex literal that crashes iOS 15.x WebKit at
// parse time (see docs/BROWSER_SUPPORT.md, docs/ISSUES.md, src/lib/remark-gfm-safe.ts).

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownGuideContent } from "@/components/help/markdown-guide";

describe("MarkdownGuideContent — legacy-safe GFM subset", () => {
  it("renders GFM strikethrough", () => {
    render(<MarkdownGuideContent content={"This is ~~struck~~ text."} />);
    expect(screen.getByText("struck").tagName).toBe("DEL");
  });

  it("renders GFM tables", () => {
    const md = ["| A | B |", "| - | - |", "| 1 | 2 |"].join("\n");
    render(<MarkdownGuideContent content={md} />);
    const table = document.querySelector("table");
    expect(table).not.toBeNull();
    expect(screen.getByText("A").tagName).toBe("TH");
    expect(screen.getByText("1").tagName).toBe("TD");
  });

  it("renders GFM task lists with checkboxes", () => {
    const md = ["- [x] done", "- [ ] todo"].join("\n");
    render(<MarkdownGuideContent content={md} />);
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it("still renders explicit external links (the supported way to link)", () => {
    render(<MarkdownGuideContent content={"[William Temple House](https://williamtemple.org)"} />);
    const link = screen.getByRole("link", { name: "William Temple House" });
    expect(link).toHaveAttribute("href", "https://williamtemple.org");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does NOT autolink a bare URL (autolink-literal intentionally dropped)", () => {
    render(<MarkdownGuideContent content={"Visit https://williamtemple.org for hours."} />);
    // The URL text survives as plain text...
    expect(screen.getByText(/Visit https:\/\/williamtemple\.org for hours\./)).toBeInTheDocument();
    // ...but it must not have been turned into an anchor.
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does NOT autolink a bare email address", () => {
    render(<MarkdownGuideContent content={"Email frontdesk@williamtemple.org to reach us."} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders Help screenshots as automatic light and dark pairs", () => {
    render(<MarkdownGuideContent content={"![Queue controls](/help-screenshots/staff-dashboard.webp)"} />);

    const images = screen.getAllByRole("img", { name: "Queue controls" });
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "/help-screenshots/staff-dashboard.webp");
    expect(images[0]).toHaveClass("dark:hidden");
    expect(images[1]).toHaveAttribute("src", "/help-screenshots/staff-dashboard-dark.webp");
    expect(images[1]).toHaveClass("dark:block");
  });
});
