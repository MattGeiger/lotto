// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HelpIndexPage from "@/app/help/page";
import HelpGuideDetailPage from "@/app/help/[slug]/page";

const guides = vi.hoisted(() => [
  { order: 1, slug: "first", title: "First", description: "First guide", content: "# First" },
  { order: 10, slug: "second", title: "Second", description: "Second guide", content: "# Second" },
]);

vi.mock("@/components/help/help-search", () => ({
  HelpSearch: () => <div data-testid="help-search" />,
}));

vi.mock("@/components/navigation/bottom-tab-bar", () => ({
  BottomTabBar: () => <nav aria-label="Bottom navigation" />,
}));

vi.mock("@/components/help/guide-article", () => ({
  GuideArticle: () => <article />,
}));

vi.mock("@/components/help/guide-toc", () => ({
  GuideToc: () => <nav aria-label="Guide table of contents" />,
}));

// The real control reads ThemeProvider/HapticsProvider context, which the root
// layout supplies in the app but this render does not.
vi.mock("@/components/theme-switcher", () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}));

vi.mock("@/lib/user-guides.server", () => ({
  getAllUserGuides: () => guides,
  getHelpSearchIndex: () => [],
  getUserGuideBySlug: (slug: string) => guides.find((guide) => guide.slug === slug),
  getUserGuideSlugs: () => guides.map((guide) => guide.slug),
}));

describe("Help index navigation", () => {
  it("returns staff to Admin without using the retired Staff route", () => {
    render(<HelpIndexPage />);

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.queryByRole("link", { name: /staff home/i })).not.toBeInTheDocument();
  });

  it("offers the theme control in the index page's top chrome", () => {
    render(<HelpIndexPage />);

    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
  });

  it("shows a guide's catalog position when source order numbers have gaps", async () => {
    render(
      await HelpGuideDetailPage({
        params: Promise.resolve({ slug: "second" }),
      }),
    );

    expect(screen.getByText("Guide 2 of 2")).toBeInTheDocument();
  });

  it("offers the theme control in a guide page's top chrome", async () => {
    render(
      await HelpGuideDetailPage({
        params: Promise.resolve({ slug: "second" }),
      }),
    );

    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
  });
});
