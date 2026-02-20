"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "react-qr-code";
import {
  CalendarClock,
  CheckCircle2,
  DatabaseZap,
  History,
  Loader2,
  MonitorCheck,
  ScanQrCode,
  HandPlatter,
  Ticket,
  TicketCheck,
  TicketPlus,
  TicketSlash,
  TicketX,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "sonner";
import { ArrowLeft } from "@/components/animate-ui/icons/arrow-left";
import { ChevronLeft } from "@/components/animate-ui/icons/chevron-left";
import { ChevronRight } from "@/components/animate-ui/icons/chevron-right";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { AdminAnimatedIcon } from "@/components/admin-animated-icon";

import { ConfirmAction } from "@/components/confirm-action";
import { OperatingHoursEditor } from "@/components/operating-hours-editor";
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
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { Mode, OperatingHours, RaffleState } from "@/lib/state-manager";
import { formatWaitTime } from "@/lib/time-format";
import { shouldWarnTimezoneMismatch } from "@/lib/timezone-utils";

type ActionPayload =
  | { action: "generate"; startNumber: number; endNumber: number; mode: Mode }
  | { action: "append"; endNumber: number }
  | { action: "setMode"; mode: Mode }
  | { action: "updateServing"; currentlyServing: number | null }
  | { action: "advanceServing"; direction: "next" | "prev" }
  | { action: "markReturned"; ticketNumber: number }
  | { action: "markUnclaimed"; ticketNumber: number }
  | { action: "reset" }
  | { action: "undo" }
  | { action: "redo" }
  | { action: "restoreSnapshot"; id: string }
  | { action: "setOperatingHours"; hours: OperatingHours; timezone: string }
  | { action: "generateBatch"; startNumber: number; endNumber: number; batchSize: number };

type Snapshot = {
  id: string;
  timestamp: number;
};

type RangeGenerationControlsProps = {
  state: RaffleState | null;
  hasDrawStarted: boolean;
  isRangeExhausted: boolean;
  loading: boolean;
  pendingAction: string | null;
  onGenerate: (startNumber: number, endNumber: number) => Promise<void>;
  onGenerateBatch: (
    startNumber: number,
    endNumber: number,
    batchSize: number,
  ) => Promise<void>;
};

const RangeGenerationControls = React.memo(function RangeGenerationControls({
  state,
  hasDrawStarted,
  isRangeExhausted,
  loading,
  pendingAction,
  onGenerate,
  onGenerateBatch,
}: RangeGenerationControlsProps) {
  const [rangeForm, setRangeForm] = React.useState({ startNumber: "", endNumber: "" });
  const [batchSize, setBatchSize] = React.useState("10");
  const [batchDialogOpen, setBatchDialogOpen] = React.useState(false);
  const [batchDrawing, setBatchDrawing] = React.useState(false);

  React.useEffect(() => {
    setRangeForm({
      startNumber: state?.startNumber ? String(state.startNumber) : "",
      endNumber: state?.endNumber ? String(state.endNumber) : "",
    });
  }, [state?.startNumber, state?.endNumber]);

  const hasActiveRange = !!state && !(state.startNumber === 0 && state.endNumber === 0);

  const serverUndrawnCount = React.useMemo(() => {
    if (!state || !hasActiveRange) return 0;
    const drawnSet = new Set(state.generatedOrder);
    let count = 0;
    for (let ticket = state.startNumber; ticket <= state.endNumber; ticket += 1) {
      if (!drawnSet.has(ticket)) count += 1;
    }
    return count;
  }, [hasActiveRange, state?.generatedOrder, state?.startNumber, state?.endNumber]);

  const parsedStartNumber = Number(rangeForm.startNumber);
  const parsedEndNumber = Number(rangeForm.endNumber);
  const hasGenerateRangeInputs =
    rangeForm.startNumber.trim() !== "" && rangeForm.endNumber.trim() !== "";
  const hasValidGenerateRange =
    hasGenerateRangeInputs &&
    Number.isInteger(parsedStartNumber) &&
    Number.isInteger(parsedEndNumber) &&
    parsedStartNumber > 0 &&
    parsedEndNumber > 0 &&
    parsedEndNumber > parsedStartNumber;
  const canGenerateFull =
    hasValidGenerateRange &&
    !state?.orderLocked &&
    !loading &&
    pendingAction === null;

  const previewUndrawnCount = React.useMemo(() => {
    if (!state || !hasActiveRange) {
      if (
        Number.isInteger(parsedStartNumber) &&
        Number.isInteger(parsedEndNumber) &&
        parsedEndNumber > parsedStartNumber
      ) {
        return parsedEndNumber - parsedStartNumber + 1;
      }
      return 0;
    }
    if (!hasDrawStarted || serverUndrawnCount === 0) {
      return serverUndrawnCount;
    }
    const previewEnd =
      Number.isInteger(parsedEndNumber) && parsedEndNumber > state.endNumber
        ? parsedEndNumber
        : state.endNumber;
    if (previewEnd === state.endNumber) {
      return serverUndrawnCount;
    }
    // O(1): all tickets beyond current end are necessarily undrawn.
    return serverUndrawnCount + (previewEnd - state.endNumber);
  }, [
    hasActiveRange,
    hasDrawStarted,
    parsedEndNumber,
    parsedStartNumber,
    serverUndrawnCount,
    state?.endNumber,
    state,
  ]);

  const handleGenerateConfirm = async () => {
    await onGenerate(parsedStartNumber, parsedEndNumber);
  };

  const handleGenerateBatchConfirm = async () => {
    const size = Number(batchSize);
    await onGenerateBatch(parsedStartNumber, parsedEndNumber, size);
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start">Start Number</Label>
          <div
            onClick={() => {
              if (hasDrawStarted && state) {
                toast.error(
                  `Start number is locked at ${state.startNumber} after the first draw. Reset to start a new range.`,
                );
              }
            }}
          >
            <Input
              id="start"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={rangeForm.startNumber}
              onChange={(event) =>
                setRangeForm((prev) => ({
                  ...prev,
                  startNumber: event.target.value.replace(/\D/g, "").slice(0, 6),
                }))
              }
              disabled={hasDrawStarted}
              className="appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">End Number</Label>
          <div
            onClick={() => {
              if (isRangeExhausted && hasDrawStarted) {
                toast.error(
                  "All tickets in this range are sorted. Use Append to increase the end number.",
                );
              }
            }}
          >
            <Input
              id="end"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={rangeForm.endNumber}
              onChange={(event) =>
                setRangeForm((prev) => ({
                  ...prev,
                  endNumber: event.target.value.replace(/\D/g, "").slice(0, 6),
                }))
              }
              disabled={isRangeExhausted && hasDrawStarted}
              className="appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      <AlertDialog
        open={batchDialogOpen}
        onOpenChange={(open) => {
          if (!batchDrawing) setBatchDialogOpen(open);
        }}
      >
        <AlertDialogContent className="overflow-x-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>Generate batch from undrawn pool</AlertDialogTitle>
            <AlertDialogDescription>
              Draw a subset of tickets from the {previewUndrawnCount} remaining undrawn tickets
              and append to the draw order. Existing positions will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="batch-size" className="text-sm font-medium">
              Batch size
            </Label>
            <Input
              id="batch-size"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              value={batchSize}
              onChange={(event) =>
                setBatchSize(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="w-28 appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <p className="text-xs text-muted-foreground">{previewUndrawnCount} tickets remaining</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDrawing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setBatchDrawing(true);
                try {
                  await handleGenerateBatchConfirm();
                } finally {
                  setBatchDrawing(false);
                  setBatchDialogOpen(false);
                }
              }}
              disabled={
                batchDrawing ||
                Number(batchSize) <= 0 ||
                !Number.isInteger(Number(batchSize)) ||
                Number(batchSize) > previewUndrawnCount
              }
            >
              {batchDrawing ? "Working..." : "Draw batch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-end gap-3">
        <div
          className="inline-flex"
          onClick={() => {
            if (state?.orderLocked) {
              toast.error(
                "Drawing order is locked. Use \"Reset for New Day\" to start a fresh lottery.",
              );
              return;
            }

            if (loading || pendingAction !== null || canGenerateFull) {
              return;
            }

            if (!hasGenerateRangeInputs) {
              toast.error(
                "Enter both Start Number and End Number before generating the draw order.",
              );
              return;
            }

            if (parsedEndNumber <= parsedStartNumber) {
              toast.error(
                "End Number must be greater than Start Number.",
              );
              return;
            }

            toast.error(
              "Start Number and End Number must be whole numbers greater than 0.",
            );
          }}
        >
          <ConfirmAction
            triggerLabel="Generate full"
            actionLabel="Generate"
            title="Generate ticket order"
            description="Creates a fresh order for the selected range and mode."
            onConfirm={handleGenerateConfirm}
            disabled={!canGenerateFull}
            triggerTitle={
              state?.orderLocked
                ? "Order locked. Use Reset to start new lottery."
                : !hasGenerateRangeInputs
                  ? "Enter both Start Number and End Number first."
                  : parsedEndNumber <= parsedStartNumber
                    ? "End Number must be greater than Start Number."
                    : !hasValidGenerateRange
                      ? "Start and End must be whole numbers greater than 0."
                      : undefined
            }
          />
        </div>
        <Button
          variant="outline"
          disabled={loading || pendingAction !== null || previewUndrawnCount === 0}
          onClick={() => setBatchDialogOpen(true)}
        >
          Generate batch
        </Button>
      </div>
    </>
  );
});

type ResetActionControlsProps = {
  loading: boolean;
  pendingAction: string | null;
  onReset: () => Promise<void>;
};

const ResetActionControls = React.memo(function ResetActionControls({
  loading,
  pendingAction,
  onReset,
}: ResetActionControlsProps) {
  const [resetPhrase, setResetPhrase] = React.useState("");
  const canReset = resetPhrase === "RESET" && !loading && pendingAction === null;

  return (
    <>
      <Input
        value={resetPhrase}
        onChange={(event) => setResetPhrase(event.target.value)}
        placeholder='Type "RESET" to enable'
      />
      <ConfirmAction
        title="Confirm Lottery Reset"
        description="This will completely clear the current lottery and all client positions. Clients who have seen their numbers will lose their place. Only do this to start a new daily cycle. You can reverse this action by clicking 'Undo' in the History section."
        confirmText="Yes, Reset Lottery"
        confirmVariant="destructive"
        onConfirm={async () => {
          await onReset();
          setResetPhrase("");
        }}
        disabled={!canReset}
        variant="destructive"
      >
        <Button variant="destructive" disabled={!canReset}>
          Reset for New Day
        </Button>
      </ConfirmAction>
    </>
  );
});

const AdminPage = () => {
  const [state, setState] = React.useState<RaffleState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>("random");
  const [appendEnd, setAppendEnd] = React.useState("");
  const [returnedTicket, setReturnedTicket] = React.useState("");
  const [unclaimedTicket, setUnclaimedTicket] = React.useState("");
  const [modeConfirmOpen, setModeConfirmOpen] = React.useState(false);
  const [pendingModeChoice, setPendingModeChoice] = React.useState<Mode | null>(null);
  const [modeChanging, setModeChanging] = React.useState(false);
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
  const [pendingHours, setPendingHours] = React.useState<OperatingHours | null>(null);
  const [pendingTimezone, setPendingTimezone] = React.useState<string>("America/Los_Angeles");
  const [timezoneMismatchOpen, setTimezoneMismatchOpen] = React.useState(false);
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
      const message =
        err instanceof Error ? err.message : "Unexpected error while loading state.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Re-fetch state when the tab regains focus (e.g., staff switching back from another tab)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchState();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
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

  // Derive canUndo from the already-loaded snapshots array (no extra fetch needed)
  React.useEffect(() => {
    setCanUndo(snapshots.length >= 2);
  }, [snapshots]);

  React.useEffect(() => {
    if (!state) return;
    setMode(state.mode);
    setAppendEnd(state.endNumber ? String(state.endNumber + 1) : "");
  }, [state]);

  React.useEffect(() => {
    if (state?.operatingHours) {
      setPendingHours(state.operatingHours);
    }
    if (state?.timezone) {
      setPendingTimezone(state.timezone);
    }
  }, [state?.operatingHours, state?.timezone]);

  const sendAction = React.useCallback(
    async (payload: ActionPayload) => {
      setPendingAction(payload.action);
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
        toast.error(message);
        throw err;
      } finally {
        setPendingAction(null);
      }
    },
    [refreshSnapshots],
  );

  const handleGenerate = React.useCallback(async (start: number, end: number) => {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      toast.error("Start and end must be whole numbers.");
      throw new Error("Invalid input");
    }
    await sendAction({ action: "generate", startNumber: start, endNumber: end, mode });
  }, [mode, sendAction]);

  const handleGenerateBatch = React.useCallback(async (
    start: number,
    end: number,
    size: number,
  ) => {
    if (!Number.isInteger(size) || size <= 0) {
      toast.error("Batch size must be a positive whole number.");
      throw new Error("Invalid input");
    }
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      toast.error("Start and end must be whole numbers.");
      throw new Error("Invalid input");
    }
    await sendAction({
      action: "generateBatch",
      startNumber: start,
      endNumber: end,
      batchSize: size,
    });
  }, [sendAction]);

  const handleAppend = async () => {
    const newEnd = Number(appendEnd);
    if (!Number.isInteger(newEnd)) {
      toast.error("Append value must be a whole number.");
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

  const handleReset = React.useCallback(async () => {
    await sendAction({ action: "reset" });
  }, [sendAction]);

  const saveOperatingHours = React.useCallback(async () => {
    if (!pendingHours) return;
    await sendAction({ action: "setOperatingHours", hours: pendingHours, timezone: pendingTimezone });
  }, [pendingHours, pendingTimezone, sendAction]);

  const handleSaveOperatingHours = async () => {
    if (!pendingHours) return;
    if (shouldWarnTimezoneMismatch(pendingTimezone)) {
      setTimezoneMismatchOpen(true);
      return;
    }
    await saveOperatingHours();
  };

  const handleConfirmTimezoneMismatch = async () => {
    setTimezoneMismatchOpen(false);
    await saveOperatingHours();
  };

  const handleCleanup = async (days: number) => {
    setCleanupMessage(null);
    setPendingAction("cleanup");
    try {
      const response = await fetch("/api/state/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays: days }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data?.error || "Cleanup failed. Please try again.");
        return;
      }
      setCleanupMessage(
        `Deleted ${data.deletedCount} snapshots older than ${data.retentionDays} days.`,
      );
	} catch {
	  toast.error("Cleanup request failed.");
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
      toast.error("Unable to copy link to clipboard.");
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
      toast.error("URL must be 64 characters or less");
      return;
    }
	try {
	  const parsedUrl = new URL(urlInput);
	  void parsedUrl;
	} catch {
	  setUrlError("Invalid URL format");
    toast.error("Invalid URL format");
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
        const message = data.error || "Failed to save URL";
        setUrlError(message);
        toast.error(message);
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
      toast.error("Failed to save URL");
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
      toast.error("Failed to reset URL");
    }
  };

  const handleCancelEdit = () => {
    setEditingUrl(false);
    setUrlError("");
  };

  // --- Memoized derived values (avoid recomputation on every keystroke) ---

  const returnedTickets = React.useMemo(() => {
    if (!state?.ticketStatus) return [];
    return Object.entries(state.ticketStatus)
      .filter(([, status]) => status === "returned")
      .map(([ticket]) => Number(ticket))
      .filter((ticket) => Number.isInteger(ticket))
      .sort((a, b) => a - b);
  }, [state?.ticketStatus]);

  const unclaimedTickets = React.useMemo(() => {
    if (!state?.ticketStatus) return [];
    return Object.entries(state.ticketStatus)
      .filter(([, status]) => status === "unclaimed")
      .map(([ticket]) => Number(ticket))
      .filter((ticket) => Number.isInteger(ticket))
      .sort((a, b) => a - b);
  }, [state?.ticketStatus]);

  const currentIndex = React.useMemo(
    () =>
      state?.generatedOrder && state.currentlyServing !== null
        ? state.generatedOrder.indexOf(state.currentlyServing)
        : -1,
    [state?.generatedOrder, state?.currentlyServing],
  );

  const currentDrawNumber = currentIndex >= 0 ? currentIndex + 1 : null;
  const totalTickets = state?.generatedOrder.length ?? 0;
  const currentTicket =
    currentIndex >= 0 && state?.generatedOrder ? state.generatedOrder[currentIndex] : null;

  const nextFive = React.useMemo(() => {
    if (!state?.generatedOrder) return [];
    return state.generatedOrder.slice(
      Math.max(0, currentIndex >= 0 ? currentIndex + 1 : 0),
      currentIndex >= 0 ? currentIndex + 6 : 5,
    );
  }, [state?.generatedOrder, currentIndex]);

  const { nextServingIndex, prevServingIndex } = React.useMemo(() => {
    const getNextNonReturnedIndex = (startIdx: number, step: 1 | -1) => {
      if (!state?.generatedOrder?.length) return -1;
      const order = state.generatedOrder;
      const status = state.ticketStatus ?? {};
      for (let i = startIdx + step; i >= 0 && i < order.length; i += step) {
        if (status[order[i]] !== "returned") return i;
      }
      return -1;
    };
    return {
      nextServingIndex: getNextNonReturnedIndex(currentIndex, 1),
      prevServingIndex:
        currentIndex === -1
          ? getNextNonReturnedIndex(-1, 1)
          : getNextNonReturnedIndex(currentIndex, -1),
    };
  }, [state?.generatedOrder, state?.ticketStatus, currentIndex]);

  const canAdvanceNext = totalTickets > 0 && nextServingIndex !== -1;
  const canAdvancePrev = totalTickets > 0 && prevServingIndex !== -1;

  const ticketsCalled = React.useMemo(() => {
    if (!state?.generatedOrder || currentIndex < 0) return 0;
    let count = 0;
    for (let i = 0; i <= currentIndex; i++) {
      const ticket = state.generatedOrder[i];
      if (state.ticketStatus?.[ticket] !== "returned") count++;
    }
    return count;
  }, [state?.generatedOrder, state?.ticketStatus, currentIndex]);

  const peopleWaiting = React.useMemo(() => {
    if (!state?.generatedOrder || currentIndex < 0) return totalTickets;
    let count = 0;
    for (let i = currentIndex + 1; i < state.generatedOrder.length; i++) {
      const ticket = state.generatedOrder[i];
      if (state.ticketStatus?.[ticket] !== "returned") count++;
    }
    return count;
  }, [state?.generatedOrder, state?.ticketStatus, currentIndex, totalTickets]);

  // Max wait time: ETA for the last person in the queue
  // Uses the same 2.2 min/ticket constant as the public display (readonly-display.tsx:307)
  const MINUTES_PER_TICKET = 2.2;
  const maxWaitMinutes = peopleWaiting > 0 ? Math.round(peopleWaiting * MINUTES_PER_TICKET) : null;

  // Shared drawn set — built once per server state change.
  const drawnSet = React.useMemo(
    () => new Set(state?.generatedOrder ?? []),
    [state?.generatedOrder],
  );

  // Server-derived undrawn count (stable between mutations — does NOT depend on form keystrokes)
  const serverUndrawnCount = React.useMemo(() => {
    if (!state || (state.startNumber === 0 && state.endNumber === 0)) return 0;
    let count = 0;
    for (let i = state.startNumber; i <= state.endNumber; i++) {
      if (!drawnSet.has(i)) count++;
    }
    return count;
  }, [state?.startNumber, state?.endNumber, drawnSet]);

  const undrawnCount = serverUndrawnCount;

  const hasDrawStarted = (state?.generatedOrder.length ?? 0) > 0;
  const isRangeExhausted = hasDrawStarted && undrawnCount === 0;

  const canAppend = !!state && !!appendEnd && !loading && undrawnCount === 0;
  const hasActiveRange = !!state && !(state.startNumber === 0 && state.endNumber === 0);
  const ticketsIssued =
    hasActiveRange && state ? state.endNumber - state.startNumber + 1 : null;
  const appendMin = (state?.endNumber ?? 0) + 1;
  const parsedAppendValue = Number(appendEnd);
  const resolvedAppendValue =
    Number.isFinite(parsedAppendValue) && appendEnd.trim() !== ""
      ? parsedAppendValue
      : appendMin;
  const parsedReturnedNumber = Number(returnedTicket);
  const canMarkReturned =
    Number.isInteger(parsedReturnedNumber) &&
    parsedReturnedNumber > 0 &&
    returnedTicket.trim() !== "";
  const returnedTicketLabel = returnedTicket ? `#${returnedTicket}` : "this ticket";
  const parsedUnclaimedNumber = Number(unclaimedTicket);
  const canMarkUnclaimed =
    Number.isInteger(parsedUnclaimedNumber) &&
    parsedUnclaimedNumber > 0 &&
    unclaimedTicket.trim() !== "";
  const unclaimedTicketLabel = unclaimedTicket ? `#${unclaimedTicket}` : "this ticket";

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
      toast.error("Generate tickets first.");
      return;
    }
    if (index === null) {
      try {
        await sendAction({ action: "updateServing", currentlyServing: null });
      } catch {
        // sendAction already surfaced the error toast
      }
      return;
    }
    const clamped = Math.max(0, Math.min(index, totalTickets - 1));
    const ticket = state.generatedOrder[clamped];
    try {
      await sendAction({ action: "updateServing", currentlyServing: ticket });
    } catch {
      // sendAction already surfaced the error toast
    }
  };

  const handlePrevServing = async () => {
    if (!state || totalTickets === 0) return;
    try {
      await sendAction({ action: "advanceServing", direction: "prev" });
    } catch {
      // sendAction already surfaced the error toast
    }
  };

  const handleNextServing = async () => {
    if (!state || totalTickets === 0) return;
    try {
      await sendAction({ action: "advanceServing", direction: "next" });
    } catch {
      // sendAction already surfaced the error toast
    }
  };

  const handleMarkReturned = async () => {
    const ticketNumber = Number(returnedTicket);
    if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
      toast.error("Ticket number must be a whole number.");
      throw new Error("Invalid input");
    }
    if (!state) {
      toast.error("Generate tickets first.");
      throw new Error("Missing state");
    }
    if (ticketNumber < state.startNumber || ticketNumber > state.endNumber) {
      toast.error("Ticket number must be within the active range.");
      throw new Error("Out of range");
    }
    await sendAction({ action: "markReturned", ticketNumber });
    setReturnedTicket("");
  };

  const handleMarkUnclaimed = async () => {
    const ticketNumber = Number(unclaimedTicket);
    if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
      toast.error("Ticket number must be a whole number.");
      throw new Error("Invalid input");
    }
    if (!state) {
      toast.error("Generate tickets first.");
      throw new Error("Missing state");
    }
    if (ticketNumber < state.startNumber || ticketNumber > state.endNumber) {
      toast.error("Ticket number must be within the active range.");
      throw new Error("Out of range");
    }
    if (state.generatedOrder.length === 0) {
      toast.error("Generate tickets first.");
      throw new Error("Missing order");
    }

    const currentIndex =
      state.currentlyServing !== null
        ? state.generatedOrder.indexOf(state.currentlyServing)
        : -1;
    if (currentIndex === -1) {
      toast.error("No draw position has been called yet.");
      throw new Error("No draw position");
    }

    const ticketIndex = state.generatedOrder.indexOf(ticketNumber);
    if (ticketIndex === -1) {
      toast.error("Ticket number is not in the current order.");
      throw new Error("Missing ticket");
    }
    if (ticketIndex > currentIndex) {
      toast.error("Ticket must be called before it can be marked unclaimed.");
      throw new Error("Ticket not called");
    }

    await sendAction({ action: "markUnclaimed", ticketNumber });
    setUnclaimedTicket("");
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
      toast.error(error instanceof Error ? error.message : "Undo failed");
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
      toast.error(error instanceof Error ? error.message : "Redo failed");
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
            width={2314}
            height={606}
            className="block h-auto w-full max-w-[320px] dark:hidden"
            priority
          />
          <Image
            src="/wth-logo-horizontal-reverse.png"
            alt="William Temple House"
            width={2333}
            height={641}
            className="hidden h-auto w-full max-w-[320px] dark:block"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/staff">
              <ArrowLeft className="mr-2 size-4" animateOnHover animateOnTap animateOnView />
              Back
            </Link>
          </Button>
          {pendingAction && (
            <Badge
              variant="success"
              className="flex items-center gap-2 animate-pulse-subtle"
            >
              <Loader2 className="size-3" />
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
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="size-4 text-muted-foreground" />
                  Ticket Range & Order
                </CardTitle>
                <CardDescription>
                  Set the starting and ending ticket numbers, then generate the order. After the
                  first draw, Start locks and End can only move forward while batch draws remain.
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

              <RangeGenerationControls
                state={state}
                hasDrawStarted={hasDrawStarted}
                isRangeExhausted={isRangeExhausted}
                loading={loading}
                pendingAction={pendingAction}
                onGenerate={handleGenerate}
                onGenerateBatch={handleGenerateBatch}
              />

              <Separator />

              <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                <div className="space-y-2 sm:col-span-2">
                  <Label
                    htmlFor="append"
                    className="flex items-center gap-2 text-sm font-medium text-foreground"
                  >
                    <TicketPlus className="size-4 text-muted-foreground" />
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
                      disabled={!state || undrawnCount > 0}
                      className="w-28 flex-none appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:w-40"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleAppendStep(-1)}
                      disabled={!state || undrawnCount > 0}
                      aria-label="Decrease append end"
                      className={!state || undrawnCount > 0 || resolvedAppendValue <= appendMin ? "flex-none opacity-50" : "flex-none"}
                    >
                      <ChevronLeft className="size-4" animateOnHover animateOnTap animateOnView />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleAppendStep(1)}
                      disabled={!state || undrawnCount > 0}
                      aria-label="Increase append end"
                      className="flex-none"
                    >
                      <ChevronRight className="size-4" animateOnHover animateOnTap animateOnView />
                    </Button>
                  </div>
                  <div
                    className="inline-flex"
                    onClick={() => {
                      if (undrawnCount > 0) {
                        toast.error(
                          `All tickets must be drawn before appending. ${undrawnCount} ticket${undrawnCount === 1 ? " remains" : "s remain"} undrawn.`,
                        );
                      }
                    }}
                  >
                    <ConfirmAction
                      triggerLabel="Append"
                      actionLabel="Append and draw tickets"
                      title="Append tickets"
                      description={`Extend the ticket range from ${state?.endNumber ?? "?"} to ${appendEnd || "?"}. Tickets will be added to the queue ${state?.mode === "sequential" ? "sequentially" : "randomly"}.`}
                      onConfirm={handleAppend}
                      disabled={!canAppend}
                      variant="default"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card space-y-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HandPlatter className="size-4 text-muted-foreground" />
                Now Serving
              </CardTitle>
              <CardDescription>
                Step through the draw order using arrows. Positions are first, second, third, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-gradient-card-info p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <TicketCheck className="size-4" />
                    Draw position
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    Ticket {currentTicket ? `#${currentTicket}` : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Draw position {currentDrawNumber ? formatOrdinal(currentDrawNumber) : "—"} of{" "}
                    {totalTickets || "—"}
                  </p>
                </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handlePrevServing}
                  disabled={loading || !state || !canAdvancePrev}
                  aria-label="Previous draw"
                  className={!canAdvancePrev ? "opacity-50" : ""}
                >
                  <ChevronLeft className="size-4" animateOnHover animateOnTap animateOnView />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleNextServing}
                  disabled={loading || !state || !canAdvanceNext}
                  aria-label="Next draw"
                  className={!canAdvanceNext ? "opacity-50" : ""}
                >
                  <ChevronRight className="size-4" animateOnHover animateOnTap animateOnView />
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

            <div className="ticket-returned space-y-3 rounded-lg border p-4">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-current">
                  <TicketX className="size-4" />
                  Mark ticket as returned
                </p>
                <p className="text-xs text-current">
                  Use when a client returns their ticket and leaves the line. You can undo this action.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="returned-ticket">Ticket number</Label>
                  <Input
                    id="returned-ticket"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={returnedTicket}
                    onChange={(e) =>
                      setReturnedTicket(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="w-32 bg-background appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <ConfirmAction
                  triggerLabel="Mark ticket"
                  actionLabel="Mark ticket"
                  title="Mark ticket as returned"
                  description={`This will mark ${returnedTicketLabel} as returned so it no longer counts in the active queue. You can undo this action.`}
                  onConfirm={handleMarkReturned}
                  disabled={!canMarkReturned || loading || pendingAction !== null}
                  variant="default"
                />
              </div>
            </div>

            <div className="ticket-unclaimed space-y-3 rounded-lg border p-4">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-current">
                  <TicketSlash className="size-4" />
                  Mark ticket as unclaimed
                </p>
                <p className="text-xs text-current">
                  Use when no client has claimed a ticket after it was called. You can undo this action.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="unclaimed-ticket">Ticket number</Label>
                  <Input
                    id="unclaimed-ticket"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={unclaimedTicket}
                    onChange={(e) =>
                      setUnclaimedTicket(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="w-32 bg-background appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <ConfirmAction
                  triggerLabel="Mark ticket"
                  actionLabel="Mark ticket"
                  title="Mark ticket as unclaimed"
                  description={`This will mark ${unclaimedTicketLabel} as unclaimed so it no longer counts in the active queue. You can undo this action.`}
                  onConfirm={handleMarkUnclaimed}
                  disabled={!canMarkUnclaimed || loading || pendingAction !== null}
                  variant="default"
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
                <CardTitle className="flex items-center gap-2">
                  <MonitorCheck className="size-4 text-muted-foreground" />
                  Live State
                </CardTitle>
                <CardDescription>Summary status for today&apos;s raffle drawing.</CardDescription>
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
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {/* Row 1: 3 columns */}
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3 lg:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Range</p>
                <p className="text-lg font-semibold text-status-success-text">
                  {state?.startNumber || "—"} – {state?.endNumber || "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3 lg:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tickets issued</p>
                <p className="text-lg font-semibold text-status-success-text">
                  {ticketsIssued ?? "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3 sm:col-span-2 lg:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Current mode</p>
                <p className="text-lg font-semibold text-status-success-text capitalize">
                  {state?.mode}
                </p>
              </div>
              {/* Row 2: 2 columns */}
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3 lg:col-span-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Now serving</p>
                <p className="text-lg font-semibold text-status-success-text">
                  {state?.currentlyServing ?? "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3 lg:col-span-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Max wait time</p>
                <p className="text-lg font-semibold text-status-success-text">
                  {maxWaitMinutes !== null ? formatWaitTime(maxWaitMinutes, "en") : "—"}
                </p>
              </div>
              {/* Row 3: 2 columns */}
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3 lg:col-span-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tickets called</p>
                <p className="text-lg font-semibold text-status-success-text">
                  {state?.generatedOrder?.length ? ticketsCalled : "—"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-gradient-card-accent p-3 lg:col-span-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">People waiting</p>
                <p className="text-lg font-semibold text-status-success-text">
                  {state?.generatedOrder?.length ? peopleWaiting : "—"}
                </p>
              </div>
              {/* Row 4: full width */}
              <div className="space-y-1 rounded-lg border border-status-success-border bg-status-success-bg p-3 sm:col-span-2 lg:col-span-6">
                <p className="text-xs uppercase tracking-wide text-status-success-text">Next up</p>
                <div className="flex flex-wrap gap-2">
                    {nextFive?.length
                    ? nextFive.map((ticket, idx) => (
                        <Badge key={ticket} variant="success" className="animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                          #{ticket}
                        </Badge>
                      ))
                    : <span className="text-status-success-text">—</span>}
                </div>
              </div>
              {/* Row 5: full width */}
              <div className="space-y-1 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 sm:col-span-2 lg:col-span-6">
                <p className="text-xs uppercase tracking-wide text-[var(--status-danger-text)]">Returned tickets</p>
                <div className="flex flex-wrap gap-2">
                    {returnedTickets.length
                    ? returnedTickets.map((ticket, idx) => (
                        <Badge key={ticket} variant="danger" className="animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                          #{ticket}
                        </Badge>
                      ))
                    : "—"}
                </div>
              </div>
              {/* Row 6: full width */}
              <div className="space-y-1 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 sm:col-span-2 lg:col-span-6">
                <p className="text-xs uppercase tracking-wide text-[var(--status-warning-text)]">Unclaimed tickets</p>
                <div className="flex flex-wrap gap-2">
                    {unclaimedTickets.length
                    ? unclaimedTickets.map((ticket, idx) => (
                        <Badge key={ticket} variant="warning" className="animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
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
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                History
              </CardTitle>
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
                  <AdminAnimatedIcon>
                    <Undo2 className="size-4" />
                  </AdminAnimatedIcon>
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
                  <AdminAnimatedIcon>
                    <Redo2 className="size-4" />
                  </AdminAnimatedIcon>
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
              <CardTitle className="flex items-center gap-2">
                <DatabaseZap className="size-4 text-muted-foreground" />
                System reset
              </CardTitle>
              <CardDescription>
                Clears the range, order, and now serving. State is backed up before reset.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <Label>Cleanup old snapshots</Label>
                <div className="flex flex-wrap gap-2">
                  <ConfirmAction
                    triggerLabel="Keep last 7 days"
                    actionLabel="Delete old snapshots"
                    title="Delete snapshots older than 7 days"
                    description="This will permanently delete all snapshots older than 7 days. This cannot be undone, but your last 7 days of history remain for undo/redo."
                    confirmText="Yes, delete old snapshots"
                    confirmVariant="destructive"
                    onConfirm={() => handleCleanup(7)}
                    disabled={loading || pendingAction !== null}
                    variant="outline"
                    size="sm"
                  />
                  <ConfirmAction
                    triggerLabel="Keep last 30 days"
                    actionLabel="Delete old snapshots"
                    title="Delete snapshots older than 30 days"
                    description="This will permanently delete all snapshots older than 30 days. This cannot be undone, but your last 30 days of history remain for undo/redo."
                    confirmText="Yes, delete old snapshots"
                    confirmVariant="destructive"
                    onConfirm={() => handleCleanup(30)}
                    disabled={loading || pendingAction !== null}
                    variant="outline"
                    size="sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Free tier has 512MB limit. Cleanup also runs automatically on reset (30 days).
                </p>
                {cleanupMessage && (
                  <Alert className="flex items-start gap-2 border-status-success-border bg-status-success-bg">
                    <AlertDescription className="text-status-success-text">
                      {cleanupMessage}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <Separator />
              <ResetActionControls
                loading={loading}
                pendingAction={pendingAction}
                onReset={handleReset}
              />
            </CardContent>
          </Card>

          <Card className="bg-card space-y-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanQrCode className="size-4 text-muted-foreground" />
                Share the live board
              </CardTitle>
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

          <Card className="bg-card space-y-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" />
                Set operating hours
              </CardTitle>
              <CardDescription>
                Choose open days and hours so clients know when the pantry is available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingHours ? (
                <OperatingHoursEditor
                  hours={pendingHours}
                  timezone={pendingTimezone}
                  onChange={setPendingHours}
                  onTimezoneChange={setPendingTimezone}
                  disabled={loading || pendingAction !== null}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading hours…</p>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveOperatingHours}
                disabled={!pendingHours || loading || pendingAction !== null}
              >
                Save operating hours
              </Button>
              <AlertDialog open={timezoneMismatchOpen} onOpenChange={setTimezoneMismatchOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm timezone selection</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your device timezone does not match the pantry timezone. The timezone should
                      match the location of services. Continue anyway?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={pendingAction !== null}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleConfirmTimezoneMismatch}
                      disabled={pendingAction !== null}
                    >
                      Continue and Save
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>

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
                  Atomic writes • Backup snapshots
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4" />{" "}
            Loading state from datastore...
          </div>
        )}
        </main>
      </div>
    </TooltipProvider>
  );
};

export default AdminPage;
