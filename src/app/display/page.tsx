"use client";

import React from "react";
import Link from "next/link";
import { Eye, Loader2, Sparkles } from "lucide-react";

import { BoardGrid } from "@/components/board-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RaffleState } from "@/lib/state-manager";

const DisplayPage = () => {
  const [state, setState] = React.useState<RaffleState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load raffle state.");
      }
      const payload = (await response.json()) as RaffleState;
      setState(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error loading the board.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  const nowServing = state?.currentlyServing ?? null;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Badge variant="muted" className="bg-white/10 text-white">
            William Temple House
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Raffle Board</h1>
          <p className="text-sm text-slate-200">
            Auto-refreshing client view. Numbers update as the team manages the raffle.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-100">
            <Badge variant="success" className="bg-emerald-500 text-white">
              Live
            </Badge>
            <Badge variant="muted" className="bg-white/10 text-white">
              Mode: {state?.mode ?? "—"}
            </Badge>
            {state?.timestamp && (
              <Badge variant="muted" className="bg-white/10 text-white">
                Updated {new Date(state.timestamp).toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="secondary" size="sm" className="bg-white text-slate-900">
            <Link href="/admin">
              <Eye className="mr-2 h-4 w-4" />
              Staff controls
            </Link>
          </Button>
          <Badge variant="muted" className="flex items-center gap-1 bg-white/10 text-white">
            <Sparkles className="h-3 w-3" />
            Randomized fairness
          </Badge>
        </div>
      </header>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center gap-2 text-sm text-rose-800">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Now Serving</CardTitle>
              <CardDescription>
                The number in gold is being served. Blue tiles are the next few tickets.
              </CardDescription>
            </div>
            {loading && (
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Updating...
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-xs uppercase tracking-wide text-amber-700">Now serving</span>
              <span className="text-3xl font-bold text-amber-700">
                {nowServing ?? "Waiting"}
              </span>
              {state && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                  Range {state.startNumber}–{state.endNumber}
                </span>
              )}
            </div>

            <BoardGrid order={state?.generatedOrder ?? []} currentlyServing={nowServing} />
          </CardContent>
        </Card>

        <Card className="space-y-3">
          <CardHeader>
            <CardTitle>Quick facts</CardTitle>
            <CardDescription>Auto-updates from the persisted JSON datastore.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 rounded-lg border border-slate-200 bg-white/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tickets generated</p>
              <p className="text-lg font-semibold text-slate-900">
                {state ? state.endNumber - state.startNumber + 1 : "—"}
              </p>
            </div>
            <div className="space-y-1 rounded-lg border border-slate-200 bg-white/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Mode</p>
              <p className="text-lg font-semibold text-slate-900 capitalize">{state?.mode ?? "—"}</p>
            </div>
            <div className="space-y-1 rounded-lg border border-slate-200 bg-white/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Last updated</p>
              <p className="text-lg font-semibold text-slate-900">
                {state?.timestamp ? new Date(state.timestamp).toLocaleTimeString() : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default DisplayPage;
