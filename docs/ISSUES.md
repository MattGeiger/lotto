# Production Pilot Issues (2026-01-16)

## Pattern Alignment
- Working within established documentation and architectural patterns. This document follows the existing project docs style and references the current admin/display/state-manager flows without proposing structural rewrites.

## Project Context (Stack, Patterns, Constraints)
- **Stack:** Next.js App Router, React 19, Tailwind v4, Shadcn UI, Radix dialogs, Sonner toasts.
- **State pattern:** All admin actions go through `/api/state` and `stateManager` (`src/lib/state-manager.ts` for file, `src/lib/state-manager-db.ts` for Postgres). Ticket status and called-at timestamps live in `RaffleState`.
- **Admin UX pattern:** Confirmation modals use a shared `ConfirmAction` wrapper (`src/components/confirm-action.tsx`).
- **Display pattern:** Public board is `ReadOnlyDisplay` (`src/components/readonly-display.tsx`) with adaptive polling and visibility pause; date rendering uses `formatDate` (`src/lib/date-format.ts`). The standalone display is `scripts/readonly-server.js`.
- **Constraints:** Order is immutable once generated; returned tickets should not reorder the queue; all changes should be incremental, using existing UI patterns and centralized state logic.

---

## Issue 1: Returned tickets are not skipped when advancing Draw Position

### Status
- Implemented via a dedicated `advanceServing` action (pending verification).

### Observed
Advancing the Draw Position (next/prev) can land on a ticket already marked as `returned`.

### Root Cause (Code References)
- Admin advance logic uses **index-based navigation** and does not skip `ticketStatus === "returned"`.
  - `src/app/admin/page.tsx` → `setServingByIndex`, `handleNextServing`, `handlePrevServing`.
- Backend `updateCurrentlyServing` **accepts any in-range ticket** and does not skip returned tickets.
  - `src/lib/state-manager.ts` → `updateCurrentlyServing`.
  - `src/lib/state-manager-db.ts` → `updateCurrentlyServing`.
- Only auto-skip logic exists when **marking the currently serving ticket as returned**, not when advancing.
  - `src/lib/state-manager.ts` / `src/lib/state-manager-db.ts` → `markTicketReturned`.

### Approaches
1) **UI-only skip in Admin**
   - Find next/prev non-returned ticket in `setServingByIndex` before calling `/api/state`.
   - Pros: Minimal backend changes; fastest iteration.
   - Cons: Logic lives only in UI; future clients or API callers could still land on returned tickets.

2) **Backend guard inside `updateCurrentlyServing`**
   - If the requested ticket is `returned`, compute the next valid ticket.
   - Pros: Centralized enforcement.
   - Cons: Backend does not know direction (next vs prev), so skipping is ambiguous without additional input.

3) **New API action: `advanceServing`**
   - Add an action that accepts `direction` (`next`/`prev`) and finds the nearest non-returned ticket in the order.
   - Admin uses this action for arrows; existing `updateCurrentlyServing` stays for direct set/clear.
   - Pros: Clear semantics, centralized logic, no ambiguity.
   - Cons: Requires API/schema changes and new tests.

### Recommendation
**Approach 3** is the most robust and consistent with the centralized state pattern. It keeps skip logic server-side and explicit while preserving `updateCurrentlyServing` for direct set/clear actions.

---

## Issue 2: Confirmation modal sometimes stays open after "Mark ticket"

### Status
- Verified in production after updating `ConfirmAction` to close dialogs in `finally`.

### Observed
Intermittently, after confirming "Mark ticket," the modal remains open even though the ticket status updates successfully. The user must click Cancel to dismiss it.

### Root Cause (Code References)
- `ConfirmAction` only calls `setOpen(false)` **after** `onConfirm` resolves successfully.
  - `src/components/confirm-action.tsx` → `handleConfirm`.
- If `onConfirm` throws (e.g., transient fetch/parse failure), the dialog stays open.
  - `src/app/admin/page.tsx` → `sendAction` rethrows on any fetch/parse error after showing a toast.
  - Even if the server applied the change, a client-side error can keep the modal open.

### Approaches
1) **Close modal in `finally`**
   - Always `setOpen(false)` after `onConfirm`, while still showing toast errors.
   - Pros: Removes stuck-modal failure mode; aligns with user expectation after confirm.
   - Cons: Errors become less visible unless the toast is noticed.

2) **Swallow post-success errors**
   - Adjust `sendAction` or action handlers to avoid throwing after a successful server mutation (e.g., snapshot refresh failure).
   - Pros: Keeps modal close-on-success behavior without changing dialog behavior.
   - Cons: Hard to distinguish true failures vs. partial failures; requires careful error handling.

3) **Expose open state to parent**
   - Allow parent to close dialog based on `pendingAction` or success flags.
   - Pros: More control and visibility at the call site.
   - Cons: Adds complexity and diverges from current shared `ConfirmAction` pattern.

### Recommendation
**Approach 1** is the most predictable for staff: once they confirm, the dialog should close. Errors should be surfaced via toast. This also keeps behavior consistent across all confirm actions.

---

## Issue 3: Display date stuck after 24 hours of idle time

### Status
- Implemented by recomputing the date on each render and refreshing the standalone title during polling (pending verification).

### Observed
Display auto-refreshes state regularly, but the **date header stays on yesterday** after 24+ hours of idle time.

### Root Cause (Before Fix)
- `ReadOnlyDisplay` memoized the formatted date **only by language**, so it never recomputed on day change.
  - `src/components/readonly-display.tsx` → `const formattedDate = React.useMemo(..., [language])`.
  - `src/lib/date-format.ts` uses `new Date()` but was not re-run.
- Standalone display also set the date **only once at load**.
  - `scripts/readonly-server.js` → `setTitle()` called once at boot, not on poll.

### Approaches
1) **Remove memoization and compute per render**
   - Let `formatDate(language)` run each render; re-renders already happen on a regular polling cadence.
   - Pros: Minimal changes; no new timers.
   - Cons: Slight extra compute (negligible).

2) **Daily timer tick**
   - Add a `dateTick` state updated via `setTimeout` at midnight (or interval), and include it as a dependency.
   - Pros: Updates exactly at day change; minimal render impact.
   - Cons: Slightly more complex.

3) **Refresh date during polling**
   - Update formatted date alongside fetch in the poller, or call `setTitle()` each poll in the standalone server.
   - Pros: Leverages existing polling cadence.
   - Cons: Logic spread across polling side effects.

### Recommendation
**Approach 1** is simplest and consistent with the existing polling cadence. For the standalone server, calling `setTitle()` inside the polling loop achieves the same result with minimal change.

---

## Issue 4: Edge request usage grows quickly under fixed polling

### Status
- Implemented with adaptive polling and visibility-based pause (pending verification).

### Observed
After launching the pilot, edge request usage climbed quickly. The public display polls `/api/state` on a fixed cadence, which can generate high request volume for always-on screens.

### Root Cause (Code References)
- `ReadOnlyDisplay` used a fixed `setInterval` to poll `/api/state` at a steady rate.
  - `src/components/readonly-display.tsx` → interval-based polling.
- The cadence did not account for operating hours or idle periods.

### Approaches
1) **Adaptive polling with idle tiers**
   - Increase polling interval as time since last change grows, with caps for open/closed windows.
   - Pros: Reduces requests when idle while keeping fresh data during active use.
   - Cons: Slightly more complex scheduling logic.

2) **Pause polling when hidden**
   - Stop polling entirely when the tab is not visible; resume immediately on focus.
   - Pros: Eliminates background polling on wall displays that are minimized or inactive.
   - Cons: Requires visibility event handling.

3) **Server push (SSE/WebSocket)**
   - Maintain a long-lived connection for updates.
   - Pros: Efficient for live updates with low request volume.
   - Cons: Platform constraints and operational complexity for long-lived connections.

### Recommendation
Combine (1) and (2): adaptive polling based on time since last change, with operating-hours-aware backoff tiers and a visibility pause. This aligns with live usage without requiring server push infrastructure.

---

## Implementation Phases (Completed)
1) **Draw Position Skip** — Implemented (server action + admin wiring + tests + docs).
2) **Modal Reliability** — Implemented (`ConfirmAction` closes in `finally` + docs).
3) **Display Date Refresh** — Implemented (date recompute + standalone title refresh + docs).
4) **Adaptive Display Polling** — Implemented (idle tiers + visibility pause + operating-hours slack).

---

## Accessibility Update: Header controls on mobile
- **Status**: Verified (mobile UX complete).
- **Observation**: The language & theme toggles were tight on touch screens and sat close to the WTH logo/QR code.
- **Action**: Increased each button’s hit target by 50%, padded the floating header, and added extra padding to the display shell so the logo/QR block stays below the controls while preserving the layout (`src/components/language-switcher.tsx`, `src/components/theme-switcher.tsx`, `src/app/page.tsx`, `src/components/readonly-display.tsx`).
- **Result**: Interactive accessibility on phones/tablets improved without altering the existing queue presentation and the header controls now match the established palette/padding rules documented in `docs/UI_DESIGN.md`.

---

## UX Issue: Ticket lookup in long queues
- **Status**: Resolved (search cluster deployed).
- **Observation**: When >80 tickets are listed, finding a specific number in the Drawing Order card becomes tedious for clients.
- **Action**: Added a centered header search field with an icon-only trigger that mirrors the language/theme buttons, digit-only sanitization, ticket-detail modal launches for matches, and a “Ticket number not found” dialog when the lookup misses (`src/app/page.tsx`, `src/components/readonly-display.tsx`, `src/components/ui/input-group.tsx`, `src/components/ui/dialog.tsx`). The search pill now shares the same gradient/palette tokens used elsewhere, keeps responsive text/icon scaling per user preference, and sits within the defined padding cluster so the input feels cohesive yet distinct.

---

## Manual Test Checklist (for later implementation)
- **Returned skip:** Mark a mid-queue ticket returned, then advance Next; verify the returned ticket is skipped. Repeat with Prev.
- **Modal close:** Mark returned/unclaimed with successful response; modal closes immediately. Simulate a failed network response and confirm modal behavior matches the chosen approach.
- **Display date:** Leave display running past midnight (or simulate time change); confirm date and document title update without reload.
- **Standalone display:** Repeat date test on `npm run readonly` server.
- **Polling backoff:** Leave the display idle during open hours; confirm polling slows after 10/30/60/120 minutes without changes, and resumes quickly after a state update.
- **Visibility pause:** Hide the display tab, confirm polling stops, and verify it refreshes immediately on return.
