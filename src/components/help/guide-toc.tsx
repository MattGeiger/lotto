// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

"use client";

import * as React from "react";
import { ChevronDown, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { GuideTocItem } from "@/lib/user-guides";

import { GuideTocScrollSpy } from "./guide-toc-scroll-spy";

type GuideTocProps = {
  items: GuideTocItem[];
  variant: "mobile" | "desktop";
  enableScrollSpy?: boolean;
};

function GuideTocLinks({ items }: { items: GuideTocItem[] }) {
  return (
    <ol className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            data-guide-toc-link
            data-heading-id={item.id}
            className={cn(
              "block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-accent-foreground",
              item.depth === 3 && "ml-3 text-xs",
            )}
          >
            {item.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function GuideToc({ items, variant, enableScrollSpy = false }: GuideTocProps) {
  const [open, setOpen] = React.useState(false);

  if (items.length === 0) return null;

  const headingIds = items.map((item) => item.id);

  if (variant === "mobile") {
    return (
      <div className="lg:hidden">
        {enableScrollSpy ? <GuideTocScrollSpy headingIds={headingIds} /> : null}
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          aria-expanded={open}
          haptic="uiToggle"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="inline-flex items-center gap-2">
            <List className="h-4 w-4" aria-hidden="true" />
            On this page
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </Button>
        {open ? (
          <div className="mt-3 rounded-lg border bg-card p-3">
            <nav aria-label="Guide table of contents">
              <GuideTocLinks items={items} />
            </nav>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <aside className="hidden lg:block">
      {enableScrollSpy ? <GuideTocScrollSpy headingIds={headingIds} /> : null}
      {/* Clears the sticky Help banner (`HelpTopBar`, ~5rem tall) with room to
          spare, so the two glass surfaces do not butt against each other. */}
      <div className="sticky top-24 rounded-lg border border-border/70 bg-background/40 p-4 shadow-xl backdrop-blur-[14px] backdrop-saturate-150 supports-[backdrop-filter]:bg-background/40">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <List className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          On this page
        </div>
        <ScrollArea className="h-[calc(100vh-13rem)] pr-3">
          <nav aria-label="Guide table of contents">
            <GuideTocLinks items={items} />
          </nav>
        </ScrollArea>
      </div>
    </aside>
  );
}
