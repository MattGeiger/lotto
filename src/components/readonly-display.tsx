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

const formatMode = (mode?: RaffleState["mode"]) => {
  if (mode === "random") return "Raffle";
  if (mode === "sequential") return "Sequential";
  return "—";
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
      setStatus(`Last checked: ${new Date().toLocaleTimeString()}`);
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
  const updatedTime = state?.timestamp ? new Date(state.timestamp).toLocaleTimeString() : "—";

  return (
    <div
      className="min-h-screen w-full px-2 py-8 text-slate-50 sm:px-4 lg:px-6"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.18), transparent 32%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.12), transparent 28%), linear-gradient(145deg, #000, #0a0a0a 45%, #000)",
      }}
    >
      <div className="mx-auto flex w-full flex-col gap-4">
        {/* Logo + Now Serving Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(280px,320px)_1fr_minmax(280px,320px)] sm:items-center sm:gap-6">
          {/* Logo - left */}
          <div className="flex justify-center sm:justify-start">
            <img
              src="/wth-logo-horizontal-reverse.png"
              alt="William Temple House"
              className="h-auto w-full max-w-[400px]"
            />
          </div>

          {/* NOW SERVING - center */}
          <div className="flex justify-center">
            <div className="text-center">
              <p className="mb-1 text-lg uppercase tracking-[0.14em] text-slate-200">Now Serving</p>
              <p className="bg-gradient-to-br from-amber-400 to-amber-300 bg-clip-text text-[96px] font-black leading-[1.15] text-transparent">
                {currentlyServing ?? "Waiting"}
              </p>
            </div>
          </div>

          {/* QR Code - right */}
          <div className="hidden sm:block">
            <Card className="border-neutral-800/80 bg-neutral-950/80 text-center">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg uppercase tracking-[0.14em] text-slate-300">
                  Share
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-2">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-3">
                  <QRCode value={typeof window !== "undefined" ? window.location.href : ""} size={120} />
                </div>
                <p className="text-xs text-slate-300">Scan to open</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 sm:gap-4">
          <Card className="border-neutral-800/80 bg-neutral-950/80 text-left">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg uppercase tracking-[0.14em] text-slate-300">
                Food Pantry Service For
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold text-white">{formattedDate}</p>
            </CardContent>
          </Card>
          <Card className="border-neutral-800/80 bg-neutral-950/80 text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-slate-300">
                Tickets Issued Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">
                {startNumber && endNumber ? `${startNumber} – ${endNumber}` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-neutral-800/80 bg-neutral-950/80 text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-slate-300">
                Total Tickets Issued
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">
                {startNumber && endNumber ? endNumber - startNumber + 1 : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-neutral-800/80 bg-neutral-950/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-slate-300">
                Drawing Order
              </CardTitle>
              <Badge
                variant="muted"
                className="border-white/20 bg-black/50 text-[11px] font-medium text-slate-100"
              >
                Updated: {updatedTime}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasTickets && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-black/30 px-4 py-6 text-center text-3xl font-extrabold leading-snug text-slate-100">
                <span className="block w-full">Welcome!</span>
                <span className="block w-full">The raffle has not yet started.</span>
                <span className="block w-full">Check back soon for updates.</span>
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 md:gap-4">
              {generatedOrder.map((value, index) => {
                const baseClasses =
                  "flex items-center justify-center rounded-xl border text-center text-[22px] font-extrabold leading-[1.2] px-4 py-3";
                const stateClasses =
                  value === currentlyServing
                    ? "border-amber-300 bg-gradient-to-br from-amber-400 to-amber-300 text-neutral-900"
                    : currentIndex !== -1 && index < currentIndex
                      ? "border-teal-300 bg-gradient-to-br from-emerald-400 to-cyan-300 text-emerald-950"
                      : "border-slate-800 bg-neutral-900/80 text-slate-200 opacity-80";
                return (
                  <Badge key={value} className={`${baseClasses} ${stateClasses}`}>
                    {value}
                  </Badge>
                );
              })}
            </div>

            <div
              className={`text-sm ${hasError ? "text-rose-300" : "text-slate-200"}`}
              id="status"
            >
              {status}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
