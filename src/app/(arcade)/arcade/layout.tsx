import type { Metadata } from "next";
import localFont from "next/font/local";

import "@/arcade/styles/arcade.css";
import { ArcadeLanguageSwitcher } from "@/arcade/components/arcade-language-switcher";
import { ArcadeModeSwitcher } from "@/arcade/components/arcade-mode-switcher";
import { ArcadeShell } from "@/arcade/components/arcade-shell";
import { NowServingBanner } from "@/arcade/components/now-serving-banner";

const arcadeDisplay = localFont({
  src: "../../../arcade/fonts/SevenFifteen-V0_013/SevenFifteenMonoRounded-Regular.ttf",
  variable: "--font-arcade-display",
  display: "swap",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: "Arcade | WTH Digital Raffle",
  description: "Retro arcade game menu with live queue awareness.",
};

export default function ArcadeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ArcadeShell fontClasses={arcadeDisplay.variable}>
      <NowServingBanner />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-2 [direction:ltr] sm:px-6">
        <ArcadeLanguageSwitcher />
        <ArcadeModeSwitcher />
      </div>
      <main>{children}</main>
    </ArcadeShell>
  );
}
