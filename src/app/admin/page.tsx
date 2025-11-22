"use client";

import React from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";

import { ConfirmAction } from "@/components/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Mode, RaffleState } from "@/lib/state-manager";

type ActionPayload =
  | { action: "generate"; startNumber: number; endNumber: number; mode: Mode }
  | { action: "append"; endNumber: number }
  | { action: "setMode"; mode: Mode }
  | { action: "updateServing"; currentlyServing: number | null }
  | { action: "reset" }
  | { action: "rerandomize" };

const AdminPage = () => {
  const [state, setState] = React.useState<RaffleState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [rangeForm, setRangeForm] = React.useState({ startNumber: "", endNumber: "" });
  const [mode, setMode] = React.useState<Mode>("random");
  const [appendEnd, setAppendEnd] = React.useState("");
  const [servingInput, setServingInput] = React.useState("");
  const [resetPhrase, setResetPhrase] = React.useState("");
  const [displayUrl, setDisplayUrl] = React.useState("https://example.com/display");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setDisplayUrl(`${window.location.origin}/display`);
    }
  }, []);

  const fetchState = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load state.");
      }
      const data = (await response.json()) as RaffleState;
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error while loading state.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, [fetchState]);

  React.useEffect(() => {
    if (state) {
      setRangeForm({
        startNumber: state.startNumber ? String(state.startNumber) : "",
        endNumber: state.endNumber ? String(state.endNumber) : "",
      });
      setMode(state.mode);
      setAppendEnd(state.endNumber ? String(state.endNumber + 1) : "");
      setServingInput(state.currentlyServing ? String(state.currentlyServing) : "");
    }
  }, [state]);

  const sendAction = React.useCallback(
    async (payload: ActionPayload) => {
      setPendingAction(payload.action);
      setActionError(null);
      try {
        const response = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? "Unable to apply action.");
        }
        const data = (await response.json()) as RaffleState;
        setState(data);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error while saving.";
        setActionError(message);
        throw err;
      } finally {
        setPendingAction(null);
      }
    },
    [],
  );

  const handleGenerate = async () => {
    const start = Number(rangeForm.startNumber);
    const end = Number(rangeForm.endNumber);
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      setActionError("Start and end must be whole numbers.");
      throw new Error("Invalid input");
    }
    await sendAction({ action: "generate", startNumber: start, endNumber: end, mode });
  };

  const handleAppend = async () => {
    const newEnd = Number(appendEnd);
    if (!Number.isInteger(newEnd)) {
      setActionError("Append value must be a whole number.");
      throw new Error("Invalid input");
    }
    await sendAction({ action: "append", endNumber: newEnd });
  };

  const handleModeChange = async (newMode: Mode) => {
    setMode(newMode);
    await sendAction({ action: "setMode", mode: newMode });
  };

  const handleUpdateServing = async () => {
    const trimmed = servingInput.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && !Number.isInteger(parsed)) {
      setActionError("Enter a ticket number or leave blank to clear.");
      throw new Error("Invalid input");
    }
    await sendAction({ action: "updateServing", currentlyServing: parsed });
  };

  const handleReset = async () => {
    if (resetPhrase !== "RESET") {
      setActionError('Type "RESET" to confirm.');
      throw new Error("Reset phrase missing");
    }
    await sendAction({ action: "reset" });
    setResetPhrase("");
  };

  const handleRerandomize = async () => {
    await sendAction({ action: "rerandomize" });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setActionError("Unable to copy link to clipboard.");
    }
  };

  const upcomingPreview = state?.generatedOrder.slice(0, 16) ?? [];
  const nextFive = state?.generatedOrder
    ? state.generatedOrder.slice(
        Math.max(
          0,
          state.currentlyServing
            ? state.generatedOrder.indexOf(state.currentlyServing) + 1
            : 0,
        ),
        state.currentlyServing
          ? state.generatedOrder.indexOf(state.currentlyServing) + 6
          : 5,
      )
    : [];

  return (
    <TooltipProvider>
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex items-center gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Badge>Staff Dashboard</Badge>
          <Badge variant="muted">Auto-save with backups</Badge>
          {pendingAction && (
            <Badge variant="success" className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {pendingAction}...
            </Badge>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Ticket Range & Order</CardTitle>
                <CardDescription>
                  Set the starting and ending ticket numbers, then generate or re-generate the
                  order. Mode controls how the order is built.
                </CardDescription>
              </div>
              <Badge variant="muted" className="uppercase">
                Mode: {mode}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Number</Label>
                  <Input
                    id="start"
                    type="number"
                    min={1}
                    value={rangeForm.startNumber}
                    onChange={(e) =>
                      setRangeForm((prev) => ({ ...prev, startNumber: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Number</Label>
                  <Input
                    id="end"
                    type="number"
                    min={rangeForm.startNumber || 1}
                    value={rangeForm.endNumber}
                    onChange={(e) =>
                      setRangeForm((prev) => ({ ...prev, endNumber: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Order mode</p>
                  <p className="text-xs text-slate-600">
                    Toggle between randomized drawing and sequential first-come-first-serve.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-wide text-slate-600">Sequential</span>
                  <Switch
                    checked={mode === "random"}
                    onCheckedChange={(checked) => handleModeChange(checked ? "random" : "sequential")}
                    aria-label="Toggle random order"
                  />
                  <span className="text-xs uppercase tracking-wide text-slate-600">Random</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <ConfirmAction
                  triggerLabel="Generate order"
                  actionLabel="Generate"
                  title="Generate ticket order"
                  description="Creates a fresh order for the selected range and mode."
                  onConfirm={handleGenerate}
                  disabled={loading || pendingAction !== null}
                />
                <ConfirmAction
                  triggerLabel="Re-randomize"
                  actionLabel="Shuffle"
                  title="Re-randomize this range"
                  description="Shuffle the existing range again to ensure fairness."
                  onConfirm={handleRerandomize}
                  disabled={mode !== "random" || loading || !state}
                  variant="secondary"
                />
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="append">Append additional tickets</Label>
                  <Input
                    id="append"
                    type="number"
                    min={state?.endNumber ?? 0}
                    value={appendEnd}
                    onChange={(e) => setAppendEnd(e.target.value)}
                    placeholder="New ending number"
                  />
                </div>
                <ConfirmAction
                  triggerLabel="Append"
                  actionLabel="Add tickets"
                  title="Append tickets"
                  description="Extend the upper range and insert new tickets into the order."
                  onConfirm={handleAppend}
                  disabled={!appendEnd || loading || !state}
                  variant="secondary"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white/60 p-3">
                <p className="text-sm font-semibold text-slate-900">Upcoming preview</p>
                <p className="text-xs text-slate-600">
                  First sixteen tickets in the current order.
                </p>
                <div className="flex flex-wrap gap-2">
                  {upcomingPreview.map((ticket) => (
                    <span
                      key={ticket}
                      className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800"
                    >
                      #{ticket}
                    </span>
                  ))}
                  {upcomingPreview.length === 0 && (
                    <span className="text-xs text-slate-500">No tickets generated yet.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>Now Serving</CardTitle>
              <CardDescription>
                Highlight the active ticket for the public board. Leave blank to clear.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serving">Ticket number</Label>
                <Input
                  id="serving"
                  type="number"
                  value={servingInput}
                  onChange={(e) => setServingInput(e.target.value)}
                  placeholder="e.g., 642"
                />
              </div>
              <ConfirmAction
                triggerLabel="Update Now Serving"
                actionLabel="Update board"
                title="Update now serving"
                description="Set the ticket number currently being served."
                onConfirm={handleUpdateServing}
                disabled={loading || !state}
              />

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">System reset</p>
                <p className="text-xs text-slate-600">
                  Clears the range, order, and now serving. State is backed up before reset.
                </p>
                <Input
                  value={resetPhrase}
                  onChange={(e) => setResetPhrase(e.target.value)}
                  placeholder='Type "RESET" to enable'
                />
                <ConfirmAction
                  triggerLabel="Reset everything"
                  actionLabel="Reset"
                  title="Reset the raffle"
                  description="All generated data will be cleared after backing up the current state."
                  onConfirm={handleReset}
                  disabled={resetPhrase !== "RESET" || loading}
                  variant="destructive"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Live State</CardTitle>
                <CardDescription>Everything stored in the JSON datastore.</CardDescription>
              </div>
              {state?.timestamp && (
                <Badge variant="muted">
                  Updated {new Date(state.timestamp).toLocaleTimeString()}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Range</p>
                <p className="text-lg font-semibold text-slate-900">
                  {state?.startNumber || "—"} – {state?.endNumber || "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Tickets issued</p>
                <p className="text-lg font-semibold text-slate-900">
                  {state ? state.endNumber - state.startNumber + 1 : "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Current mode</p>
                <p className="text-lg font-semibold text-slate-900 capitalize">{state?.mode}</p>
              </div>
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Now serving</p>
                <p className="text-lg font-semibold text-slate-900">
                  {state?.currentlyServing ?? "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white/70 p-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Next up</p>
                <div className="flex flex-wrap gap-2">
                  {nextFive?.length
                    ? nextFive.map((ticket) => (
                        <span
                          key={ticket}
                          className="rounded-md bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800"
                        >
                          #{ticket}
                        </span>
                      ))
                    : "—"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>Share the live board</CardTitle>
              <CardDescription>
                Clients can scan to watch updates from anywhere. Works on phones and big screens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-4">
                <QRCode value={displayUrl} size={160} />
              </div>
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {displayUrl}
              </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/display">Open display</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCopyLink}>
                    {copied ? "Copied!" : "Copy link"}
                  </Button>
                </div>
            </CardContent>
          </Card>
        </div>

        {(error || actionError) && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-5 w-5 text-rose-600" />
              <div>
                <p className="font-semibold text-rose-800">Something needs attention</p>
                <p className="text-sm text-rose-700">{error ?? actionError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!error && state && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" />
              <div className="space-y-1">
                <p className="font-semibold text-emerald-800">Persistence confirmed</p>
                <p className="text-sm text-emerald-700">
                  Last write: {new Date(state.timestamp ?? Date.now()).toLocaleString()} — backups
                  stored alongside the JSON data.
                </p>
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-700">
                  <Sparkles className="h-4 w-4" />
                  Atomic writes • Backup snapshots • Auto-refresh every 5s
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading state from datastore...
          </div>
        )}
      </main>
    </TooltipProvider>
  );
};

export default AdminPage;
