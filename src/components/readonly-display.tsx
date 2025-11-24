"use client";

import React from "react";
import QRCode from "react-qr-code";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RaffleState } from "@/lib/state-types";

const formatDate = () => {
  const now = new Date();
  const weekday = now.toLocaleString("en-US", { weekday: "long" });
  const day = now.getDate();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  const suffix = (() => {
    const remainder = day % 100;
    if (remainder >= 11 && remainder <= 13) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  })();

  return `${weekday}, ${month} ${day}${suffix}, ${year}`;
};

const formatTime = (input?: Date | number | null) => {
  if (!input && input !== 0) return "—";
  const date = input instanceof Date ? input : new Date(input);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const ReadOnlyDisplay = () => {
  const [state, setState] = React.useState<RaffleState | null>(null);
  const [status, setStatus] = React.useState("Polling for latest state…");
  const [hasError, setHasError] = React.useState(false);

  const formattedDate = React.useMemo(() => formatDate(), []);

  const fetchState = React.useCallback(async () => {
    setStatus("Refreshing…");
    setHasError(false);
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load state");
      }
      const payload = (await response.json()) as RaffleState;
      setState(payload);
      setStatus(`Last checked: ${formatTime(new Date())}`);
    } catch (error) {
      setStatus(`Error loading state: ${error instanceof Error ? error.message : "Unknown error"}`);
      setHasError(true);
    }
  }, []);

  React.useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 4000);
    return () => clearInterval(interval);
  }, [fetchState]);

  React.useEffect(() => {
    document.title = `Food Pantry Service For ${formattedDate}`;
  }, [formattedDate]);

  const startNumber = state?.startNumber ?? 0;
  const endNumber = state?.endNumber ?? 0;
  const generatedOrder = state?.generatedOrder ?? [];
  const currentlyServing = state?.currentlyServing ?? null;
  const currentIndex =
    generatedOrder && currentlyServing !== null ? generatedOrder.indexOf(currentlyServing) : -1;
  const hasTickets = generatedOrder.length > 0;
  const updatedTime = formatTime(state?.timestamp ?? null);

  return (
    <div
      className="min-h-screen w-full px-2 py-8 text-foreground sm:px-4 lg:px-6"
      style={{ background: "var(--gradient-display-bg)" }}
    >
      <div className="mx-auto flex w-full flex-col gap-4">
        {/* Logo + Now Serving Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(280px,320px)_1fr_minmax(280px,320px)] sm:items-center sm:gap-6">
          {/* Logo - left */}
          <div className="flex justify-center sm:justify-start">
            <img
              src="/WTH_Logo_Horizontal_Black_Outline.png"
              alt="William Temple House"
              className="block h-auto w-full max-w-[400px] dark:hidden"
            />
            <img
              src="/wth-logo-horizontal-reverse.png"
              alt="William Temple House"
              className="hidden h-auto w-full max-w-[400px] dark:block"
            />
          </div>

          {/* NOW SERVING - center */}
          <div className="flex justify-center">
            <div className="text-center">
              <p className="mb-1 text-lg uppercase tracking-[0.14em] text-muted-foreground">Now Serving</p>
              <p
                className="bg-clip-text text-[96px] font-black leading-[1.15] text-transparent"
                style={{ backgroundImage: "var(--serving-text-gradient)" }}
                aria-label="Currently serving ticket number"
              >
                {currentlyServing ?? "Waiting"}
              </p>
            </div>
          </div>

          {/* QR Code - right */}
          <div className="hidden sm:flex items-center justify-center">
            <QRCode
              aria-label="Scan to view display"
              value={typeof window !== "undefined" ? window.location.href : ""}
              size={180}
            />
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 sm:gap-4">
          <Card className="border-border/80 bg-card/80 text-left">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                Food Pantry Service For
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold text-foreground">{formattedDate}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80 text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                Tickets Issued Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {startNumber && endNumber ? `${startNumber} – ${endNumber}` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80 text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                Total Tickets Issued
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {startNumber && endNumber ? endNumber - startNumber + 1 : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                Drawing Order
              </CardTitle>
              <Badge
                variant="muted"
                className="border-border/50 bg-secondary/50 text-xs font-medium text-muted-foreground"
              >
                Updated: {updatedTime}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasTickets && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/20 px-4 py-6 text-center text-3xl font-extrabold leading-snug text-foreground">
                <span className="block w-full">Welcome!</span>
                <span className="block w-full">The raffle has not yet started.</span>
                <span className="block w-full">Check back soon for updates.</span>
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 md:gap-4">
              {generatedOrder.map((value, index) => {
                const baseClasses =
                  "flex items-center justify-center rounded-xl border text-center text-2xl font-extrabold leading-[1.2] px-4 py-3";
                const stateStyles =
                  value === currentlyServing
                    ? {
                        background: "var(--ticket-serving)",
                        borderColor: "var(--ticket-serving-border)",
                        color: "var(--ticket-serving-text)",
                      }
                    : currentIndex !== -1 && index < currentIndex
                      ? {
                          background: "var(--ticket-served)",
                          borderColor: "var(--ticket-served-border)",
                          color: "oklch(0.18 0 0)",
                        }
                      : {
                          background: "var(--ticket-upcoming)",
                          borderColor: "var(--ticket-upcoming-border)",
                          color: "var(--muted-foreground)",
                          opacity: 0.85,
                        };
                return (
                  <div key={value} className={baseClasses} style={stateStyles}>
                    {value}
                  </div>
                );
              })}
            </div>

            <div
              className={`text-sm ${hasError ? "text-destructive" : "text-muted-foreground"}`}
              id="status"
              aria-live="polite"
            >
              {status}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
