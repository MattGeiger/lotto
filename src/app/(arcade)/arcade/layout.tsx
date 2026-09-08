// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import type { Metadata } from "next";
import localFont from "next/font/local";

import "@/arcade/styles/arcade.css";
import { ArcadeLanguageSwitcher } from "@/arcade/components/arcade-language-switcher";
import { ArcadeModeSwitcher } from "@/arcade/components/arcade-mode-switcher";
import { ArcadeShell } from "@/arcade/components/arcade-shell";
import { NowServingBanner } from "@/arcade/components/now-serving-banner";
import {
  resolveRealtimeCanaryClientConfig,
  resolveRealtimeSourceClientConfig,
} from "@/lib/realtime/client-canary-config";

const arcadeDisplay = localFont({
  src: "../../../arcade/fonts/SevenFifteen-V0_013/SevenFifteenMonoRounded-Regular.ttf",
  variable: "--font-arcade-display",
  display: "swap",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: "Arcade",
  description: "Retro arcade games while you wait",
};

export default function ArcadeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ArcadeShell fontClasses={arcadeDisplay.variable}>
      <NowServingBanner
        realtimeCanary={resolveRealtimeCanaryClientConfig()}
        realtimeSourceCanary={resolveRealtimeSourceClientConfig()}
      />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-2 [direction:ltr] sm:px-6">
        <ArcadeLanguageSwitcher />
        <div className="flex items-center gap-2">
          <ArcadeModeSwitcher />
        </div>
      </div>
      <main>{children}</main>
    </ArcadeShell>
  );
}
