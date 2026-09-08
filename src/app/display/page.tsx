// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import type { Metadata } from "next";

import { PublicDisplayPage } from "@/components/public-display-page";
import { LanguageProvider } from "@/contexts/language-context";
import { getResolvedBrand } from "@/lib/brand-config/resolve";
import {
  resolveRealtimeCanaryClientConfig,
  resolveRealtimeSourceClientConfig,
} from "@/lib/realtime/client-canary-config";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getResolvedBrand();
  return {
    title: "Display",
    description: brand.metadata.displayDescription,
  };
}

export default function DisplayPage() {
  // Scope the board to a non-persisting language provider so admin-configured
  // language rotation never writes the shared `display-language` preference or
  // bleeds into other routes (e.g. the personalized homepage at `/`).
  return (
    <LanguageProvider persist={false}>
      <PublicDisplayPage
        realtimeCanary={resolveRealtimeCanaryClientConfig()}
        realtimeSourceCanary={resolveRealtimeSourceClientConfig()}
      />
    </LanguageProvider>
  );
}
