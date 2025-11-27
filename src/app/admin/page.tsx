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
  Undo2,
  Redo2,
  History,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { Mode, RaffleState } from "@/lib/state-manager";

type ActionPayload =
  | { action: "generate"; startNumber: number; endNumber: number; mode: Mode }
  | { action: "append"; endNumber: number }
  | { action: "setMode"; mode: Mode }
  | { action: "updateServing"; currentlyServing: number | null }
  | { action: "reset" }
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
  const [cleanupMessage, setCleanupMessage] = React.useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = React.useState("https://example.com/");
  const [customDisplayUrl, setCustomDisplayUrl] = React.useState<string | null>(null);
  const [editingUrl, setEditingUrl] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState("");
  const [urlError, setUrlError] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<string>("");
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const browserOriginRef = React.useRef<string | null>(null);

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
      const browserUrl = `${window.location.origin}/`;
      browserOriginRef.current = browserUrl;
      setDisplayUrl(browserUrl);
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
    if (state?.displayUrl) {
      setCustomDisplayUrl(state.displayUrl);
      setDisplayUrl(state.displayUrl);
    } else if (browserOriginRef.current) {
      setCustomDisplayUrl(null);
      setDisplayUrl(browserOriginRef.current);
    }
  }, [state?.displayUrl]);

  React.useEffect(() => {
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listSnapshots" }),
    })
      .then((response) => response.json())
      .then((snapshots) => {
        const undoAvailable = Array.isArray(snapshots) && snapshots.length >= 2;
        setCanUndo(undoAvailable);
      })
      .catch(() => {
        setCanUndo(false);
        setCanRedo(false);
      });
  }, [state]);

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
        if (payload.action !== "undo" && payload.action !== "redo") {
          setCanRedo(false);
        }
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

  const handleCleanup = async (days: number) => {
    setCleanupMessage(null);
    setActionError(null);
    setPendingAction("cleanup");
    try {
      const response = await fetch("/api/state/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays: days }),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionError(data?.error || "Cleanup failed. Please try again.");
        return;
      }
      setCleanupMessage(
        `Deleted ${data.deletedCount} snapshots older than ${data.retentionDays} days.`,
      );
    } catch (err) {
      setActionError("Cleanup request failed.");
    } finally {
      setPendingAction(null);
    }
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

  const handleEditUrl = () => {
    setUrlInput(customDisplayUrl || displayUrl);
    setEditingUrl(true);
    setUrlError("");
  };

  const handleSaveUrl = async () => {
    if (urlInput.length > 64) {
      setUrlError("URL must be 64 characters or less");
      return;
    }
    try {
      // eslint-disable-next-line no-new
      new URL(urlInput);
    } catch {
      setUrlError("Invalid URL format");
      return;
    }

    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setDisplayUrl", url: urlInput }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setUrlError(data.error || "Failed to save URL");
        return;
      }
      setCustomDisplayUrl(urlInput);
      setDisplayUrl(urlInput);
      if (state) {
        setState({ ...state, displayUrl: urlInput });
      }
      setEditingUrl(false);
    } catch {
      setUrlError("Failed to save URL");
    }
  };

  const handleResetUrl = async () => {
    const browserUrl = browserOriginRef.current ?? (typeof window !== "undefined"
      ? `${window.location.origin}/`
      : "");
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setDisplayUrl", url: null }),
      });
      setCustomDisplayUrl(null);
      setDisplayUrl(browserUrl);
      if (state) {
        setState({ ...state, displayUrl: null });
      }
      setEditingUrl(false);
      setUrlError("");
    } catch {
      setUrlError("Failed to reset URL");
    }
  };

  const handleCancelEdit = () => {
    setEditingUrl(false);
    setUrlError("");
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
  const appendMin = (state?.endNumber ?? 0) + 1;
  const parsedAppendValue = Number(appendEnd);
  const resolvedAppendValue =
    Number.isFinite(parsedAppendValue) && appendEnd.trim() !== ""
      ? parsedAppendValue
      : appendMin;

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
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo" }),
      });

      if (!response.ok) throw new Error("Undo failed");

      const newState = (await response.json()) as RaffleState;
      setState(newState);
      setCanRedo(true);
      await refreshSnapshots();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Undo failed");
    }
  };

  const handleRedo = async () => {
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redo" }),
      });

      if (!response.ok) throw new Error("Redo failed");

      const newState = (await response.json()) as RaffleState;
      setState(newState);
      setCanRedo(false);
      await refreshSnapshots();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Redo failed");
    }
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
      <div className="min-h-screen w-full bg-gradient-display">
        <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="w-full">
          <Image
            src="/wth-logo-horizontal.png"
            alt="William Temple House"
            width={900}
            height={240}
            className="h-auto w-full max-w-[400px] dark:hidden"
            priority
          />
          <Image
            src="/wth-logo-horizontal-reverse.png"
            alt="William Temple House"
            width={900}
            height={240}
            className="hidden h-auto w-full max-w-[400px] dark:block"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/staff">
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Link>
          </Button>
          {pendingAction && (
            <Badge
              variant="success"
              className="flex items-center gap-2"
            >
              <Loader2 className="size-3 animate-spin" />
              {pendingAction}...
            </Badge>
          )}
        </div>

        <div className="absolute right-6 top-10 z-50 lg:right-8">
          <ThemeSwitcher />
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="bg-card">
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
              {state?.orderLocked && (
                <Alert className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4" />
                  <div className="space-y-1">
                    <AlertTitle>Lottery Active</AlertTitle>
                    <AlertDescription>
                      Initial draw: tickets {state.startNumber}-{state.endNumber} (locked)
                      <br />
                      Current mode: {state.mode.toUpperCase()}
                      {state.mode === "random"
                        ? " (new tickets randomized within batch)"
                        : " (new tickets added in order)"}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Number</Label>
                  <Input
                    id="start"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={rangeForm.startNumber}
                    onChange={(e) =>
                      setRangeForm((prev) => ({
                        ...prev,
                        startNumber: e.target.value.replace(/\D/g, "").slice(0, 6),
                      }))
                    }
                    className="appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Number</Label>
                  <Input
                    id="end"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={rangeForm.endNumber}
                    onChange={(e) =>
                      setRangeForm((prev) => ({
                        ...prev,
                        endNumber: e.target.value.replace(/\D/g, "").slice(0, 6),
                      }))
                    }
                    className="appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-gradient-card-info p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Order mode</p>
                  <p className="text-xs text-muted-foreground">
                    Controls how new tickets are placed. Existing order stays untouched.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Sequential</span>
                  <Switch
                    checked={mode === "random"}
                    onCheckedChange={(checked) =>
                      handleModeToggleRequest(checked ? "random" : "sequential")
                    }
                    aria-label="Toggle random order"
                    disabled={modeChanging || pendingAction !== null}
                  />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Random</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Changing mode does not affect existing tickets in the queue
              </p>

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
                  disabled={state?.orderLocked || loading || pendingAction !== null}
                  triggerTitle={
                    state?.orderLocked
                      ? "Order locked. Use Reset to start new lottery."
                      : undefined
                  }
                />
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="append" className="text-lg font-semibold text-foreground">
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
                      variant="outline"
                      size="icon"
                      onClick={() => handleAppendStep(-1)}
                      disabled={!state}
                      aria-label="Decrease append end"
                      className={!state || resolvedAppendValue <= appendMin ? "flex-none opacity-50" : "flex-none"}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleAppendStep(1)}
                      disabled={!state}
                      aria-label="Increase append end"
                      className="flex-none"
                    >
                      <ChevronRight className="size-4" />
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

          <Card className="bg-card space-y-4">
            <CardHeader>
              <CardTitle>Now Serving</CardTitle>
              <CardDescription>
                Step through the draw order using arrows. Positions are first, second, third, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-gradient-card-info p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Draw position</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {currentDrawNumber ? formatOrdinal(currentDrawNumber) : "Not started"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ticket {currentTicket ? `#${currentTicket}` : "—"} of{" "}
                    {totalTickets || "—"}
                  </p>
                </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handlePrevServing}
                  disabled={loading || !state || totalTickets === 0}
                  aria-label="Previous draw"
                  className={currentIndex <= 0 ? "opacity-50" : ""}
                >
                  <ChevronLeft className="size-4" />
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
                  className=""
                >
                  <ChevronRight className="size-4" />
                </Button>
                <ConfirmAction
                  triggerLabel="Clear"
                  actionLabel="Clear position"
                  title="Clear draw position"
                  description="This will reset the “Now Serving” display back to the beginning. Clients will no longer see an active position. You can undo this action."
                  onConfirm={() => setServingByIndex(null)}
                  disabled={loading || !state || currentIndex === -1}
                  variant="ghost"
                  size="sm"
                />
              </div>
            </div>

            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="bg-card">
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Live State</CardTitle>
                <CardDescription>Everything stored in the JSON datastore.</CardDescription>
              </div>
              {state?.timestamp && (
                <Badge
                  variant="outline"
                  className="border-border/60 text-xs font-medium text-muted-foreground"
                >
                  Updated {new Date(state.timestamp).toLocaleTimeString()}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Range</p>
                <p className="text-lg font-semibold text-foreground">
                  {state?.startNumber || "—"} – {state?.endNumber || "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tickets issued</p>
                <p className="text-lg font-semibold text-foreground">
                  {state ? state.endNumber - state.startNumber + 1 : "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Current mode</p>
                <p className="text-lg font-semibold text-foreground capitalize">{state?.mode}</p>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Now serving</p>
                <p className="text-lg font-semibold text-foreground">
                  {state?.currentlyServing ?? "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Next up</p>
                <div className="flex flex-wrap gap-2">
                    {nextFive?.length
                    ? nextFive.map((ticket) => (
                        <Badge key={ticket} variant="success">
                          #{ticket}
                        </Badge>
                      ))
                    : "—"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card space-y-3">
            <CardHeader className="pb-2">
              <CardTitle>History</CardTitle>
              <CardDescription>Undo/redo or restore from snapshots.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={!canUndo || loading || pendingAction !== null}
                  title="Undo last action"
                >
                  <Undo2 className="size-4" />
                  Undo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRedo}
                  disabled={!canRedo || loading || pendingAction !== null}
                  title="Redo last undone action"
                >
                  <Redo2 className="size-4" />
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
                <label className="text-sm text-foreground" htmlFor="snapshot-select" id="snapshot-label">
                  Restore snapshot
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    id="snapshot-select"
                    className="h-10 min-w-[220px] rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                    value={selectedSnapshot}
                    onChange={(e) => setSelectedSnapshot(e.target.value)}
                    aria-labelledby="snapshot-label"
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
          <Card className="bg-card space-y-3">
            <CardHeader>
              <CardTitle>System reset</CardTitle>
              <CardDescription>
                Clears the range, order, and now serving. State is backed up before reset.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <Label>Cleanup old snapshots</Label>
                {cleanupMessage && (
                  <Alert className="flex items-start gap-2 border-status-success-border bg-status-success-bg">
                    <AlertDescription className="text-status-success-text">
                      {cleanupMessage}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCleanup(7)}
                    disabled={loading || pendingAction !== null}
                  >
                    Keep last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCleanup(30)}
                    disabled={loading || pendingAction !== null}
                  >
                    Keep last 30 days
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Free tier has 512MB limit. Cleanup also runs automatically on reset (30 days).
                </p>
                {cleanupMessage && (
                  <p className="text-xs text-muted-foreground">{cleanupMessage}</p>
                )}
              </div>
              <Separator />
              <Input
                value={resetPhrase}
                onChange={(e) => setResetPhrase(e.target.value)}
                placeholder='Type "RESET" to enable'
              />
              <ConfirmAction
                title="Confirm Lottery Reset"
                description="This will completely clear the current lottery and all client positions. Clients who have seen their numbers will lose their place. Only do this to start a new daily cycle. You can reverse this action by clicking 'Undo' in the History section."
                confirmText="Yes, Reset Lottery"
                confirmVariant="destructive"
                onConfirm={handleReset}
                disabled={resetPhrase !== "RESET" || loading}
                variant="destructive"
              >
                <Button variant="destructive" disabled={resetPhrase !== "RESET" || loading}>
                  Reset for New Day
                </Button>
              </ConfirmAction>
            </CardContent>
          </Card>

          <Card className="bg-card space-y-4">
            <CardHeader>
              <CardTitle>Share the live board</CardTitle>
              <CardDescription>
                Clients can scan to watch updates from anywhere. Works on phones and big screens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-center rounded-xl border border-border bg-card p-4">
                <QRCode value={displayUrl} size={160} />
              </div>
              {!editingUrl ? (
                <>
                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground break-all">
                    {displayUrl}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/">Open display</Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopyLink}>
                      {copied ? "Copied!" : "Copy link"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleEditUrl}>
                      Edit URL
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/"
                      maxLength={64}
                      className={urlError ? "border-destructive" : ""}
                    />
                    {urlError && <p className="text-xs text-destructive">{urlError}</p>}
                    <p className="text-xs text-muted-foreground">{urlInput.length}/64 characters</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="default" size="sm" onClick={handleSaveUrl}>
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResetUrl}>
                      Use browser URL
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {(error || actionError) && (
          <Card className="border-status-danger-border bg-status-danger-bg">
            <CardContent className="flex items-start gap-3">
              <AlertTriangle className="mt-1 size-5 text-status-danger-text" />
              <div>
                <p className="font-semibold text-status-danger-text">Something needs attention</p>
                <p className="text-sm text-status-danger-text">{error ?? actionError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!error && state && (
          <Card className="border-status-success-border bg-status-success-bg">
            <CardContent className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 size-5 text-status-success-text" />
              <div className="space-y-1">
                <p className="font-semibold text-status-success-text">Persistence confirmed</p>
                <p className="text-sm text-status-success-text">
                  Last write: {new Date(state.timestamp ?? Date.now()).toLocaleString()} — backups
                  stored alongside the JSON data.
                </p>
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-status-success-text">
                  <Sparkles className="size-4" />
                  Atomic writes • Backup snapshots • Auto-refresh every 5s
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading state from datastore...
          </div>
        )}
        </main>
      </div>
    </TooltipProvider>
  );
};

export default AdminPage;
