import type { Metadata } from "next";
import {
  Bodoni_Moda_SC,
  Geist_Mono,
  IBM_Plex_Mono,
  Lato,
  Open_Sans,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/language-context";
import { SpeedInsights } from "@vercel/speed-insights/next";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const bodoniModaSc = Bodoni_Moda_SC({
  variable: "--font-bodoni-moda-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WTH Digital Raffle",
  description: "Fair, durable raffle and queue management for the William Temple House pantry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const enableTweakcnPreview = process.env.VERCEL !== "1";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${lato.variable} ${geistMono.variable} ${openSans.variable} ${bodoniModaSc.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        {enableTweakcnPreview ? (
          <script
            async
            crossOrigin="anonymous"
            src="https://tweakcn.com/live-preview.min.js"
          />
        ) : null}
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
          <Toaster />
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
