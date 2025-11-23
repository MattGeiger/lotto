"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "react-qr-code";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";

import { ConfirmAction } from "@/components/confirm-action";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
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
  | { action: "rerandomize" }
  | { action: "undo" }
  | { action: "redo" }
  | { action: "restoreSnapshot"; id: string };

type Snapshot = {
  id: string;
  timestamp: number;
};

const AdminPage = () => {
  const [state, setState] = React.useState<RaffleState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [rangeForm, setRangeForm] = React.useState({ startNumber: "", endNumber: "" });
  const [mode, setMode] = React.useState<Mode>("random");
  const [appendEnd, setAppendEnd] = React.useState("");
  const [modeConfirmOpen, setModeConfirmOpen] = React.useState(false);
  const [pendingModeChoice, setPendingModeChoice] = React.useState<Mode | null>(null);
  const [modeChanging, setModeChanging] = React.useState(false);
  const [resetPhrase, setResetPhrase] = React.useState("");
  const [displayUrl, setDisplayUrl] = React.useState("https://example.com/display");
  const [copied, setCopied] = React.useState(false);
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<string>("");

  const refreshSnapshots = React.useCallback(async () => {
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listSnapshots" }),
      });
      if (response.ok) {
        const snaps = (await response.json()) as Snapshot[];
        setSnapshots(snaps);
        if (snaps.length && !selectedSnapshot) {
          setSelectedSnapshot(snaps[0].id);
        }
      }
    } catch {
      // ignore snapshot refresh errors in UI
    }
  }, [selectedSnapshot]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setDisplayUrl(`${window.location.origin}/display`);
    }
  }, []);

  const fetchState = React.useCallback(async () => {
    setLoading(true);
    try {
      const [stateResp, snapshotsResp] = await Promise.all([
        fetch("/api/state", { cache: "no-store" }),
        fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "listSnapshots" }),
        }),
      ]);
      if (!stateResp.ok) {
        throw new Error("Unable to load state.");
      }
      const data = (await stateResp.json()) as RaffleState;
      setState(data);
      setError(null);
      if (snapshotsResp.ok) {
        const snaps = (await snapshotsResp.json()) as Snapshot[];
        setSnapshots(snaps);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error while loading state.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchState();
  }, [fetchState]);

  React.useEffect(() => {
    if (state) {
      setRangeForm({
        startNumber: state.startNumber ? String(state.startNumber) : "",
        endNumber: state.endNumber ? String(state.endNumber) : "",
      });
      setMode(state.mode);
      setAppendEnd(state.endNumber ? String(state.endNumber + 1) : "");
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
        await refreshSnapshots();
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error while saving.";
        setActionError(message);
        throw err;
      } finally {
        setPendingAction(null);
      }
    },
    [refreshSnapshots],
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
  const handleAppendStep = (delta: number) => {
    if (!state) return;
    const min = (state.endNumber ?? 0) + 1;
    const nextValue = Math.max(min, resolvedAppendValue + delta);
    setAppendEnd(String(nextValue));
  };

  const handleModeChange = async (newMode: Mode) => {
    setModeChanging(true);
    try {
      await sendAction({ action: "setMode", mode: newMode });
      setMode(newMode);
    } finally {
      setModeChanging(false);
      setModeConfirmOpen(false);
      setPendingModeChoice(null);
    }
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

  const handleModeToggleRequest = (newMode: Mode) => {
    if (newMode === mode) return;
    setPendingModeChoice(newMode);
    setModeConfirmOpen(true);
  };

  React.useEffect(() => {
    if (!modeConfirmOpen) {
      setPendingModeChoice(null);
      setModeChanging(false);
    }
  }, [modeConfirmOpen]);

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

  const currentIndex =
    state?.generatedOrder && state.currentlyServing !== null
      ? state.generatedOrder.indexOf(state.currentlyServing)
      : -1;
  const currentDrawNumber = currentIndex >= 0 ? currentIndex + 1 : null;
  const totalTickets = state?.generatedOrder.length ?? 0;
  const currentTicket =
    currentIndex >= 0 && state?.generatedOrder ? state.generatedOrder[currentIndex] : null;
  const prevArrowVariant: ButtonProps["variant"] =
    currentIndex === -1 ? "secondary" : "outline";
  const appendMin = (state?.endNumber ?? 0) + 1;
  const parsedAppendValue = Number(appendEnd);
  const resolvedAppendValue =
    Number.isFinite(parsedAppendValue) && appendEnd.trim() !== ""
      ? parsedAppendValue
      : appendMin;
  const appendLeftVariant: ButtonProps["variant"] =
    !state || resolvedAppendValue <= appendMin ? "secondary" : "outline";

  const formatOrdinal = (value: number) => {
    const remainder = value % 100;
    if (remainder >= 11 && remainder <= 13) return `${value}th`;
    switch (value % 10) {
      case 1:
        return `${value}st`;
      case 2:
        return `${value}nd`;
      case 3:
        return `${value}rd`;
      default:
        return `${value}th`;
    }
  };

  const setServingByIndex = async (index: number | null) => {
    if (!state || totalTickets === 0) {
      setActionError("Generate tickets first.");
      return;
    }
    if (index === null) {
      await sendAction({ action: "updateServing", currentlyServing: null });
      return;
    }
    const clamped = Math.max(0, Math.min(index, totalTickets - 1));
    const ticket = state.generatedOrder[clamped];
    await sendAction({ action: "updateServing", currentlyServing: ticket });
  };

  const handlePrevServing = async () => {
    if (!state || totalTickets === 0) return;
    if (currentIndex <= 0) {
      await setServingByIndex(0);
      return;
    }
    await setServingByIndex(currentIndex - 1);
  };

  const handleNextServing = async () => {
    if (!state || totalTickets === 0) return;
    if (currentIndex === -1) {
      await setServingByIndex(0);
      return;
    }
    if (currentIndex >= totalTickets - 1) return;
    await setServingByIndex(currentIndex + 1);
  };

  const handleUndo = async () => {
    await sendAction({ action: "undo" });
    await refreshSnapshots();
  };

  const handleRedo = async () => {
    await sendAction({ action: "redo" });
    await refreshSnapshots();
  };

  const handleRestoreSnapshot = async () => {
    if (!selectedSnapshot) return;
    await sendAction({ action: "restoreSnapshot", id: selectedSnapshot });
    await refreshSnapshots();
  };

  React.useEffect(() => {
    if (snapshots.length && !selectedSnapshot) {
      setSelectedSnapshot(snapshots[0].id);
    }
  }, [snapshots, selectedSnapshot]);

  return (
    <TooltipProvider>
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="w-full">
          <Image
            src="/wth-logo-horizontal.png"
            alt="William Temple House"
            width={900}
            height={240}
            className="h-auto w-full max-w-3xl"
            priority
          />
        </div>
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

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Ticket Range & Order</CardTitle>
                <CardDescription>
                  Set the starting and ending ticket numbers, then generate or re-generate the
                  order. Mode controls how the order is built.
                </CardDescription>
              </div>
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
                    Controls how new tickets are placed. Existing order stays untouched.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-wide text-slate-600">Sequential</span>
                  <Switch
                    checked={mode === "random"}
                    onCheckedChange={(checked) =>
                      handleModeToggleRequest(checked ? "random" : "sequential")
                    }
                    aria-label="Toggle random order"
                    disabled={modeChanging || pendingAction !== null}
                  />
                  <span className="text-xs uppercase tracking-wide text-slate-600">Random</span>
                </div>
              </div>

              <AlertDialog open={modeConfirmOpen} onOpenChange={setModeConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm mode change</AlertDialogTitle>
                    <AlertDialogDescription>
                      Switching modes affects how future tickets are slotted. The existing draw order
                      will remain exactly as-is, but appended tickets will follow the new mode.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={modeChanging}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        if (pendingModeChoice) {
                          await handleModeChange(pendingModeChoice);
                        }
                      }}
                      disabled={modeChanging}
                    >
                      {modeChanging ? "Working..." : "Switch to " + (pendingModeChoice ?? "")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

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
                  <Label htmlFor="append" className="text-lg font-semibold text-slate-900">
                    Append additional tickets
                  </Label>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Input
                      id="append"
                      type="number"
                      min={state?.endNumber ?? 0}
                      value={appendEnd}
                      onChange={(e) => setAppendEnd(e.target.value)}
                      placeholder="New ending number"
                      className="w-28 flex-none appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:w-40"
                    />
                    <Button
                      type="button"
                      variant={appendLeftVariant}
                      size="icon"
                      onClick={() => handleAppendStep(-1)}
                      disabled={!state}
                      aria-label="Decrease append end"
                      className="flex-none text-[var(--color-muted-foreground)]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleAppendStep(1)}
                      disabled={!state}
                      aria-label="Increase append end"
                      className="flex-none text-[var(--color-muted-foreground)]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <ConfirmAction
                    triggerLabel="Append"
                    actionLabel="Add tickets"
                    title="Append tickets"
                    description="Extend the upper range and insert new tickets into the order."
                    onConfirm={handleAppend}
                    disabled={!appendEnd || loading || !state}
                    variant="default"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>Now Serving</CardTitle>
              <CardDescription>
                Step through the draw order using arrows. Positions are first, second, third, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Draw position</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {currentDrawNumber ? formatOrdinal(currentDrawNumber) : "Not started"}
                  </p>
                  <p className="text-sm text-slate-600">
                    Ticket {currentTicket ? `#${currentTicket}` : "—"} of{" "}
                    {totalTickets || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={prevArrowVariant}
                    size="icon"
                    onClick={handlePrevServing}
                    disabled={loading || !state || totalTickets === 0}
                    aria-label="Previous draw"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleNextServing}
                    disabled={
                      loading ||
                      !state ||
                      totalTickets === 0 ||
                      (currentIndex !== -1 && currentIndex >= totalTickets - 1)
                    }
                    aria-label="Next draw"
                    className="text-[var(--color-muted-foreground)]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setServingByIndex(null)}
                    disabled={loading || !state || currentIndex === -1}
                  >
                    Clear
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
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

          <Card className="space-y-3">
            <CardHeader className="pb-2">
              <CardTitle>History</CardTitle>
              <CardDescription>Undo/redo or restore from snapshots.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleUndo}
                  disabled={loading || pendingAction !== null}
                >
                  Undo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRedo}
                  disabled={loading || pendingAction !== null}
                >
                  Redo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={refreshSnapshots}
                  disabled={loading}
                >
                  Refresh snapshots
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-700" htmlFor="snapshot-select">
                  Restore snapshot
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    id="snapshot-select"
                    className="h-10 min-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={selectedSnapshot}
                    onChange={(e) => setSelectedSnapshot(e.target.value)}
                  >
                    {snapshots.length === 0 && <option value="">No snapshots yet</option>}
                    {snapshots.map((snap) => (
                      <option key={snap.id} value={snap.id}>
                        {new Date(snap.timestamp).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleRestoreSnapshot}
                    disabled={!selectedSnapshot || loading || pendingAction !== null}
                  >
                    Restore
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="space-y-3">
            <CardHeader>
              <CardTitle>System reset</CardTitle>
              <CardDescription>
                Clears the range, order, and now serving. State is backed up before reset.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
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
