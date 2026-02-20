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

## Operational Notes
- 2026-01-22: Rolled back the experimental Blob snapshot caching and restored production to the polling + timezone warning revision.

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

## Issue 5: CSP blocking Next.js inline scripts (v1.2.2 → hotfix)

### Status
- Fixed in production (commit `2745636`).

### Observed
After deploying the security audit fixes (v1.2.2), the admin page was stuck on "Loading state from datastore..." and "Loading hours..." — React hydration failed silently.

### Root Cause
- Security fix H3 set `script-src 'self'` in Content Security Policy, which blocked Next.js inline scripts required for hydration.
- `next.config.ts` → CSP header.

### Fix
- Changed `script-src 'self'` to `script-src 'self' 'unsafe-inline'` (required by Next.js).
- Added implementation note to `docs/SECURITY.md` explaining the trade-off.

---

## Issue 6: Modal button overflow on narrow viewports

### Status
- Fixed in production (commit `7889d98`).

### Observed
The Append confirmation modal (with 3 buttons: Cancel, "Append ticket range only", "Append and draw tickets") overflowed past the modal boundaries on mobile/narrow screens.

### Root Cause
- `AlertDialogFooter` defaults to horizontal layout (`sm:flex-row`) which cannot accommodate 3 buttons with long labels.
- No `overflow-x-hidden` on `AlertDialogContent` to enforce boundary clipping.

### Fix
- Added `overflow-x-hidden` to `AlertDialogContent` on both append and batch dialogs.
- Stacked append modal buttons vertically (`flex-col` + `w-full`) so all 3 buttons fit cleanly.
- Pattern documented in `/Users/russbook/zev_app/zev_dashboard/docs/modal-overflow-fix.md`.

---

## Issue 7: Append action silently adds tickets to draw queue

### Status
- Fixed in production (commit `e78adb1`).

### Observed
The "Add tickets" confirmation button in the Append workflow performed two actions simultaneously — extending the ticket range AND adding new tickets to the draw queue — without staff awareness. This could cause confusion when staff only intended to register new ticket numbers.

### Root Cause
- `appendTickets()` in both state managers always extends range AND appends to `generatedOrder` in a single operation.
- The `ConfirmAction` component only supports a single action button, offering no way to separate the two behaviors.

### Fix
- Added `extendRange()` method to both state managers (range-only, no draw).
- Added `extendRange` API action with Zod validation.
- Replaced `ConfirmAction` with a raw `AlertDialog` offering 3 discrete buttons:
  - **Cancel** — dismisses modal
  - **Append ticket range only** — extends range without drawing (new tickets go to undrawn pool)
  - **Append and draw tickets** — existing behavior (extends range + draws)

---

## Issue 8: Admin page shows stale state after tab switch

### Status
- Fixed in production.

### Observed
When staff switch to another browser tab and return, the admin page displays stale state. Any changes made by other admins or system events are not reflected until the staff member performs an action or manually refreshes the page.

### Root Cause
- The admin page only fetches state on initial mount and after user-triggered actions via `sendAction()`.
- No `visibilitychange` listener to detect tab focus return.
- The public display page (`readonly-display.tsx`) already has this pattern — adaptive polling with visibility pause/resume — but the admin page was missing it entirely.

### Fix
- Added a `visibilitychange` event listener that calls `fetchState()` when `document.visibilityState` changes to `"visible"`.
- Reuses the existing `fetchState` callback which loads both state and snapshots in parallel.
- Cleanup removes the listener on unmount.

---

## Issue 9: Append allows unfair ticket ordering during partial batch draws

### Status
- Fixed in production.

### Observed
With the batch generation feature (v1.2.3), staff can partially draw tickets from a range (e.g., draw 30 of 50), then Append new tickets. The appended tickets get added to the draw order before earlier tickets still sitting in the undrawn pool. This violates the fairness principle: people who arrived first should be drawn before late arrivals.

### Root Cause
- The Append button had no guard for `undrawnCount > 0` — it only checked that state existed and the input field had a value.
- `appendTickets()` extends the range AND adds new tickets to `generatedOrder`, which meant late-arriving tickets could leapfrog earlier undrawn tickets in the queue.

### Fix
- Disabled the entire Append section (input, stepper buttons, and Append button) when `undrawnCount > 0`.
- Added a toast-on-disabled-tap pattern: tapping the disabled Append button shows a Sonner error explaining why it's unavailable and how many tickets remain undrawn. Works on both touch and desktop (parent div catches the tap since disabled elements don't fire events).
- Simplified the Append confirmation modal from 3 buttons to 2 (removed "Append ticket range only"), and updated the description to show the current mode (randomly/sequentially).
- Removed the `extendRange` UI path from the admin page (backend method retained).

---

## Issue 10: Start/End range edits looked editable but were ignored after draws

### Status
- Fixed and verified in localhost testing.

### Observed
After batch sorting started, staff could still type into Start/End inputs. The UI accepted edits, but draw behavior still followed the previously persisted range, which created silent mismatch and fairness trust concerns.

### Root Cause
- Post-init range rules were not enforced consistently across UI and backend.
- `generateBatch` did not return concrete, bound-aware validation messages for start-lock or end-shrink attempts.
- Expansion behavior needed explicit atomic persistence guarantees so a failed draw could not leave a partially expanded range.

### Fix
- Locked `startNumber` after first draw in the admin UI and backend, with canonical ASK copy that includes the current bound.
- Allowed `endNumber` to expand only forward during active batching; rejected shrink attempts with concrete ASK copy: `The end number is currently {currentEnd}. Please choose a number greater than {currentEnd}.`
- Enforced atomic `generateBatch` persistence: expansion + draw save together on success; failed draw requests persist nothing.
- Added typed user-input error transport in `/api/state` so actionable validation messages return as HTTP 400 instead of generic 500s.
- Added tests for bound-specific error copy, expansion persistence on success, and no end-range mutation on failed expanded draws.

---

## Issue 11: Login tabs showed clipped shadow artifacts and hydration mismatch warnings

### Status
- Fixed and verified in localhost testing.

### Observed
- On `/login`, control shadows showed clipped side artifacts while switching OTP/Magic tabs.
- Next.js console reported hydration mismatch warnings tied to tab trigger/content `id` and `aria-controls` attributes.

### Root Cause
- Tab panels slide in a horizontally translated track and clipped overflow at the animated viewport edge, so inactive pane visual effects could leak as edge traces.
- Inactive tab panels also used blur transitions, which amplified side artifacts during the slide.
- Radix Tabs generated runtime IDs for triggers/content that did not match server-rendered attributes in this motion-wrapped tab setup.

### Fix
- Added deterministic login tab IDs/ARIA wiring for trigger/content pairs to eliminate SSR/client attribute drift.
- Updated animated tab panel behavior to keep inactive panels clipped while allowing active panel overflow.
- Removed inactive panel blur filtering from the tabs primitive to stop visual bleed from adjacent offscreen pane effects.
- Kept horizontal slide and auto-height animation behavior intact.

---

## Issue 12: Morph animations dropped frames on low-power clients (Raspberry Pi/Chromium)

### Status
- Fixed and verified in localhost testing (performance hardening shipped).

### Observed
- On slower machines (for example Raspberry Pi 4 running Chromium), morph-style text transitions rendered only a few visible frames from start to finish.
- The low frame cadence made "Now Serving" and language text transitions feel jumpy and delayed.

### Root Cause
- Animated `filter: blur(...)` was present in multiple text transition paths, including base morph primitives and display-specific overrides.
- Blur animation is significantly more expensive than transform/opacity-only transitions on low-end GPU/CPU hardware.

### Fix
- Removed animated blur from:
  - `src/components/animate-ui/primitives/texts/morphing.tsx`
  - `src/components/language-morph-text.tsx`
  - `src/components/readonly-display.tsx`
- Preserved existing motion behavior (opacity/position/scale transitions, timing, and sequencing) while removing blur-related rendering cost.

---

## Issue 13: Snake pace is too demanding for slower reflexes; pellet placement can be punishing near walls

### Status
- Fixed in Arcade Snake (implemented 2026-02-16).

### Observed
- Some players struggle with the default Snake movement speed.
- Pellet spawns near borders can increase early collision risk, especially for beginners or low-reflex users.

### Root Cause
- Tick loop uses one fixed speed (`180ms`) with no in-game pacing control.
- Food pellet spawning is random across all unoccupied board cells and does not consider difficulty tiers.

### Fix
- Installed `@8bitcn/slider` via shadcn and wired one unified settings slider into `/arcade/snake`.
- Added a **single 6-step mode slider** (left to right):
  - `VERY EASY` = `360ms` tick + pellets at least 5 cells from walls
  - `EASY` = `360ms` tick + pellets at least 3 cells from walls
  - `NORMAL` = `180ms` tick + pellets at least 3 cells from walls
  - `HARD` = `180ms` tick + pellets can spawn anywhere
  - `VERY HARD` = `90ms` tick + pellets can spawn anywhere
  - `NIGHTMARE` = `90ms` tick + pellets can spawn anywhere + pellet lifetime `5s`
- Updated spawn logic to:
  - preserve snake-body exclusion,
  - apply wall-distance gating for candidate cells,
  - fall back to any unoccupied cell if the gated area is exhausted,
  - keep deterministic initial pellet generation to avoid hydration mismatches,
  - respawn Nightmare-expired pellets to a new location when alternatives exist.
- Removed decorative slider border framing as part of the single-slider consolidation.

### Validation
- Verify slider labels and ordering are correct on desktop and mobile.
- Confirm tick pacing changes perceptibly across all six mode stops.
- Confirm pellet spawn envelopes by mode:
  - `VERY EASY`: never within 4 cells of walls.
  - `EASY` / `NORMAL`: never within 2 cells of walls.
  - `HARD` / `VERY HARD` / `NIGHTMARE`: full-grid spawn allowed.
- Confirm in `NIGHTMARE` that uneaten pellets respawn after ~5 seconds.
- Confirm no regressions to pause/resume, restart, score increments, or collision logic.

---

## Issue 14: `/admin` input and button interactions lag on slower devices (iPad mini 4)

### Status
- **Partially resolved through v1.5.2 (2026-02-20).**
- v1.5.1 delivered phases 1, 2, and 4a.
- v1.5.2 expanded admin test coverage, implemented the first component-isolation pass (range/reset inputs), added O(1) range-preview optimization, and decoupled snapshot refresh from action completion.
- Latest on-device iPad mini 4 validation (2026-02-20) confirms lag is improved but still present (roughly 1-2 seconds in worst typing paths).

### Observed
- On slower devices (for example iPad mini 4), typing in admin inputs and tapping buttons can lag significantly (up to ~5 seconds in worst cases).
- Lag is most visible while editing range inputs and while triggering action buttons that refresh history/snapshots.
- After input-isolation optimizations, typing lag is reduced but not eliminated; user testing still reports noticeable delay.

### Root Cause
- `src/app/admin/page.tsx` performs several expensive derived computations on every render (including every keystroke):
  - `returnedTickets` and `unclaimedTickets` rebuild from `ticketStatus` using `filter` + `map` + `sort`.
  - `ticketsCalled` and `peopleWaiting` iterate the draw order.
  - some render-time loops still scale with active queue/range size on low-power hardware.
- The configured ticket ceiling is 6 digits (`MAX_TICKET_NUMBER = 999_999`), so these render-time loops can become very large on active lotteries.
- Snapshot history fetches are still present in `/admin` background workflows; decoupling removed them from action-critical completion, but they still add network/CPU load on constrained devices.
- In DB mode, snapshot listing is now metadata-only (`id`, `created_at`), but round-trip latency can still be visible on constrained networks/devices.

### Device Context (iPad mini 4)
- iPad mini 4 is legacy hardware (A8 generation) and is on the iPadOS 15 security branch.
- Apple's current major iPadOS compatibility starts at iPad mini (5th generation), while security updates still list iPadOS 15.8.6 for iPad mini 4.
- This combination (older CPU + large render work + repeated snapshot/history requests) aligns with field reports of multi-second interaction lag.

### Fixes Applied
- **Phase 1**: Memoized all admin derived values (`returnedTickets`, `unclaimedTickets`, `currentIndex`, `nextFive`, `nextServingIndex`, `prevServingIndex`, `ticketsCalled`, `peopleWaiting`, `drawnSet`, `serverUndrawnCount`, `previewUndrawnCount`) with `React.useMemo` and precise dependency arrays. Split `undrawnCount` into a stable server-derived value + lightweight form-preview fallback. Single shared `drawnSet` eliminates duplicate `Set` construction.
- **Phase 2**: Removed duplicate `useEffect([state])` snapshot fetch; `canUndo` now derived from already-loaded `snapshots` array. DB `listSnapshots` query changed from `select id, created_at, payload` to `select id, created_at` (metadata only).
- **Phase 4a**: Added `touch-action: manipulation` to all interactive elements in `globals.css` to eliminate ~300ms iOS Safari tap delay.
- **Phase 4 (critical-path subset)**: Isolated Start/End range inputs into local-state `RangeGenerationControls` and isolated reset phrase input into local-state `ResetActionControls` so these keystrokes no longer re-render root `AdminPage`.
- **Phase 6 (dominant path)**: Replaced O(range) range-preview loop with O(1) math for end-range extension previews (`serverUndrawnCount + (previewEnd - currentEnd)`).
- **Async hardening**: Draw-navigation action handlers now catch `sendAction` rejections after toast reporting, removing the unhandled rejection seen in tests.
- **Phase 3**: Decoupled snapshot refresh from action completion and initial interactive load path (`sendAction`, `fetchState`, and undo/redo flow), so slow snapshot listing no longer blocks visible state updates.

### Remaining Recommendations
- P0: Continue profiling residual iPad mini 4 typing lag and isolate any remaining high-frequency input sections (for example returned/unclaimed fields) if long tasks persist.
- P2: Cap ticket grid animations for large grids; simplify MorphingText for static labels.
- P2: Verify generated CSS fallbacks on iPad mini 4 before adding manual `color-mix()` fallbacks.
- See `docs/V1.5_OPTIMIZATIONS.md` for full plan.

---

## Manual Test Checklist (for later implementation)
- **Returned skip:** Mark a mid-queue ticket returned, then advance Next; verify the returned ticket is skipped. Repeat with Prev.
- **Modal close:** Mark returned/unclaimed with successful response; modal closes immediately. Simulate a failed network response and confirm modal behavior matches the chosen approach.
- **Display date:** Leave display running past midnight (or simulate time change); confirm date and document title update without reload.
- **Standalone display:** Repeat date test on `npm run readonly` server.
- **Polling backoff:** Leave the display idle during open hours; confirm polling slows after 10/30/60/120 minutes without changes, and resumes quickly after a state update.
- **Visibility pause:** Hide the display tab, confirm polling stops, and verify it refreshes immediately on return.
- **Snake unified settings slider:** Sweep `VERY EASY` -> `NIGHTMARE` and verify speed + spawn rules update to each mode profile.
- **Snake nightmare mode:** Leave a pellet uneaten for >5 seconds and verify automatic respawn to a new location.

---

## Issue 15: "Generate Batch" button stays disabled after entering start/end range

### Status
- Fixed in production.

### Observed
After entering a Start Number and End Number in the admin page, only the "Generate Full" button becomes enabled. "Generate Batch" remains permanently muted/disabled even though both buttons should activate together when a valid range is entered.

### Root Cause
- The "Generate batch" button is disabled when `previewUndrawnCount === 0` (`src/app/admin/page.tsx`).
- Pre-generation (before any draw exists), `previewUndrawnCount` entered the early-return branch `if (!state || !hasDrawStarted || ...)` and returned `serverUndrawnCount`.
- `serverUndrawnCount` reads from **server state** (`state.startNumber`, `state.endNumber`), which are both `0` before the first generation — so it always returned `0`.
- Meanwhile, `canGenerateFull` (used by the "Generate Full" button) checks `hasValidGenerateRange`, which reads directly from **form inputs** (`rangeForm`), so it correctly became enabled when the user typed valid numbers.
- The parallel `undrawnCount` variable already had a form-value fallback for the pre-generation state, but `previewUndrawnCount` was missing this same fallback path.

### Fix
- Added a form-input fallback to `previewUndrawnCount` for the pre-generation state, mirroring the pattern already used by `undrawnCount`.
- When `state.startNumber === 0 && state.endNumber === 0`, the memo now reads from `rangeForm.startNumber` and `rangeForm.endNumber` instead of returning `serverUndrawnCount`.
- Added `rangeForm.startNumber` to the `useMemo` dependency array.

---

## Issue 16: Admin "Tickets issued" shows `1` after reset (no active range)

### Status
- Fixed in development (2026-02-20).

### Observed
- Immediately after `Reset for New Day`, the Live State card can show:
  - `Range`: `— – —`
  - `Tickets issued`: `1`
- Expected behavior in reset state is no issued count (`—`) or `0`.

### Root Cause
- Reset correctly restores `defaultState` where `startNumber = 0` and `endNumber = 0`:
  - `src/lib/state-types.ts`
  - `src/lib/state-manager.ts`
  - `src/lib/state-manager-db.ts`
- The admin card computes issued count unconditionally as:
  - `state.endNumber - state.startNumber + 1`
  - `src/app/admin/page.tsx`
- In reset state this evaluates to `0 - 0 + 1 = 1`, which is mathematically valid for an inclusive range but semantically wrong for "no active range."

### Implemented Fix
- Added an explicit active-range guard in admin UI logic:
  - `hasActiveRange = !!state && !(state.startNumber === 0 && state.endNumber === 0)`
  - `ticketsIssued = hasActiveRange ? (end - start + 1) : null`
- Updated the Live State card to render `ticketsIssued ?? "—"` instead of unconditional inclusive-range math.
- Added a regression test for reset-state behavior:
  - `tests/admin-page-actions.test.tsx` test: `shows dash for Tickets issued when reset state has no active range`.

### Validation
- Reset the system from a generated state; verify `Range` stays `— – —` and `Tickets issued` is `—` (or `0`, per final product decision).
- Generate a valid range (for example `1-50`) and confirm `Tickets issued` shows `50`.
- Verify no regression after append/batch flows and after reload.
