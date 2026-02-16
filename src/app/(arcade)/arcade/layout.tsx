import type { Metadata } from "next";
import localFont from "next/font/local";

import "@/arcade/styles/arcade.css";
import { NowServingBanner } from "@/arcade/components/now-serving-banner";

const arcadeDisplay = localFont({
  src: "../../../arcade/fonts/PressStart2P-Regular.ttf",
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
    <div className={`${arcadeDisplay.variable} arcade-scope`}>
      <NowServingBanner />
      <main>{children}</main>
    </div>
  );
}
