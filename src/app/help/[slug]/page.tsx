// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GuideArticle } from "@/components/help/guide-article";
import { GuideToc } from "@/components/help/guide-toc";
import { HelpTopBar } from "@/components/help/help-top-bar";
import { BottomTabBar } from "@/components/navigation/bottom-tab-bar";
import { getGuideToc } from "@/lib/user-guides";
import {
  getAllUserGuides,
  getHelpSearchIndex,
  getUserGuideBySlug,
  getUserGuideSlugs,
} from "@/lib/user-guides.server";

export function generateStaticParams() {
  return getUserGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getUserGuideBySlug(slug);
  return { title: guide ? `${guide.title} — Help — LOTTO` : "Help — LOTTO" };
}

export default async function HelpGuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getUserGuideBySlug(slug);
  if (!guide) notFound();

  const guides = getAllUserGuides();
  const searchIndex = getHelpSearchIndex();
  const toc = getGuideToc(guide.content);
  const index = guides.findIndex((entry) => entry.slug === guide.slug);
  const previous = index > 0 ? guides[index - 1] : null;
  const next = index >= 0 && index < guides.length - 1 ? guides[index + 1] : null;

  return (
    <>
      <HelpTopBar
        backHref="/help"
        backLabel="All guides"
        searchIndex={searchIndex}
        meta={
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            Guide {index + 1} of {guides.length}
          </span>
        }
      />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 pb-28 pt-6 sm:pb-32">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-4">
            <GuideToc items={toc} variant="mobile" enableScrollSpy />
            <GuideArticle content={guide.content} />
          </div>
          <GuideToc items={toc} variant="desktop" enableScrollSpy />
        </div>

        <nav
          aria-label="Guide navigation"
          className="mt-4 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-stretch sm:justify-between"
        >
          {previous ? (
            <Button variant="outline" className="h-auto justify-start py-3 sm:max-w-sm" asChild>
              <Link href={`/help/${previous.slug}`}>
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex flex-col items-start gap-0.5 text-left">
                  <span className="text-xs text-muted-foreground">Previous</span>
                  <span className="font-medium">{previous.title}</span>
                </span>
              </Link>
            </Button>
          ) : (
            <span aria-hidden="true" className="hidden sm:block sm:max-w-sm sm:flex-1" />
          )}
          {next ? (
            <Button variant="outline" className="h-auto justify-end py-3 sm:max-w-sm" asChild>
              <Link href={`/help/${next.slug}`}>
                <span className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-xs text-muted-foreground">Next</span>
                  <span className="font-medium">{next.title}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </nav>
        <BottomTabBar />
      </main>
    </>
  );
}
