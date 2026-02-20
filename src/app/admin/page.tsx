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
import { ArchiveIcon, type ArchiveIconHandle } from "@/components/lucide-animated/archive";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { defaultState, type Mode, type OperatingHours, type RaffleState } from "@/lib/state-types";
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
  | { action: "setDisplayUrl"; url: string | null }
  | { action: "setOperatingHours"; hours: OperatingHours; timezone: string }
  | { action: "generateBatch"; startNumber: number; endNumber: number; batchSize: number };

type Snapshot = {
  id: string;
  timestamp: number;
};

const SNAPSHOT_RENDER_PAGE_SIZE = 100;
const DRAW_SNAPSHOT_REFRESH_DELAY_MS = 1500;
const ARCHIVE_ICON_RESET_DELAY_MS = 260;

type DrawNavigationPayload = Extract<
  ActionPayload,
  { action: "advanceServing" | "updateServing" }
>;

type OptimisticActionKind = ActionPayload["action"];

type OptimisticPatch = {
  id: string;
  kind: OptimisticActionKind;
  apply: (state: RaffleState) => RaffleState;
};

type InFlightAction = {
  id: string;
  payload: ActionPayload;
};

type OptimisticDispatchItem = {
  id: string;
  payload: ActionPayload;
  patch: OptimisticPatch | null;
  resolve: (state: RaffleState) => void;
  reject: (reason: unknown) => void;
};

type QueuedDrawAction = {
  id: string;
  payload: DrawNavigationPayload;
  patch: OptimisticPatch | null;
  resolve: (state: RaffleState) => void;
  reject: (reason: unknown) => void;
};

const buildSequentialRange = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const hasConfiguredRange = (state: RaffleState) =>
  !(state.startNumber === 0 && state.endNumber === 0);

const countUndrawnTickets = (state: RaffleState) => {
  if (!hasConfiguredRange(state)) return 0;
  const drawnSet = new Set(state.generatedOrder);
  let count = 0;
  for (let ticket = state.startNumber; ticket <= state.endNumber; ticket += 1) {
    if (!drawnSet.has(ticket)) count += 1;
  }
  return count;
};

const isDrawNavigationPayload = (
  payload: ActionPayload | null | undefined,
): payload is DrawNavigationPayload =>
  payload?.action === "advanceServing" || payload?.action === "updateServing";

const applyAdvanceServingOptimistic = (
  state: RaffleState,
  direction: "next" | "prev",
): RaffleState => {
  if (!hasConfiguredRange(state) || state.generatedOrder.length === 0) return state;
  const order = state.generatedOrder;
  const status = state.ticketStatus ?? {};
  const currentIndex =
    state.currentlyServing !== null ? order.indexOf(state.currentlyServing) : -1;
  const step = direction === "next" ? 1 : -1;
  const startIndex = currentIndex === -1 ? -1 : currentIndex;

  const findNextIndex = (start: number, stepValue: number) => {
    for (let i = start + stepValue; i >= 0 && i < order.length; i += stepValue) {
      const ticketNumber = order[i];
      if (status[ticketNumber] !== "returned") return i;
    }
    return -1;
  };

  const nextIndex =
    direction === "prev" && currentIndex === -1
      ? findNextIndex(-1, 1)
      : findNextIndex(startIndex, step);

  if (nextIndex === -1) return state;
  const nextTicket = order[nextIndex];
  if (nextTicket === state.currentlyServing) return state;

  const nextCalledAt = { ...(state.calledAt ?? {}) };
  nextCalledAt[nextTicket] = Date.now();

  return {
    ...state,
    currentlyServing: nextTicket,
    calledAt: nextCalledAt,
  };
};

const applyUpdateServingOptimistic = (
  state: RaffleState,
  currentlyServing: number | null,
): RaffleState => {
  if (!hasConfiguredRange(state)) return state;
  if (
    currentlyServing !== null &&
    (currentlyServing < state.startNumber || currentlyServing > state.endNumber)
  ) {
    return state;
  }

  const nextCalledAt = { ...(state.calledAt ?? {}) };
  if (currentlyServing !== null) {
    nextCalledAt[currentlyServing] = Date.now();
  }

  return {
    ...state,
    currentlyServing,
    calledAt: nextCalledAt,
  };
};

const applyMarkReturnedOptimistic = (
  state: RaffleState,
  ticketNumber: number,
): RaffleState => {
  if (!hasConfiguredRange(state) || state.generatedOrder.length === 0) return state;
  if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) return state;
  if (ticketNumber < state.startNumber || ticketNumber > state.endNumber) return state;

  const nextStatus = {
    ...(state.ticketStatus ?? {}),
    [ticketNumber]: "returned",
  } as RaffleState["ticketStatus"];
  let nextServing = state.currentlyServing;
  const nextCalledAt = { ...(state.calledAt ?? {}) };

  if (ticketNumber === state.currentlyServing) {
    const currentIndex = state.generatedOrder.indexOf(ticketNumber);
    if (currentIndex !== -1) {
      nextServing = null;
      for (let i = currentIndex + 1; i < state.generatedOrder.length; i += 1) {
        const nextTicket = state.generatedOrder[i];
        if (nextStatus[nextTicket] !== "returned") {
          nextServing = nextTicket;
          nextCalledAt[nextTicket] = Date.now();
          break;
        }
      }
    }
  }

  return {
    ...state,
    ticketStatus: nextStatus,
    currentlyServing: nextServing,
    calledAt: nextCalledAt,
  };
};

const applyMarkUnclaimedOptimistic = (
  state: RaffleState,
  ticketNumber: number,
): RaffleState => {
  if (!hasConfiguredRange(state) || state.generatedOrder.length === 0) return state;
  if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) return state;
  if (ticketNumber < state.startNumber || ticketNumber > state.endNumber) return state;

  const currentIndex =
    state.currentlyServing !== null
      ? state.generatedOrder.indexOf(state.currentlyServing)
      : -1;
  if (currentIndex === -1) return state;

  const ticketIndex = state.generatedOrder.indexOf(ticketNumber);
  if (ticketIndex === -1 || ticketIndex > currentIndex) return state;

  const nextStatus = {
    ...(state.ticketStatus ?? {}),
    [ticketNumber]: "unclaimed",
  } as RaffleState["ticketStatus"];

  return {
    ...state,
    ticketStatus: nextStatus,
  };
};

const applySetModeOptimistic = (state: RaffleState, mode: Mode): RaffleState => {
  if (!hasConfiguredRange(state)) {
    return { ...state, mode };
  }

  if (state.generatedOrder.length === 0 && mode === "sequential") {
    return {
      ...state,
      mode,
      generatedOrder: buildSequentialRange(state.startNumber, state.endNumber),
    };
  }

  return {
    ...state,
    mode,
  };
};

const applyResetOptimistic = (state: RaffleState): RaffleState => ({
  ...defaultState,
  ticketStatus: {},
  calledAt: {},
  operatingHours: state.operatingHours ?? defaultState.operatingHours,
  timezone: state.timezone ?? defaultState.timezone,
});

const applyGenerateSequentialOptimistic = (
  state: RaffleState,
  startNumber: number,
  endNumber: number,
): RaffleState => {
  if (state.orderLocked) return state;
  if (!Number.isInteger(startNumber) || !Number.isInteger(endNumber)) return state;
  if (startNumber <= 0 || endNumber <= 0 || endNumber <= startNumber) return state;

  return {
    ...state,
    startNumber,
    endNumber,
    mode: "sequential",
    generatedOrder: buildSequentialRange(startNumber, endNumber),
    currentlyServing: null,
    ticketStatus: {},
    calledAt: {},
    orderLocked: true,
    displayUrl: state.displayUrl ?? null,
    operatingHours: state.operatingHours ?? defaultState.operatingHours,
    timezone: state.timezone ?? defaultState.timezone,
  };
};

const applyGenerateBatchSequentialOptimistic = (
  state: RaffleState,
  startNumber: number,
  endNumber: number,
  batchSize: number,
): RaffleState => {
  if (!Number.isInteger(batchSize) || batchSize <= 0) return state;

  const hasRange = hasConfiguredRange(state);
  let effectiveStart = state.startNumber;
  let effectiveEnd = state.endNumber;

  if (!hasRange) {
    if (!Number.isInteger(startNumber) || !Number.isInteger(endNumber)) return state;
    if (startNumber <= 0 || endNumber <= 0 || endNumber <= startNumber) return state;
    effectiveStart = startNumber;
    effectiveEnd = endNumber;
  } else {
    if (startNumber !== state.startNumber) return state;
    if (!Number.isInteger(endNumber) || endNumber <= 0) return state;
    if (endNumber < state.endNumber) return state;
    effectiveStart = state.startNumber;
    effectiveEnd = endNumber;
  }

  const drawn = new Set(state.generatedOrder);
  const pool = buildSequentialRange(effectiveStart, effectiveEnd).filter(
    (ticket) => !drawn.has(ticket),
  );
  if (pool.length === 0 || batchSize > pool.length) return state;

  return {
    ...state,
    startNumber: effectiveStart,
    endNumber: effectiveEnd,
    generatedOrder: [...state.generatedOrder, ...pool.slice(0, batchSize)],
    orderLocked: true,
  };
};

const applyAppendSequentialOptimistic = (
  state: RaffleState,
  endNumber: number,
): RaffleState => {
  if (!hasConfiguredRange(state)) return state;
  if (!Number.isInteger(endNumber) || endNumber <= 0) return state;
  if (endNumber <= state.endNumber) return state;
  if (countUndrawnTickets(state) > 0) return state;

  const additions = buildSequentialRange(state.endNumber + 1, endNumber);
  return {
    ...state,
    endNumber,
    generatedOrder: [...state.generatedOrder, ...additions],
  };
};

const applySetDisplayUrlOptimistic = (
  state: RaffleState,
  url: string | null,
): RaffleState => ({
  ...state,
  displayUrl: url,
});

const applySetOperatingHoursOptimistic = (
  state: RaffleState,
  hours: OperatingHours,
  timezone: string,
): RaffleState => ({
  ...state,
  operatingHours: hours,
  timezone,
});

const buildOptimisticPatch = (
  id: string,
  payload: ActionPayload,
  currentState: RaffleState | null,
): OptimisticPatch | null => {
  if (!currentState) return null;

  switch (payload.action) {
    case "advanceServing":
      return {
        id,
        kind: payload.action,
        apply: (state) => applyAdvanceServingOptimistic(state, payload.direction),
      };
    case "updateServing":
      return {
        id,
        kind: payload.action,
        apply: (state) => applyUpdateServingOptimistic(state, payload.currentlyServing),
      };
    case "markReturned":
      return {
        id,
        kind: payload.action,
        apply: (state) => applyMarkReturnedOptimistic(state, payload.ticketNumber),
      };
    case "markUnclaimed":
      return {
        id,
        kind: payload.action,
        apply: (state) => applyMarkUnclaimedOptimistic(state, payload.ticketNumber),
      };
    case "setMode":
      return {
        id,
        kind: payload.action,
        apply: (state) => applySetModeOptimistic(state, payload.mode),
      };
    case "reset":
      return {
        id,
        kind: payload.action,
        apply: (state) => applyResetOptimistic(state),
      };
    case "setDisplayUrl":
      return {
        id,
        kind: payload.action,
        apply: (state) => applySetDisplayUrlOptimistic(state, payload.url),
      };
    case "setOperatingHours":
      return {
        id,
        kind: payload.action,
        apply: (state) =>
          applySetOperatingHoursOptimistic(state, payload.hours, payload.timezone),
      };
    case "generate":
      if (payload.mode !== "sequential") return null;
      return {
        id,
        kind: payload.action,
        apply: (state) =>
          applyGenerateSequentialOptimistic(
            state,
            payload.startNumber,
            payload.endNumber,
          ),
      };
    case "generateBatch":
      if (currentState.mode !== "sequential") return null;
      return {
        id,
        kind: payload.action,
        apply: (state) =>
          applyGenerateBatchSequentialOptimistic(
            state,
            payload.startNumber,
            payload.endNumber,
            payload.batchSize,
          ),
      };
    case "append":
      if (currentState.mode !== "sequential") return null;
      return {
        id,
        kind: payload.action,
        apply: (state) => applyAppendSequentialOptimistic(state, payload.endNumber),
      };
    default:
      return null;
  }
};

type RangeGenerationControlsProps = {
  state: RaffleState | null;
  hasDrawStarted: boolean;
  isRangeExhausted: boolean;
  loading: boolean;
  pendingNonDrawAction: string | null;
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
  pendingNonDrawAction,
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
    pendingNonDrawAction === null;

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

            if (loading || pendingNonDrawAction !== null || canGenerateFull) {
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
          disabled={loading || pendingNonDrawAction !== null || previewUndrawnCount === 0}
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
  pendingNonDrawAction: string | null;
  onReset: () => Promise<void>;
};

const ResetActionControls = React.memo(function ResetActionControls({
  loading,
  pendingNonDrawAction,
  onReset,
}: ResetActionControlsProps) {
  const [resetPhrase, setResetPhrase] = React.useState("");
  const canReset = resetPhrase === "RESET" && !loading && pendingNonDrawAction === null;

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

type DrawPositionControlsProps = {
  currentTicket: number | null;
  currentDrawNumber: number | null;
  totalTickets: number;
  canAdvancePrev: boolean;
  canAdvanceNext: boolean;
  loading: boolean;
  hasState: boolean;
  drawActionsDisabled: boolean;
  canClear: boolean;
  onPrev: () => Promise<void>;
  onNext: () => Promise<void>;
  onClear: () => Promise<void>;
  formatOrdinal: (value: number) => string;
};

const DrawPositionControls = React.memo(function DrawPositionControls({
  currentTicket,
  currentDrawNumber,
  totalTickets,
  canAdvancePrev,
  canAdvanceNext,
  loading,
  hasState,
  drawActionsDisabled,
  canClear,
  onPrev,
  onNext,
  onClear,
  formatOrdinal,
}: DrawPositionControlsProps) {
  return (
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
          onClick={onPrev}
          disabled={loading || !hasState || !canAdvancePrev || drawActionsDisabled}
          aria-label="Previous draw"
          className={!canAdvancePrev || drawActionsDisabled ? "opacity-50" : ""}
        >
          <ChevronLeft className="size-4" animateOnHover animateOnTap animateOnView />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onNext}
          disabled={loading || !hasState || !canAdvanceNext || drawActionsDisabled}
          aria-label="Next draw"
          className={!canAdvanceNext || drawActionsDisabled ? "opacity-50" : ""}
        >
          <ChevronRight className="size-4" animateOnHover animateOnTap animateOnView />
        </Button>
        <ConfirmAction
          triggerLabel="Clear"
          actionLabel="Clear position"
          title="Clear draw position"
          description="This will reset the “Now Serving” display back to the beginning. Clients will no longer see an active position. You can undo this action."
          onConfirm={onClear}
          disabled={loading || !hasState || !canClear || drawActionsDisabled}
          variant="ghost"
          size="sm"
        />
      </div>
    </div>
  );
});

const AdminPage = () => {
  const optimisticUiEnabled = process.env.NEXT_PUBLIC_ADMIN_OPTIMISTIC_UI === "true";

  const [confirmedState, setConfirmedState] = React.useState<RaffleState | null>(null);
  const [optimisticPatches, setOptimisticPatches] = React.useState<OptimisticPatch[]>([]);
  const [inFlightAction, setInFlightAction] = React.useState<InFlightAction | null>(null);
  const [queuedDrawAction, setQueuedDrawAction] = React.useState<QueuedDrawAction | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingDrawAction, setPendingDrawAction] = React.useState<string | null>(null);
  const [pendingNonDrawAction, setPendingNonDrawAction] = React.useState<string | null>(null);
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
  const [showOlderSnapshots, setShowOlderSnapshots] = React.useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<string>("");
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const [pendingHours, setPendingHours] = React.useState<OperatingHours | null>(null);
  const [pendingTimezone, setPendingTimezone] = React.useState<string>("America/Los_Angeles");
  const [timezoneMismatchOpen, setTimezoneMismatchOpen] = React.useState(false);
  const browserOriginRef = React.useRef<string | null>(null);
  const stateRef = React.useRef<RaffleState | null>(null);
  const inFlightActionRef = React.useRef<InFlightAction | null>(null);
  const queuedDrawActionRef = React.useRef<QueuedDrawAction | null>(null);
  const optimisticIdRef = React.useRef(0);
  const snapshotRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const archiveIconRef = React.useRef<ArchiveIconHandle | null>(null);
  const archiveIconResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setInFlightActionSync = React.useCallback((next: InFlightAction | null) => {
    inFlightActionRef.current = next;
    setInFlightAction(next);
  }, []);

  const setQueuedDrawActionSync = React.useCallback((next: QueuedDrawAction | null) => {
    queuedDrawActionRef.current = next;
    setQueuedDrawAction(next);
  }, []);

  const state = React.useMemo(() => {
    if (!confirmedState) return null;
    if (!optimisticUiEnabled || optimisticPatches.length === 0) {
      return confirmedState;
    }
    return optimisticPatches.reduce((current, patch) => patch.apply(current), confirmedState);
  }, [confirmedState, optimisticPatches, optimisticUiEnabled]);

  const pendingAction = pendingNonDrawAction ?? pendingDrawAction;
  const nonDrawActionPending = pendingNonDrawAction !== null;
  const snapshotRenderLimit = showOlderSnapshots
    ? snapshots.length
    : SNAPSHOT_RENDER_PAGE_SIZE;
  const hasMoreSnapshots = snapshots.length > SNAPSHOT_RENDER_PAGE_SIZE;
  const snapshotOptions = React.useMemo(() => {
    const visible = snapshots.slice(0, snapshotRenderLimit);
    if (selectedSnapshot && !visible.some((snapshot) => snapshot.id === selectedSnapshot)) {
      const selected = snapshots.find((snapshot) => snapshot.id === selectedSnapshot);
      if (selected) {
        return [...visible, selected];
      }
    }
    return visible;
  }, [selectedSnapshot, snapshotRenderLimit, snapshots]);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshSnapshots = React.useCallback(async () => {
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listSnapshots" }),
      });
      if (response.ok) {
        const snaps = (await response.json()) as Snapshot[];
        setSnapshots((current) => {
          const unchanged =
            current.length === snaps.length &&
            current.every(
              (snapshot, index) =>
                snapshot.id === snaps[index]?.id &&
                snapshot.timestamp === snaps[index]?.timestamp,
            );
          return unchanged ? current : snaps;
        });
        setSelectedSnapshot((current) => {
          if (!snaps.length) return "";
          if (current && snaps.some((snapshot) => snapshot.id === current)) {
            return current;
          }
          return snaps[0].id;
        });
      }
    } catch {
      // ignore snapshot refresh errors in UI
    }
  }, []);

  const scheduleSnapshotRefresh = React.useCallback(
    (delayMs = 0) => {
      if (snapshotRefreshTimerRef.current) {
        clearTimeout(snapshotRefreshTimerRef.current);
      }
      snapshotRefreshTimerRef.current = setTimeout(() => {
        snapshotRefreshTimerRef.current = null;
        void refreshSnapshots();
      }, delayMs);
    },
    [refreshSnapshots],
  );

  React.useEffect(
    () => () => {
      if (snapshotRefreshTimerRef.current) {
        clearTimeout(snapshotRefreshTimerRef.current);
      }
      if (archiveIconResetTimerRef.current) {
        clearTimeout(archiveIconResetTimerRef.current);
      }
    },
    [],
  );

  const triggerArchiveIconAnimation = React.useCallback(() => {
    archiveIconRef.current?.startAnimation();
    if (archiveIconResetTimerRef.current) {
      clearTimeout(archiveIconResetTimerRef.current);
    }
    archiveIconResetTimerRef.current = setTimeout(() => {
      archiveIconRef.current?.stopAnimation();
      archiveIconResetTimerRef.current = null;
    }, ARCHIVE_ICON_RESET_DELAY_MS);
  }, []);

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
      const stateResp = await fetch("/api/state", { cache: "no-store" });
      if (!stateResp.ok) {
        throw new Error("Unable to load state.");
      }
      const data = (await stateResp.json()) as RaffleState;
      setConfirmedState(data);
      if (!inFlightActionRef.current) {
        setOptimisticPatches([]);
        setQueuedDrawActionSync(null);
      }
      setError(null);
      // Keep first interactive state render independent of snapshot-list latency.
      void refreshSnapshots();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error while loading state.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [refreshSnapshots, setQueuedDrawActionSync]);

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

  const postAction = React.useCallback(async (payload: ActionPayload) => {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error ?? "Unable to apply action.");
    }
    return (await response.json()) as RaffleState;
  }, []);

  const markPendingStart = React.useCallback((payload: ActionPayload) => {
    if (isDrawNavigationPayload(payload)) {
      setPendingDrawAction(payload.action);
      return;
    }
    setPendingNonDrawAction(payload.action);
  }, []);

  const clearPendingForPayload = React.useCallback((payload: ActionPayload) => {
    if (isDrawNavigationPayload(payload)) {
      setPendingDrawAction(null);
      return;
    }
    setPendingNonDrawAction(null);
  }, []);

  const sendActionLegacy = React.useCallback(
    async (payload: ActionPayload) => {
      markPendingStart(payload);
      try {
        const data = await postAction(payload);
        setConfirmedState(data);
        if (payload.action !== "undo" && payload.action !== "redo") {
          setCanRedo(false);
        }
        // Snapshot history refresh is non-critical and should not block action completion UI.
        scheduleSnapshotRefresh(
          isDrawNavigationPayload(payload) ? DRAW_SNAPSHOT_REFRESH_DELAY_MS : 0,
        );
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error while saving.";
        toast.error(message);
        throw err;
      } finally {
        clearPendingForPayload(payload);
      }
    },
    [
      clearPendingForPayload,
      markPendingStart,
      postAction,
      scheduleSnapshotRefresh,
    ],
  );

  const nextOptimisticId = React.useCallback(() => {
    optimisticIdRef.current += 1;
    return `optimistic-${optimisticIdRef.current}`;
  }, []);

  const processOptimisticChain = React.useCallback(
    async (initialItem: OptimisticDispatchItem): Promise<RaffleState> => {
      let currentItem: OptimisticDispatchItem | QueuedDrawAction | null = initialItem;
      let latestState: RaffleState | null = null;

      while (currentItem) {
        setInFlightActionSync({ id: currentItem.id, payload: currentItem.payload });
        markPendingStart(currentItem.payload);

        try {
          const data = await postAction(currentItem.payload);
          latestState = data;
          setConfirmedState(data);
          if (currentItem.payload.action !== "undo" && currentItem.payload.action !== "redo") {
            setCanRedo(false);
          }
          if (currentItem.patch) {
            const appliedPatchId = currentItem.patch.id;
            setOptimisticPatches((prev) =>
              prev.filter((patch) => patch.id !== appliedPatchId),
            );
          }
          scheduleSnapshotRefresh(
            isDrawNavigationPayload(currentItem.payload)
              ? DRAW_SNAPSHOT_REFRESH_DELAY_MS
              : 0,
          );
          currentItem.resolve(data);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unexpected error while saving.";
          toast.error(message);
          setOptimisticPatches([]);
          const queued = queuedDrawActionRef.current;
          if (queued) {
            queued.reject(err);
          }
          setQueuedDrawActionSync(null);
          currentItem.reject(err);
          setInFlightActionSync(null);
          clearPendingForPayload(currentItem.payload);
          void fetchState();
          throw err;
        }

        const nextQueued = queuedDrawActionRef.current;
        if (nextQueued) {
          setQueuedDrawActionSync(null);
          currentItem = nextQueued;
          continue;
        }

        currentItem = null;
      }

      setInFlightActionSync(null);
      clearPendingForPayload(initialItem.payload);

      if (latestState) return latestState;
      throw new Error("No state returned from action chain.");
    },
    [
      clearPendingForPayload,
      fetchState,
      markPendingStart,
      postAction,
      scheduleSnapshotRefresh,
      setInFlightActionSync,
      setQueuedDrawActionSync,
    ],
  );

  const sendActionOptimistic = React.useCallback(
    async (payload: ActionPayload) => {
      const currentState = stateRef.current ?? confirmedState;
      const createActionItem = (actionId: string, patch: OptimisticPatch | null) => {
        let resolvePromise!: (state: RaffleState) => void;
        let rejectPromise!: (reason: unknown) => void;
        const actionPromise = new Promise<RaffleState>((resolve, reject) => {
          resolvePromise = resolve;
          rejectPromise = reject;
        });

        const actionItem: OptimisticDispatchItem = {
          id: actionId,
          payload,
          patch,
          resolve: resolvePromise,
          reject: rejectPromise,
        };

        return { actionItem, actionPromise };
      };

      const inFlight = inFlightActionRef.current;
      if (inFlight) {
        if (isDrawNavigationPayload(payload) && isDrawNavigationPayload(inFlight.payload)) {
          if (queuedDrawActionRef.current) {
            if (currentState) return currentState;
            throw new Error("State unavailable while action queue is full.");
          }
          const actionId = nextOptimisticId();
          const patch = buildOptimisticPatch(actionId, payload, currentState);
          const { actionItem, actionPromise } = createActionItem(actionId, patch);
          const queuedPatch = actionItem.patch;
          if (queuedPatch) {
            setOptimisticPatches((prev) => [...prev, queuedPatch]);
          }
          setQueuedDrawActionSync({
            ...actionItem,
            payload,
          });
          return actionPromise;
        }
        throw new Error("Another action is still processing.");
      }

      const actionId = nextOptimisticId();
      const patch = buildOptimisticPatch(actionId, payload, currentState);
      const { actionItem, actionPromise } = createActionItem(actionId, patch);

      const immediatePatch = actionItem.patch;
      if (immediatePatch) {
        setOptimisticPatches((prev) => [...prev, immediatePatch]);
      }

      void processOptimisticChain(actionItem).catch(() => {
        // Failures are routed to the originating caller via actionPromise rejection.
      });
      return actionPromise;
    },
    [confirmedState, nextOptimisticId, processOptimisticChain, setQueuedDrawActionSync],
  );

  const sendAction = React.useCallback(
    async (payload: ActionPayload) => {
      if (!optimisticUiEnabled) {
        return sendActionLegacy(payload);
      }
      return sendActionOptimistic(payload);
    },
    [optimisticUiEnabled, sendActionLegacy, sendActionOptimistic],
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
    setPendingNonDrawAction("cleanup");
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
      setPendingNonDrawAction(null);
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
      setUrlError("");
      await sendAction({ action: "setDisplayUrl", url: urlInput });
      setEditingUrl(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save URL";
      setUrlError(message);
    }
  };

  const handleResetUrl = async () => {
    const browserUrl = browserOriginRef.current ?? (typeof window !== "undefined"
      ? `${window.location.origin}/`
      : "");
    try {
      await sendAction({ action: "setDisplayUrl", url: null });
      setCustomDisplayUrl(null);
      setDisplayUrl(browserUrl);
      setEditingUrl(false);
      setUrlError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset URL";
      setUrlError(message);
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
  const drawQueueCount = queuedDrawAction ? 1 : 0;
  const inFlightIsDrawAction = isDrawNavigationPayload(inFlightAction?.payload);
  const drawActionsBlockedByQueuePolicy =
    optimisticUiEnabled &&
    !!inFlightAction &&
    (!inFlightIsDrawAction || drawQueueCount > 0);
  const drawActionsDisabled =
    pendingDrawAction !== null &&
    (!optimisticUiEnabled || drawActionsBlockedByQueuePolicy);

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
      await sendAction({ action: "undo" });
      setCanRedo(true);
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("Undo failed");
      }
    }
  };

  const handleRedo = async () => {
    try {
      await sendAction({ action: "redo" });
      setCanRedo(false);
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("Redo failed");
      }
    }
  };

  const handleRestoreSnapshot = async () => {
    if (!selectedSnapshot) return;
    try {
      await sendAction({ action: "restoreSnapshot", id: selectedSnapshot });
    } catch {
      // sendAction already surfaced the error toast
    }
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
              {pendingAction}
              {drawQueueCount > 0 ? `... +${drawQueueCount} queued` : "..."}
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
                    disabled={modeChanging || nonDrawActionPending}
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
                pendingNonDrawAction={pendingNonDrawAction}
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
              <DrawPositionControls
                currentTicket={currentTicket}
                currentDrawNumber={currentDrawNumber}
                totalTickets={totalTickets}
                canAdvancePrev={canAdvancePrev}
                canAdvanceNext={canAdvanceNext}
                loading={loading}
                hasState={Boolean(state)}
                drawActionsDisabled={drawActionsDisabled}
                canClear={currentIndex !== -1}
                onPrev={handlePrevServing}
                onNext={handleNextServing}
                onClear={() => setServingByIndex(null)}
                formatOrdinal={formatOrdinal}
              />

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
                  disabled={!canMarkReturned || loading || nonDrawActionPending}
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
                  disabled={!canMarkUnclaimed || loading || nonDrawActionPending}
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
                  disabled={!canUndo || loading || nonDrawActionPending}
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
                  disabled={!canRedo || loading || nonDrawActionPending}
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
                  onClick={() => scheduleSnapshotRefresh()}
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
                    {snapshotOptions.map((snap) => (
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
                    disabled={!selectedSnapshot || loading || nonDrawActionPending}
                  >
                    Restore
                  </Button>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <span>
                    Showing {Math.min(snapshotRenderLimit, snapshots.length)} of {snapshots.length} snapshots
                  </span>
                  {hasMoreSnapshots && (
                    <label
                      htmlFor="show-older-snapshots"
                      className="mt-1 flex items-center gap-2 text-sm text-foreground"
                    >
                      <Checkbox
                        id="show-older-snapshots"
                        checked={showOlderSnapshots}
                        onCheckedChange={(checked) => {
                          setShowOlderSnapshots(checked === true);
                          triggerArchiveIconAnimation();
                        }}
                        disabled={loading}
                      />
                      <span className="inline-flex items-center gap-2">
                        <ArchiveIcon
                          ref={archiveIconRef}
                          className="size-4 text-muted-foreground"
                          size={16}
                          onMouseEnter={() => archiveIconRef.current?.startAnimation()}
                          onMouseLeave={() => archiveIconRef.current?.stopAnimation()}
                        />
                        Show older snapshots
                      </span>
                    </label>
                  )}
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
                    disabled={loading || nonDrawActionPending}
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
                    disabled={loading || nonDrawActionPending}
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
                pendingNonDrawAction={pendingNonDrawAction}
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
                  disabled={loading || nonDrawActionPending}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading hours…</p>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveOperatingHours}
                disabled={!pendingHours || loading || nonDrawActionPending}
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
                    <AlertDialogCancel disabled={nonDrawActionPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleConfirmTimezoneMismatch}
                      disabled={nonDrawActionPending}
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
