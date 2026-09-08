// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import Link from "next/link";
import { ChevronRight, CircleHelp } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTopBar } from "@/components/help/help-top-bar";
import { BottomTabBar } from "@/components/navigation/bottom-tab-bar";
import { getAllUserGuides, getHelpSearchIndex } from "@/lib/user-guides.server";

export const metadata = {
  title: "Help — LOTTO",
};

export default function HelpIndexPage() {
  const guides = getAllUserGuides();
  const searchIndex = getHelpSearchIndex();

  return (
    <>
      <HelpTopBar backHref="/admin" backLabel="Back" searchIndex={searchIndex} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 pb-28 pt-6 sm:pb-32">
        <div className="flex items-start gap-3">
          <CircleHelp className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Help</h1>
            <p className="max-w-2xl text-muted-foreground">
              Short guides and workflows for running the raffle, display board, inventory, and arcade.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {guides.map((guide) => (
            <Link key={guide.slug} href={`/help/${guide.slug}`} className="group focus:outline-none">
              <Card className="h-full rounded-lg transition-colors hover:border-primary/50 hover:bg-accent/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-2 text-lg">
                    <span>{guide.title}</span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden="true"
                    />
                  </CardTitle>
                  {guide.description ? (
                    <CardDescription className="line-clamp-3">{guide.description}</CardDescription>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
        <BottomTabBar />
      </main>
    </>
  );
}
