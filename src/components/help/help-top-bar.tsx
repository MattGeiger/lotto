// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelpSearch } from "@/components/help/help-search";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { GuideSearchEntry } from "@/lib/user-guides";

type HelpTopBarProps = {
  /** Where the leading control returns to. */
  backHref: string;
  backLabel: string;
  searchIndex: GuideSearchEntry[];
  /** Optional trailing detail, e.g. a guide's catalog position. */
  meta?: React.ReactNode;
};

/**
 * The persistent Help banner: navigation, search, and the theme control stay
 * on screen while the guide scrolls behind them.
 *
 * This is a server component — `HelpSearch` and `ThemeSwitcher` are the only
 * client parts, exactly as before, so pinning the bar adds nothing to the
 * bundle.
 *
 * The translucent treatment is LOTTO's existing one, lifted verbatim from the
 * desktop table of contents in `guide-toc.tsx`, which in turn matches FEED's
 * sticky analytics banner. Reusing the same utilities keeps one glass recipe in
 * the codebase and carries no new risk on the iPadOS 15 floor, where the
 * `supports-[backdrop-filter]` guard settles what old WebKit gets.
 */
export function HelpTopBar({ backHref, backLabel, searchIndex, meta }: HelpTopBarProps) {
  return (
    <header
      // Full-bleed so the blur runs edge to edge, with the inner row sharing
      // the pages' `max-w-7xl` measure.
      className="sticky top-0 z-40 border-b border-border/70 bg-background/40 backdrop-blur-[14px] backdrop-saturate-150 supports-[backdrop-filter]:bg-background/40"
    >
      {/* Wrapping plus explicit order keeps this to two rows on a phone
          (navigation + controls, then search) and one row from `sm` up, without
          `display: contents`, which is unreliable for assistive technology on
          the iPadOS 15 floor. */}
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3 sm:gap-x-4">
        <Button variant="ghost" size="sm" className="order-1 shrink-0" asChild>
          <Link href={backHref}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        </Button>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-3 sm:order-3 sm:ml-0">
          {meta}
          <ThemeSwitcher enableHaptics />
        </div>

        <HelpSearch
          index={searchIndex}
          className="order-3 w-full sm:order-2 sm:ml-auto sm:w-auto sm:max-w-xl sm:flex-1"
        />
      </div>
    </header>
  );
}
