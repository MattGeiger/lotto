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
- **Partially resolved through v1.5.3 work-in-progress (2026-02-20).**
- v1.5.1 delivered phases 1, 2, and 4a.
- v1.5.2 expanded admin test coverage, implemented the first component-isolation pass (range/reset inputs), added O(1) range-preview optimization, and decoupled snapshot refresh from action completion.
- Latest on-device iPad mini 4 validation (2026-02-20) confirms typed-input lag is now mostly resolved, but button/tap latency remains measurable (several seconds in worst draw-position taps).
- Feature-flagged optimistic action UX is now implemented for `/admin` (`NEXT_PUBLIC_ADMIN_OPTIMISTIC_UI`) to reduce perceived button delay while preserving server-authoritative reconciliation.
- Latest pass (2026-02-20): split pending-state channels (`pendingDrawAction` vs `pendingNonDrawAction`) and isolated Draw Position controls into a memoized component so draw taps no longer mute unrelated controls.
- Latest pass (2026-02-20): deferred draw-triggered snapshot refresh and capped History `<select>` rendering with a clearer "Show older snapshots" checkbox affordance to reduce iPad layout cost from large option lists.
- Latest pass (2026-02-20): implemented automatic morph-text motion tiering (`full/simple/off`) with runtime detection + persistence, so older devices can degrade animation quality without introducing manual controls.

### Observed
- On slower devices (for example iPad mini 4), typing in admin inputs and tapping buttons can lag significantly (up to ~5 seconds in worst cases).
- Input-isolation work materially reduced typing lag in range/reset fields.
- Remaining lag is now most visible on action taps (especially Draw Position next/prev/clear), where UI waited on server persistence roundtrip before showing updates.
- Manual cleanup of snapshots older than 7 days produced an immediate lag reduction on iPad mini 4, further confirming snapshot-history rendering/load cost as a contributing factor.

### Root Cause
- `src/app/admin/page.tsx` performs several expensive derived computations on every render (including every keystroke):
  - `returnedTickets` and `unclaimedTickets` rebuild from `ticketStatus` using `filter` + `map` + `sort`.
  - `ticketsCalled` and `peopleWaiting` iterate the draw order.
  - some render-time loops still scale with active queue/range size on low-power hardware.
- The configured ticket ceiling is 6 digits (`MAX_TICKET_NUMBER = 999_999`), so these render-time loops can become very large on active lotteries.
- Snapshot history is no longer on the critical action path, so residual button delay now correlates more strongly with write/read persistence latency.
- In DB mode, each mutation still includes server-side state read + transaction write (state + snapshot) and runs under a 5000ms timeout budget, which aligns with observed multi-second tap latency in adverse conditions.
- Prior UI coupling also contributed: one global pending flag caused broad control disable/mute cycles on draw taps, creating additional perception of system-wide lag.
- Large snapshot lists in the History `<select>` can create expensive layout/reflow work on iPad mini 4 when refreshed on each draw action.
- Character-level morph text effects are expensive on older devices when many labels update in a single render pass, because each grapheme animates as its own motion element.

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
- **Phase 11 (new)**: Added a feature-flagged optimistic dispatcher for `/admin` actions with immediate local patching, single-flight request processing, and queue-one behavior for draw navigation (`advanceServing`/`updateServing`). Failure path now rolls back optimistic state and triggers safety resync.
- **Phase 11.1 (new)**: Split pending-state management so draw actions no longer drive non-draw control muting, and extracted Draw Position controls into memoized `DrawPositionControls` to reduce render fan-out during tap interactions.
- **Phase 11.2 (new)**: Deferred draw-path snapshot refresh timing and introduced capped History option rendering (`SNAPSHOT_RENDER_PAGE_SIZE` + "Show older snapshots" checkbox), reducing non-critical history rendering work during draw advancement.
- **Phase 12 (new)**: Added automatic morph-text motion tiering (`full/simple/off`) via reduced-motion preference + frame probe + capability hints (`hardwareConcurrency`, `deviceMemory` when available), persisted in local storage, with no manual animation toggle UI.

### Remaining Recommendations
- P0: Validate optimistic mode on iPad mini 4 and tune rollout guardrails (enable flag in staging first, verify rollback behavior under network failures).
- P0: Continue breaking up heavy `/admin` sections so draw-path updates only repaint draw-critical UI (avoid page-wide render churn on each tap).
- P0: Measure iPad mini 4 draw latency after snapshot defer/capping pass and tune refresh delay/page size as needed.
- P1: Continue profiling residual iPad mini 4 typing lag and isolate any remaining high-frequency input sections (for example returned/unclaimed fields) if long tasks persist.
- P2: Cap remaining non-morph ticket grid animations for large grids and validate low-tier display smoothness after automatic morph-tier rollout.
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

---

## Issue 18: Expired admin sign-in surfaces a one-word "Unauthorized" toast (violates ASK)

### Status
- Fixed in v1.6.3 (2026-04-16).

### Observed
- When a staff member's NextAuth JWT expires while `/admin` is still mounted, any action button (for example Next draw, Mark returned, Reset, Cleanup) triggers a Sonner error toast that reads simply `Unauthorized`.
- The admin page keeps rendering because `AdminLayout` only runs its server-side auth check on full RSC render, not per-action, so staff are left on a dashboard where every action silently fails with a cryptic toast.

### ASK Violation (Actionable, Specific, Kind)
- **Not Actionable:** "Unauthorized" gives the user no next step — there is no affordance to sign back in from the toast.
- **Not Specific:** The message does not communicate that the sign-in expired, what the user was attempting, or whether the action was applied before the failure.
- **Not Kind:** The raw HTTP status token reads as accusatory to a user whose authorization was valid a few minutes earlier.
- Reference: `docs/SECURITY.md` L1 codifies the ASK model as the target style for all client-facing errors.

### Root Cause (Code References)
- `src/proxy.ts` gates admin writes behind `auth()` and returns `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` for unauthenticated POSTs to `/api/state`.
- `src/app/admin/page.tsx` → `postAction()` parsed `body?.error` and threw `new Error("Unauthorized")`, which `sendActionLegacy` / `sendActionOptimistic` / `handleCleanup` forwarded verbatim to `toast.error(message)`.

### Fix Applied (Option 5 — refined copy + action button)
- Added `src/lib/session-expired.ts` with:
  - `SESSION_EXPIRED_MESSAGE = "Your sign-in expired. Sign back in to keep working."`
  - `SessionExpiredError` class so the admin dispatcher can distinguish 401s from generic failures.
  - `showSessionExpiredToast()` which calls `toast.error(SESSION_EXPIRED_MESSAGE, { action: { label: "Sign in", onClick } })` and routes the user to `/login?callbackUrl=<current-path>` so they return to `/admin` after re-auth.
- `postAction` now maps `response.status === 401` to `throw new SessionExpiredError()` before attempting to parse the error body.
- `sendActionLegacy` and the optimistic `processOptimisticChain` catch blocks call `showSessionExpiredToast()` when they see a `SessionExpiredError`; all other errors continue to use the existing generic toast path.
- `handleCleanup` short-circuits on 401 with the same helper, so Snapshot cleanup taps get the same ASK treatment as state mutations.

### Follow-ups (tracked for later iterations)
- Option 3 — inline re-auth modal that preserves in-flight action intent without a full-page redirect — remains a candidate for v2.0.
- Option 4 — proactive session heartbeat / pre-expiry warning — remains deferred until shift-level field data shows how often expirations hit real staff sessions.

### Validation
- Added `tests/admin-session-expired.test.tsx` covering the 401 path on `/api/state` writes, verifying the toast copy, confirming the raw `Unauthorized` token does not reach the user, and asserting the `Sign in` action button is wired.

---

## Issue 21: `/new` and `/inventory` prototype top controls drift

### Status
- Implemented in development for the current prototype pair.

### Observed
- The `/new` language onboarding modal originally allowed the William Temple
  House logo from the floating header to appear in the foreground because the
  header shared the same stacking level as dialog content and sat above the
  shared dialog backdrop.
- `/new` and `/inventory` placed persistent controls differently:
  - `/new` anchored the language switcher at top-left and the theme switcher at
    top-right, with the logo centered between them.
  - `/inventory` placed Back navigation on the left and grouped language/theme
    controls together on the right.

### Desired Behavior
- Persistent client controls should stay in predictable on-screen positions
  when moving between `/new` and `/inventory`.
- Modal focus should visually prioritize the modal and backdrop over persistent
  page chrome.
- Page-specific navigation such as Back should not displace global controls.

### Fix Applied
- Lowered the `/new` floating header from `z-50` to `z-30`, placing it below
  the shared dialog overlay (`z-40`) and dialog content (`z-50`).
- Updated `/inventory` to use the same top-control positions as `/new`:
  language switcher top-left and theme switcher top-right.
- Moved `/inventory` Back navigation into the inventory content header below
  the persistent control rail.
- Localized the `/new` inventory CTA with the shared language map so `See
  what's in stock` renders in every supported display language instead of
  staying hardcoded in English.
- Removed `/inventory` client-facing FEED jargon and the redundant `Pantry
  inventory` eyebrow/icon, localized the page title and search label, and
  restyled inventory search to use the same rounded input-group treatment as
  the public-board ticket search.
- Removed the visible `/inventory` Refresh button; inventory still loads on
  page entry, while the primary client task stays browsing/searching.
- Moved inventory result sections into a shadcn/Radix `ScrollArea` so the top
  controls, page heading/search, freshness/totals, and legend/key persist at
  the top while clients browse category sections.
- Added inner spacing inside the results scroll viewport so table/card shadows
  have room to render instead of being clipped at the scroll boundary.
- Switched the `/inventory` Back affordance from ghost to primary button styling
  and mapped its label to the existing shared `back` translation key.
- Moved `/inventory` search into the centered top-control slot to match the
  homepage header layout, and center-aligned the inventory title, freshness
  timestamp, and totals.
- Simplified the `/inventory` legend by removing its card frame and `Status` /
  `Dietary` headings, enlarging pills/icons/text, and rendering each item as
  `icon = term`.
- Increased the legend text size and explicitly overrode the shared badge icon
  size so icons scale with the larger key pills.
- Made dietary legend pills toggle item filtering with selected-state checkmark
  indicators; multiple selected dietary flags filter to items that match all
  selected flags, and status tags remain non-interactive.
- Moved status keys beneath the dietary filter row as plain `icon = label`
  entries, removed their legend pill containers, enlarged dietary filter text,
  and increased dietary flag icon size inside inventory rows/cards.
- Moved Back into the same row as the inventory title and simplified it to an
  icon-only chevron control matching the language/theme trigger style while
  preserving the localized accessible name.

### Validation
- Manual test confirmed the `/new` logo now stays behind the language modal
  backdrop while “Choose your language” has focus.
- Browser verification confirmed the shared dialog overlay is the top element
  over the `/new` logo area.

---

## Issue 19: `/new` text morph animation is too aggressive

### Status
- Implemented in development. `/new` no longer uses cycling morph text in the
  language onboarding title, and translated UI text has retired morphing in
  favor of TextScramble animation.

### Observed
- The prototype client experience at `https://williamtemple.app/new` uses text morph animation too aggressively.
- Animation triggers too often for a client-facing flow where the user is trying to choose a language, enter a ticket, and monitor status.
- The frequent movement increases visual noise and can make the page feel less stable than the core public board.

### Current Context
- `/new` is the personalized homepage prototype. It uses the shared language context and a personalized `ReadOnlyDisplay` variant to show one client's ticket status, estimated wait, tickets ahead, and called-ticket alert behavior.
- A previous page-load morph issue was documented as Issue 17 and resolved by downgrading the onboarding title from per-character morphing to a simpler transition. This follow-up is broader: even after the initial-load fix, the overall animation intensity and trigger frequency on `/new` still need product-level restraint.

### Desired Behavior
- Text should be static by default while the client is reading or entering information.
- Animation should be reserved for meaningful transitions:
  - initial language selection,
  - explicit language changes,
  - ticket status changes,
  - called-ticket alert states.
- Background/cycling copy should not keep pulling attention away from the primary task.
- Reduced-motion users should see no nonessential motion.

### Recommended Direction
1. Audit all `LanguageMorphText`, `MorphingText`, and cycling text usage on `/new`.
2. Replace nonessential morphing with plain text.
3. Keep animation only where it communicates a state change.
4. Consider disabling the language-title cycle after the user has selected a language.
5. Add focused regression coverage so `/new` does not reintroduce page-load or repeated idle morphing.

### Fix Applied
- Removed the cycling `LanguageMorphText` title from `/new` language onboarding
  and replaced it with static text.
- Added a local `TextScramble` primitive under `src/components/core` with tuned
  defaults (`duration=3.0`, `speed=0.5`).
- Added `languageTextAnimation` to `ReadOnlyDisplay`.
- `LanguageMorphText` now delegates to TextScramble for compatibility with
  existing call sites, replacing the old morph behavior for translated labels.
- `ReadOnlyDisplay` now defaults translated labels to TextScramble instead of
  `LanguageMorphText`.
- TextScramble stays static on initial mount and animates when text changes.
- The large public-board serving value now renders statically instead of using
  `MorphingText` / `RollingText`.

### Validation
- Covered by focused `/new` and display tests:
  - `tests/new-page-haptics.test.tsx`
  - `tests/homepage-ticket-persistence.test.tsx`
  - `tests/readonly-display-personalized.test.tsx`
  - `tests/readonly-display-public.test.tsx`
- Production build passes with the new component.

### Inventory Rollout Dependency
- This blocker is resolved in development. `/new` inventory entry points remain
  blocked until the remaining Issue 20 ticket reversal/clear UX work is
  resolved.

---

## Issue 20: `/new` ticket selection needs stronger reversal and pantry-day expiration semantics

### Status
- Partially implemented in development. Pantry-day/range expiration is resolved;
  stronger ticket reversal/clear controls remain open. FEED inventory entry
  points on `/new` remain blocked by the remaining reversal UX work.

### Observed
- `/new` asks clients for an individual ticket number and stores that selection for the personalized experience.
- Ticket entry must be easily reversible so a client can correct a wrong number without feeling stuck in the personalized state.
- Ticket selection must expire automatically at the start of each pantry day so stale tickets are not carried into the next service period.

### Current Context
- `/new` currently provides an `Enter a new ticket number` recovery action inside the personalized card.
- The existing persisted ticket selection is client-side browser storage and is designed to avoid carrying stale ticket state indefinitely.
- The current behavior should be re-evaluated against pantry-day semantics, not just generic local calendar-day rollover. "Start of pantry day" should be defined by pantry operating rules/state, not assumed to be midnight unless that is explicitly accepted as the product rule.

### Desired Behavior
- Reversal is obvious and available from the main personalized surface:
  - clients can change or clear the ticket number,
  - the action is not hidden below less important controls,
  - invalid corrections produce ASK-style guidance.
- Expiration aligns with pantry operations:
  - ticket state clears automatically at the start of each pantry day,
  - stale selections from a previous service day cannot silently personalize the next day,
  - the rule is deterministic across refreshes and device timezone differences.
- The selected language may persist independently from the ticket number unless product requirements later say otherwise.

### Recommended Direction
1. Define the pantry-day boundary using available LOTTO state:
   - preferred: operating-hours/timezone-aware start-of-service-day calculation,
   - fallback: explicit daily reset/timestamp marker if operating hours are unavailable,
   - avoid relying only on the browser's local midnight unless accepted as the documented rule.
2. Update `src/lib/home-ticket-storage.ts` so stored tickets expire against the selected pantry-day boundary.
3. Make correction/clear controls prominent on `/new`.
4. Add tests for:
   - changing a ticket,
   - clearing a ticket,
   - expiration at pantry-day start,
   - timezone-sensitive behavior,
   - language persistence staying independent from ticket persistence.

### Fix Applied: Pantry-Day and Range Persistence
- Replaced local-midnight-only persistence with pantry-day-aware ticket storage.
- Stored tickets now carry:
  - `serviceDayKey`, derived from configured pantry operating hours and timezone.
  - `rangeKey`, derived from the active LOTTO ticket range.
  - `expiresAt`, set to the next configured pantry opening boundary instead of
    generic browser-local midnight when operating-hours context is available.
- `/new` now receives fresh raffle state from the existing `ReadOnlyDisplay`
  polling path through an `onStateChange` callback, then revalidates the
  selected ticket against pantry-day and range context.
- If the stored/current ticket expires, loses its service-day match, or no
  longer matches the active range, `/new` clears the ticket and reopens the
  ticket-entry step.
- Arcade ticket tracking now reads persisted ticket state with the same
  operating-hours/timezone/range context so stale personalized tickets do not
  continue driving Arcade wait/called-ticket behavior.
- Old local-midnight-only stored tickets are cleared as soon as pantry-day
  context is available, preventing stale prototype storage from silently
  carrying forward.
- Added an active-range gate to `/new` ticket submission. If the tab remains
  open across a staff reset and the current state has no active ticket range,
  the modal now keeps the user in place with the message `Ticket lookup will be
  available when today's tickets are ready.` instead of accepting input,
  writing immediately-invalid storage, and reopening in a loop.

### Validation
- Added/updated focused coverage in:
  - `tests/home-ticket-storage.test.ts`
  - `tests/homepage-ticket-persistence.test.tsx`
  - `tests/arcade-now-serving-banner.test.tsx`
- Verified pantry-day expiry, previous-open-day service-key calculation before
  opening, active-range mismatch clearing, reset/no-range clearing, `/new`
  persisted-ticket writes, and Arcade ticket tracking with the new range marker.
- Added regression coverage that submitting a ticket while the active range is
  reset does not write local storage and keeps the modal stable.

### Inventory Rollout Dependency
- Do not add a "See our inventory" affordance to `/new` until the remaining
  ticket reversal/clear UX work is resolved.

---

## Issue 17: `/new` still animates text on initial page load

### Status
- Resolved (v1.6.1). Per-character morph effect downgraded to simple whole-text transition on the cycling language title as a deliberate trade-off.

### Observed
- Desired behavior: text on `/new` should render statically on first load, and only animate when language changes.
- Actual behavior: morph/entry-style animation appeared on page load for the cycling language title in the onboarding modal.

### Root Cause
The motion-tier detection system (`useMotionTier`) initializes to `"simple"` for hydration safety (SSR and client must produce identical output). After mount, an effect reads the cached tier from localStorage or runs a frame-time probe, then upgrades to `"full"` on capable devices. This tier change triggers a render-branch switch inside `MorphingText`:

- **`simple` branch**: one `<motion.span>` containing the full text string.
- **`full` branch**: one `<motion.span>` per character, each with a unique `layoutId`.

When `isFullMotion` flips from `false` to `true`, the entire child structure is replaced. `AnimatePresence` treats the new character spans as entering elements and plays their `initial → animate` transition. Additionally, the `layoutId` prop triggers Motion's separate FLIP-based layout animation system on first appearance — a mechanism that cannot be suppressed via `initial={false}` or any other documented prop.

The `AnimatePresence initial={false}` flag (already present on all render paths) correctly suppresses animation on the first mount. But the branch switch produces a *second* mount with entirely new keys, which AnimatePresence treats as new children — not initial children.

### Why Previous Approaches Failed
- **`suppressInitialAnimation` (fast-phase workaround)**: Overrode transition/stagger/initial props to make animation imperceptibly fast. Did not work because the `layoutId` FLIP animation system operates independently from the `initial`/`transition` props and still produced a visible animation frame.
- **Delay-mount pattern (mirror `readonly-display.tsx`)**: Deferred `LanguageMorphText` mount until after a post-mount effect. Did not work because on returning visits with a cached tier, `useMotionTier`'s effect resolves synchronously in the same effect batch as the `morphReady` flip — the branch switch still happened one render after mount. The pattern works in `readonly-display.tsx` because `morphReady` is gated on the first *data poll* response (hundreds of milliseconds), not a same-frame effect.
- **Modifying the `MorphingText` primitive**: Considered adding branch-switch detection via ref tracking and temporarily dropping `layoutId` on the switch render. Rejected because: (a) it modifies a shared primitive, (b) re-adding `layoutId` on the next render may itself trigger a layout animation, and (c) the behavior depends on undocumented Motion internals that may vary across versions.

### Fix Applied
- **Cycling language title** (step 1): Pinned to `motionMode="simple"` to prevent the `simple → full` branch switch entirely. The text still animates smoothly between language cycles using whole-text fade/slide transitions but does not use per-character morphing. This is a deliberate visual trade-off: the per-character morph effect is incompatible with hydration-safe motion tiering on initial mount.
- **Ticket-entry labels** (step 2): Replaced `LanguageMorphText` with plain `<span>` elements. This step only appears after language selection, so the text never changes while visible and morph animation was unnecessary.

### Files Changed
- `src/app/new/page.tsx` — added `motionMode="simple"` to cycling title; replaced step 2 `LanguageMorphText` with `<span>`.

### Validation
1. Open `/new` — cycling title appears statically on load with no visible animation.
2. Wait ~5 seconds — cycling animation starts with smooth whole-text transitions.
3. Change language — animation works correctly.
4. Open `/` and `/display` — no regressions to morph text on public board pages.

---

## Issue 22: Login and home pages are inert on iPadOS 15.8 (renders but not interactive)

### Status
- Fixed by replacing `remark-gfm` with a legacy-safe GFM plugin (no autolink-literal),
  declaring a `browserslist` floor, and adding a build-time bundle guard + tests
  (pending on-device verification).

### Observed
On iPadOS 15.8.8, in **both Safari and Chrome**, recent builds render the login
screen but it is completely inert: the email field won't accept input and the
OTP / Magic Link tabs don't switch. Newer devices are unaffected. The same defect
also affects the public visitor home page `/`.

### Root Cause (Code References)
- On iOS/iPadOS **every** browser uses Apple's WebKit, so an identical failure in
  Safari and Chrome points to a WebKit-version incompatibility. "Renders but not
  interactive" is the signature of **failed React hydration**: SSR HTML paints, but
  a script error aborts before event handlers attach.
- `remark-gfm` (via `micromark-extension-gfm-autolink-literal`) ships an email
  autolink **regex literal** using **lookbehind** `(?<=^|\s|\p{P}|\p{S})…@…`.
  JavaScriptCore only supports regex lookbehind from **Safari 16.4**; iPadOS 15.8
  is WebKit ~15.x → it throws a `SyntaxError` at script **parse** time, taking down
  the entire chunk before any code runs.
- The renderer that pulls in `remark-gfm`, `MarkdownGuideContent`
  (`src/components/help/markdown-guide.tsx`), is **statically imported** by both the
  login footer's Release Notes dialog (`src/components/release-notes-dialog.tsx` via
  `src/components/staff-links-footer.tsx`) and the home page's announcements
  (`src/components/personalized-home-page.tsx`). So the lookbehind chunk loaded
  eagerly on `/login` and `/`, bricking hydration on both.
- Contributing: no `browserslist` config existed, so the toolchain targeted only
  modern browsers. Note this is necessary-but-not-sufficient — SWC/Babel **cannot**
  downlevel a regex *literal*, so a target alone would not have fixed this.

### Approaches
1) **Code-split the markdown dialogs off the critical path** (`next/dynamic`).
   - Pros: smallest unblock for sign-in; smaller login bundle.
   - Cons: containment only — announcements are core visitor content, and Help/Admin
     markdown still break on iOS 15. Doesn't fix the syntax.
2) **Remove the lookbehind at the source** — replace `remark-gfm` with a composed GFM
   plugin that omits autolink-literal (keep tables/strikethrough/task-lists).
   - Pros: fixes the actual incompatible syntax everywhere markdown is used; keeps
     full markdown functionality on iOS 15; single chokepoint.
   - Cons: drops bare-URL/email autolinking (explicit links still work).
3) **Declare a `browserslist` floor including iOS/Safari 15 + Android/Chrome 80.**
   - Pros: establishes a real support contract; guards the broad class of
     untranspiled-syntax regressions.
   - Cons: does NOT fix this regex literal; larger bundles/polyfills.

### Recommendation
**Approach 2 as the fix** (full functionality is required on iPadOS 15.8 and on the
public visitor flow), **plus Approach 3** for a durable contract, **plus a recurrence
guard** because a regex literal slips past every transpiler and will return on the
next dependency bump.

### Fix Applied
- `src/lib/remark-gfm-safe.ts` — new legacy-safe GFM remark plugin (tables,
  strikethrough, task lists; **no** autolink-literal).
- `src/components/help/markdown-guide.tsx` — use `remarkGfmSafe` instead of `remark-gfm`.
- `package.json` — promote the GFM sub-extensions to direct deps; drop the now-unused
  `remark-gfm`; add a `browserslist` floor (iOS/Safari 15, Chrome/Android 80, FF 78,
  Edge 80).
- `scripts/check-legacy-safe-bundles.mjs` + `npm run check:legacy-bundles` — fails the
  build if forbidden regex syntax (lookbehind, `v`-flag) reappears in any chunk.
- `scripts/smoke-legacy-compat.mjs` + `npm run smoke:legacy` — loads `/` and `/login`
  and asserts hydration completed (tabs switch, email accepts input, no uncaught
  errors); documented for real-device runs on BrowserStack/Sauce.
- Tests: `tests/legacy-bundle-guard.test.ts`, `tests/markdown-guide-legacy-safe.test.tsx`.
- See `docs/BROWSER_SUPPORT.md` for the full matrix and rationale.

### Validation
1. `npm run build && npm run check:legacy-bundles` → 0 chunks contain lookbehind.
2. `npm test` → markdown subset renders; bare URLs/emails are not autolinked; guard
   rules detect lookbehind and ignore named groups / polyfilled paths.
3. `npm start && npm run smoke:legacy` → `/` and `/login` hydrate and are interactive.
4. On-device: load `/login` and `/` on a real iPadOS 15.8 (Safari + Chrome) and an
   Android 8 / Chrome 80 device — sign-in form and tabs work.

---


## Issue 23: Inventory page (and admin name bridge) stopped fetching from FEED — CORS preflight regression

### Status
- Fixed by sending the `User-Agent` header on the **server only**; the browser
  fetch is restored to a CORS "simple request" (pending production verification).

### Observed
The public `/inventory` page ("What's in stock") renders but shows
"Current inventory could not be loaded." The FEED endpoint is reachable
(`https://feed.williamtemple.app/api/public/inventory.json` returns 200 from a
browser). The same break silently disabled the admin **inventory-name bridge**
in Find Missing (also a browser fetch).

### Root Cause (Code References)
- A cross-origin browser `fetch()` is a CORS **"simple request"** (no preflight)
  only if every header is CORS-safelisted. `Accept` is safelisted; **`User-Agent`
  is not**.
- Commit `7eda979` ("send a User-Agent on server fetch") added
  `headers: { "User-Agent": …, Accept: … }` to the **shared**
  `fetchFeedPublicInventoryFromUrl` in `src/lib/feed-public-inventory.ts`. The
  intent was server-only, but the function is also called from the browser:
  - `src/components/public-inventory-page.tsx` (visitor page), and
  - `src/components/translation/find-missing-dialog.tsx` (admin name bridge).
- Adding `User-Agent` promoted the browser GET to a **preflighted** request.
  FEED's preflight response advertises only `Access-Control-Allow-Headers: Content-Type`
  (verified live), so the `user-agent` preflight fails and the browser blocks the
  GET → `fetch()` rejects → the page shows the load-failure state.
- The header also helped nothing it targeted: `7eda979`'s own probe found the
  server fetch "returns nothing … with and without a UA" (the server path is
  Cloudflare-blocked — see the cloudflare-block note / FEED ISSUES.md #45).

### Approaches
1) **Send custom headers server-side only** (`typeof window === "undefined"`);
   browser sends a simple GET (keep safelisted `Accept`).
   - Pros: surgical; restores the verified-working simple GET on both browser
     paths; preserves the server intent at zero browser risk; self-documenting.
   - Cons: env branch in a shared fn; the server UA is an unproven no-op.
2) **Remove the `User-Agent` header entirely.**
   - Pros: simplest full revert; the UA demonstrably never helped.
   - Cons: drops the (unproven) defensive server UA.
3) **Same-origin server proxy (`/api/inventory`).**
   - Pros: no browser CORS at all; could add server caching/translation.
   - Cons: reintroduces the Cloudflare datacenter-egress block (FEED #45) → would
     likely break the page in production; adds edge-request volume/latency
     (cf. Issue 4). Net worse.

### Recommendation
**Approach 1.** It targets the proven mechanism (the browser fetch must stay a
simple request), fixes both broken browser paths at once, preserves the original
server-side intent with no browser risk, documents the constraint to prevent
recurrence, and avoids Approach 3's reintroduction of the Cloudflare block.

### Fix Applied
- `src/lib/feed-public-inventory.ts` — build `headers` per runtime: always
  `Accept: application/json`; attach `User-Agent` only when `typeof window ===
  "undefined"` (server).
- `tests/feed-public-inventory.test.ts` — browser branch sends no `User-Agent`;
  added a regression guard asserting only CORS-safelisted headers leave the
  browser, plus a server-branch test that keeps the `User-Agent`.
- `docs/FEED_PUBLIC_INVENTORY.md` — documented the CORS preflight constraint and
  the runtime-split header policy. CHANGELOG updated.

### Validation
1. `npm test` → browser fetch sends only `Accept`; server branch sends `User-Agent`;
   regression guard passes.
2. Live CORS check: `OPTIONS` preflight requesting `user-agent` returns
   `Access-Control-Allow-Headers: Content-Type` (rejected); a header-less GET
   returns 200 + `Access-Control-Allow-Origin: *`.
3. On deploy: `/inventory` loads current stock; admin Find Missing bridges
   inventory names again.

---

## Issue 24: Bottom tab bar swallows clicks across its whole row on wide screens

### Status
- Fixed and deployed (commit `e2deebf`, pushed to `main`/production).

### Observed
On wide viewports (desktop, iPad), the entire horizontal band where the bottom
navigation sits was unresponsive. A control on the left or right side of the
viewport that happened to share that row with the centered nav pill could not be
clicked/tapped until the user scrolled it out of the band. On mobile the bar
behaved normally.

### Root Cause (Code References)
- The bar is a two-element structure: a fixed `<nav>` wrapper and an inner
  `<ul>` pill (`src/components/navigation/bottom-tab-bar.tsx`; arcade copy in
  `src/arcade/components/arcade-bottom-tab-bar.tsx`).
- The `<nav>` wrapper is `fixed inset-x-0 bottom-0 z-40 flex justify-center` —
  i.e. it spans the **full viewport width** so the pill can center.
- On mobile the `<ul>` is `w-full`, so the visible bar fills the wrapper. On
  `sm:` and up the pill becomes `sm:w-auto` (a centered capsule), leaving large
  **transparent but pointer-opaque flanks** on either side that belonged to the
  wrapper. With `z-40` above page content and no `pointer-events-none`, those
  flanks intercepted every click in the bottom row.

### Approaches
1) **`pointer-events-none` on the wrapper, `pointer-events-auto` on the pill.**
   - Pros: one line per bar; within an existing pattern (the wrapper already
     gets `pointer-events-none` in the display auto-hide state); preserves the
     documented floating-capsule layout, z-index, RTL, safe-area, and a11y;
     lowest regression surface; composes with `inert` so the hidden auto-hide
     state stays non-interactive.
   - Cons: patches a too-wide box rather than shrinking it.
2) **Shrink the fixed box to the pill** (`sm:left-1/2 -translate-x-1/2 w-auto`).
   - Pros: hit-area equals visible area; no pointer-events trickery.
   - Cons: more invasive; the auto-hide `translate-y-full` hide animation must
     compose with the centering transform (footgun); re-test RTL/safe-area;
     larger diff across two components.
3) **In-flow sticky footer in a per-page column shell.**
   - Pros: eliminates the overlay entirely.
   - Cons: contradicts the documented "floating capsule above content, always
     visible" design and the display auto-hide overlay; touches every consumer.
     Overkill.

### Recommendation
**Approach 1** — smallest, lowest-risk, within existing patterns, and preserves
the `docs/NAVIGATION.md` source-of-truth design. A hybrid of 1+2 was considered
and rejected as redundant (each fully closes the defect on the same axis).

### Fix Applied
- `src/components/navigation/bottom-tab-bar.tsx` — `pointer-events-none` on the
  `<nav>` wrapper; `pointer-events-auto` on the `<ul>` pill.
- `src/arcade/components/arcade-bottom-tab-bar.tsx` — same change (shared defect).
- `docs/NAVIGATION.md` — documented the wrapper/pill pointer-events contract.
- `CHANGELOG.md` — `[Unreleased] → Fixed` entry.

### Validation
1. `npm run build` → `✓ Compiled successfully`; `/arcade` prerendered cleanly.
2. Live DOM hit-test at 1280×800 on the nav row: the four flank x-positions
   resolved to page content (clicks fall through); the centered pill positions
   resolved to `NAV-LINK` (still interactive). Mobile `w-full` unaffected.
3. `npm run lint` clean on both components.
4. Confirmed working in production after deploy (no issues found).

---

## Issue 25: Stale pantry date in browser tab title and Google search results

### Status
- Fixed (pending push/deploy).

### Observed
A Google search for the site showed a search-result title with a stale pantry
date — "Food Pantry Service For Thursday, June 25th, 2026" — while the live
browser tab read "Food Pantry Service For Tuesday, June 30th, 2026". The static
meta description ("See your place in line…") was correct; only the dated title
was stale, causing date confusion for searchers.

### Root Cause (Code References)
- `src/components/readonly-display.tsx` set the document title on the client:
  `document.title = \`${t("foodPantryServiceFor")} ${formattedDate}\``.
- `ReadOnlyDisplay` renders on the indexed home page (`/` →
  `PersonalizedHomePage` → `ReadOnlyDisplay`), so the dated, client-set `<title>`
  was what Googlebot rendered and indexed. Google re-crawls/JS-renders
  infrequently, so it froze the date from the crawl day (June 25th) into the
  result, independent of the live value.
- The static `metadata.title.default` ("William Temple House App") and
  `metadata.description` in `src/app/layout.tsx` were correct and
  server-rendered; the client override was shadowing the title.

### Approaches
1) **Remove the client `document.title` override; rely on static
   server-rendered `metadata.title`.**
   - Pros: title becomes stable and reliably crawlable; no date can go stale;
     one-effect deletion; in-page service date is unaffected.
   - Cons: the tab no longer reflects the live date (intended — the date lives
     in-page).
2) **Keep a dynamic title but expose it via server `generateMetadata`.**
   - Pros: server-rendered date would at least be crawlable.
   - Cons: still stale between Google crawls; the date depends on per-request
     "today" and timezone, adding server-render complexity for no SEO benefit.
3) **Static, descriptive page title with no date** (e.g. a custom string).
   - Pros: descriptive in search.
   - Cons: chose the existing static default instead to keep one source of truth
     (`metadata.title` in layout).

### Recommendation
**Approach 1.** Public title/description should be stable; the live date belongs
in the page body, not the indexed `<title>`. Static text chosen: the existing
`metadata.title.default` "William Temple House App".

### Fix Applied
- `src/components/readonly-display.tsx` — removed the `document.title` effect;
  added a comment explaining why the title is intentionally static (prevents a
  re-add that would reintroduce stale Google indexing). The in-page
  `service-date` heading still renders the live date.
- `CHANGELOG.md` — `[Unreleased] → Fixed` entry.

### Validation
1. `npm run lint` clean.
2. Live preview on `/`: `document.title === "William Temple House App"` (no
   date); meta description unchanged; the in-page `service-date` still shows the
   live pantry date.
3. Post-deploy, Google will pick up the static title on its next crawl (no
   action needed; the stale dated title disappears once re-indexed).

---

## Issue 26: "Add to Home Screen" icon is a generic glyph on black (no app icon)

### Status
- Fixed (pending push/deploy).

### Observed
Adding the site to an iOS home screen produced a generic "W" on a black
background instead of the WTH brand mark. Android / installable-PWA had no
defined icon either.

### Root Cause (Code References)
- The repo had **no** `apple-touch-icon`, no `icon.png`, and no Web App Manifest
  — only `src/app/favicon.ico` (48×48, **transparent** RGBA).
- iOS "Add to Home Screen" ignores `favicon.ico` and looks for an
  `apple-touch-icon` link. With none present, Safari fell back to the tiny
  transparent favicon, scaled it up, and **filled the transparency with black**
  (iOS does not support alpha for home-screen icons) — the "W on black."
- Not an iOS limitation; a missing/oversized asset.

### Approaches
1) **Add a dedicated opaque icon set + manifest (iOS + Android/PWA).**
   - Pros: correct, cross-platform brand alignment; uses Next.js file
     conventions (`apple-icon.png`, `icon.png`, `manifest.ts`) so links are
     auto-emitted; the WTH emblem crops cleanly at high resolution.
   - Cons: a few new binary assets to maintain.
2) **iOS-only `apple-touch-icon`.**
   - Pros: smallest change; fixes the reported iPhone case.
   - Cons: leaves Android / PWA installs with no defined icon.
3) **Regenerate a higher-res, opaque `favicon.ico` only.**
   - Pros: one file.
   - Cons: iOS still won't use favicon for the home screen; does not solve the
     reported problem.

### Recommendation
**Approach 1** — the only option that actually fixes iOS and gives consistent
Android/PWA branding. Source: the WTH emblem (layered faces + sun) cropped
~603×603 from `public/wth-logo-horizontal.png` (2314×606), centered on opaque
white with ~12% padding (maskable variant uses ~22% for the Android safe zone).
Background white chosen to match the official logo presentation; user-approved.

### Fix Applied
- `src/app/apple-icon.png` (180×180) — iOS apple-touch-icon (Next auto-links).
- `src/app/icon.png` (512×512) — browser/general icon (Next auto-links).
- `public/icons/icon-192.png`, `icon-512.png` (purpose `any`),
  `icon-maskable-512.png` (purpose `maskable`) — Android/PWA manifest icons.
- `src/app/manifest.ts` — Web App Manifest (`/manifest.webmanifest`): name
  "William Temple House App", short_name "Temple House", `display: standalone`,
  `background_color: #ffffff`, `theme_color: #2762a2`.
- `favicon.ico` retained for legacy desktop tabs.
- `docs/icon-candidates/` holds the review-only PNGs + README (not wired in).
- `CHANGELOG.md` — `[Unreleased] → Added` entry.

### Validation
1. `npm run build` → `✓ Compiled successfully`; `/manifest.webmanifest`
   prerendered.
2. Live preview on `/`: head emits `<link rel="apple-touch-icon" sizes="180x180">`,
   `<link rel="icon" sizes="512x512">`, and `<link rel="manifest">`;
   `/manifest.webmanifest` returns 200 with the expected name/theme/icons; all
   five icon assets return 200.
3. On-device check after deploy: iOS and Android "Add to Home Screen" show the
   WTH emblem on white.

---

## Issue 27: Intermittent full-suite-only failure in `readonly-display-public.test.tsx` (confirmed flake, not a stale test)

### Status
- Test stabilization applied after the same failure recurred during the
  v1.21.0 production-readiness run. The product behavior was not defective.

### Observed
`npm test` (full suite, `vitest run`) failed once on
`tests/readonly-display-public.test.tsx` → `"keeps ticket grid layout LTR for
RTL languages"`, at the assertion:
```
expect(screen.getByText("لم يُنادى").closest("[dir='rtl']")).toContainElement(...)
```
635/636 tests passed; only this one failed, in that one run.

### Why this looked suspicious (and wasn't)
The failing test's name ("keeps ticket grid layout LTR for RTL languages")
and the surrounding design history — LOTTO used to reverse the ticket grid's
physical layout for RTL languages (Arabic/Farsi), a design later abandoned
because it was confusing; the grid, ticket buttons, and status key are now
pinned `dir="ltr"` regardless of language, with only individual localized text
nodes getting their own nested `dir="rtl"` scope for correct glyph shaping —
made it worth checking whether the test was stale (asserting the old,
abandoned reversed-layout behavior) rather than actually broken.

**It is not stale.** Reading the test directly confirms it asserts exactly the
*current*, intended design:
- `ticket-grid`, the ticket button, and `ticket-status-key` are all asserted
  `dir="ltr"`.
- The Arabic status label (`"لم يُنادى"`) is asserted to be nested inside its
  own `dir="rtl"` element — confirming text-level RTL shaping coexists with a
  structurally-LTR grid.

This is a regression guard *for* the abandon-the-reversed-layout decision, not
a leftover assertion of the old one. If the old reversed-grid behavior ever
crept back in, this test would fail loudly and correctly.

### Root Cause (confirmed via reproduction, not assumed)
1. Ran the single file in isolation (`npx vitest run
   tests/readonly-display-public.test.tsx`) → **12/12 passed**, including this
   test, with no code changes.
2. Re-ran the **full suite** a second time, again with zero code changes in
   between → **636/636 passed**, including this test.

Same test, same assertions, same code, two different full-suite outcomes.
That rules out a stale/incorrect assertion (which would fail deterministically
every time) and points to **test-parallelism/resource contention** across the
82 test files running concurrently under Vitest's worker pool — e.g. timing
pressure on an async `findByText`/DOM query under load — not a logic bug in
the test or the component.

### Approaches considered
1) **Treat as a one-off flake; document the reasoning; take no action.**
   - Pros: matches the evidence (passes in isolation, passes on full-suite
     rerun); avoids touching a correct, well-targeted regression test based on
     a single non-reproducing failure.
   - Cons: does not reduce whatever timing pressure exists, if it's real.
2) **Modify the test to reduce timing sensitivity** (e.g. wrap the
   `getByText`/`closest` assertion in `waitFor`).
   - Pros: could pre-empt a real race if the async find above it resolves the
     element before rendering finishes settling.
   - Cons: speculative — there is no reproduction to confirm this is the
     actual mechanism; changing a passing, correct test without a reproducing
     failure risks masking a future real regression instead of catching it.
3) **Reduce Vitest worker parallelism** to eliminate cross-file resource
   contention as a variable.
   - Pros: would address the suspected root cause directly if contention is
     real.
   - Cons: slows the whole suite for a single non-reproducing failure; not
     justified without a reproduction or a pattern of recurrence.

### Recommendation
**Approach 1.** One non-reproducing failure, immediately followed by a clean
full-suite rerun with no changes, is not enough signal to justify modifying a
correct test or the suite's parallelism settings. Documenting the reasoning
here (and in `AGENTS.md`) means a future recurrence gets evaluated with this
context instead of being re-investigated from scratch or, worse, assumed to
mean the test is stale and "fixed" by loosening/removing its assertions.

### If this recurs
- **Don't assume the test is stale or wrong** — re-read it first; compare
  against the current design intent (check `docs/user-guides/06-*.md` /
  relevant RTL docs, not memory).
- **Reproduce before changing anything:** run the single file in isolation,
  then re-run the full suite once more. A failure that doesn't reproduce
  either way is still most likely parallelism/timing, not logic.
- **Only escalate to a real fix** (e.g. `waitFor` around the assertion,
  reduced worker parallelism) if it fails **repeatedly** or **reproducibly**,
  not from a single occurrence.

### Recurrence and stabilization — 2026-08-24

The v1.21.0 production-readiness run reproduced this failure in two consecutive
full-suite runs while the file continued to pass in isolation. The failed DOM
captured other Arabic labels with their final characters still replaced by the
intentional language-change scramble animation, confirming that the assertion
was reading during the animation rather than observing an RTL layout defect.

The test now wraps the localized `notCalled` lookup and RTL-containment check in
`waitFor`. This preserves every existing assertion and waits only for that
label's own animation to settle. No component or user-facing behavior changed.

### Related application of the flake procedure — 2026-08-24

During validation of the Admin FEED-status indicator, the first full-suite run
found the Start Number input before the Admin page's asynchronous queue-state
hydration had locked it. `tests/admin-range-locking.test.tsx` then passed 2/2 in
isolation, and the unchanged full suite passed 724/724 immediately afterward.
The feature-specific tests, lint, and production build were also clean. This is
the same one-off worker-pressure signature described above, not evidence that
range locking or the FEED indicator is defective. No assertion was loosened.
If this exact failure recurs, stabilize the disabled-state assertion with
`waitFor` rather than changing the range-locking contract.

### Related application of the flake procedure — 2026-09-01

During the Phase 4 exact-revision validation, one unchanged full-suite run
sampled `window.__LOTTO_REALTIME_CANARY__` before the mock WebSocket frame
updated it, although the visible observer had already mounted. The observer
file passed 4/4 in isolation, and the immediately repeated unchanged full suite
passed 898 tests with one expected skip. The preceding full-suite run had also
passed. This is the documented one-off worker-pressure signature, not evidence
of a client state-machine defect, so no assertion or implementation was
changed.

The same timing signature appeared once during the September 2 kill-switch
validation: the observer file passed 4/4 in isolation and the unchanged full
suite then passed 908 tests with one expected skip. The assertion and
implementation again remained unchanged.

---

## Issue 28: Operating-hours API accepts malformed or conflicting time values

### Status
- Open; documented for a later hardening milestone. No runtime behavior changed.

### Observed
The Admin operating-hours editor uses native time inputs, but the persisted
state contract does not independently prove that each `openTime` and
`closeTime` is a valid 24-hour `HH:mm` value. It also does not reject an open
day whose closing time is equal to or earlier than its opening time.

### Root Cause (Code References)
- `src/app/api/state/route.ts` validates the seven-day operating-hours object
  and timezone, but its day-level schema accepts arbitrary strings for
  `openTime` and `closeTime`.
- `src/components/operating-hours-editor.tsx` normally supplies valid values
  through `<input type="time">`, but UI controls are not a server-side data
  integrity boundary. Direct API callers, stale clients, imported state, or
  future editor changes can bypass those browser constraints.

### Risk
- Malformed strings can make open/closed-window calculations unreliable.
- A closing time before the opening time creates a conflicting schedule that
  can distort operating-hours-aware polling and any future time-window
  analytics.
- Invalid state can persist successfully and become harder to diagnose later
  because the editor itself appears constrained.

### Recommended Fix
Harden the centralized API schema rather than relying on the editor:

1. Require exact 24-hour `HH:mm` values (`00:00` through `23:59`) for every
   stored opening and closing time.
2. For days marked open, require `closeTime > openTime`.
3. Continue retaining time values for closed days so reopening a day does not
   erase the prior schedule.
4. Return actionable validation copy identifying the affected day and field.
5. Add route tests for malformed time strings, equal times, closing-before-
   opening, closed-day retention, and a valid seven-day schedule.

Overnight operating windows are not supported by the current UX. If they
become a requirement, model them explicitly rather than weakening the
same-day ordering rule.

---

## Issue 29: New-agency Neon databases don't get schema applied automatically, and the doc previously encouraged skipping it

### Status
- Fixed for St. Johns (schema applied against production); documentation fixed
  to prevent recurrence for future agencies.

### Observed
St. Johns Food Share deployed successfully — the build passed, `/display`
loaded and showed brand-correct content — but staff sign-in was completely
broken. OTP requests returned "Unable to issue code. Please try again." and
Magic Link returned NextAuth's generic "Configuration" error page. Neither
error message mentions a database at all, making this look like an auth
misconfiguration (wrong `AUTH_SECRET`, wrong `AUTH_URL`, etc.) rather than a
missing-tables problem.

### Root Cause (Code References)
- `src/app/api/auth/otp/request/route.ts` does
  `DELETE FROM verification_token WHERE identifier = $1` unconditionally; if
  that table doesn't exist, Postgres throws `relation "verification_token"
  does not exist`, caught by the route's outer `try/catch` and surfaced as the
  generic "Unable to issue code" message.
- `@auth/pg-adapter` (used for Magic Link) requires `users`, `accounts`,
  `sessions`, and `verification_token` to exist; NextAuth's generic
  "Configuration" error is what it shows for any adapter-level failure,
  including missing tables.
- The actual required schema lives in `schema.sql` at the repo root and is
  applied idempotently by `scripts/apply-schema.mjs` (`npm run db:migrate`).
  It defines 13 tables: the two raffle tables, five NextAuth/OTP tables
  (`verification_token`, `users`, `accounts`, `sessions`, `otp_failures`), and
  six AI-translation tables (`languages`, `ai_configurations`,
  `system_prompts`, `translations`, `usage_records`, plus indexes).
- **This doc (`docs/DEPLOYMENT.md`) previously embedded a stale, partial copy**
  of the schema — only `raffle_state` and `raffle_snapshots` — under a
  "Postgres schema (run once)" heading, predating the NextAuth/OTP/AI-
  translation tables being added to `schema.sql`. Following that snippet
  instead of the real file reproduced exactly the gap that broke St. Johns'
  launch: the raffle tables existed, so `/display` worked; the auth tables
  didn't, so sign-in didn't.

### Fix
- Ran every `CREATE TABLE`/`CREATE INDEX` statement from `schema.sql` against
  the St. Johns Neon database (see Issue 30 for *how*, since the connection
  string wasn't directly accessible). Verified via Neon's Schema tab that all
  13 `public`-schema tables exist, then confirmed both OTP and Magic Link
  succeed end-to-end.
- `docs/DEPLOYMENT.md`'s "Postgres schema" section no longer embeds a copy of
  the schema at all — it points at `schema.sql` and `npm run db:migrate` by
  reference, with an explicit warning not to re-embed a subset here again.

### Prevention
- The new-agency runbook in `docs/DEPLOYMENT.md` (`New agency deployment
  runbook`, step 3) makes schema application an explicit, checked step with
  its own failure-mode writeup, rather than a one-line item easy to skim past
  in a checklist.
- If this recurs: check `otp_failures`/`verification_token`/`users` exist in
  the `public` schema before assuming it's an `AUTH_SECRET`/`AUTH_URL`/DNS
  problem — the error messages give no indication either way.

---

## Issue 30: Vercel "Sensitive" environment variables cannot be revealed after creation, including by the project owner

### Status
- Documented; not a bug to fix, a platform constraint to work around.

### Observed
`DATABASE_URL` (and its siblings — `DATABASE_URL_UNPOOLED`, `POSTGRES_*`,
`PGHOST`, etc.) created by Vercel's Neon Marketplace integration are stored as
**Sensitive** environment variables. Every attempted way to read the actual
value back out failed:
- Vercel dashboard → Environment Variables: the row shows a lock icon, not an
  eye/reveal icon (contrast with non-sensitive vars like `AUTH_BYPASS`, which
  do show an eye icon and can be revealed).
- `vercel env pull --environment=production`: writes the literal string
  `"[SENSITIVE]"` into the `.env` file in place of the value — including with
  `--yes`, and including when run from an actual interactive terminal (faked
  via `script -q /dev/null`, to rule out "non-interactive mode" as the cause).
- The Neon integration's own embedded "Guides" page (Storage tab → Getting
  Started → `.env.local` snippet with a "Show secret" toggle): also renders
  the value as asterisks, not the real string.

### Root Cause
This is intentional behavior for Vercel's "Sensitive Environment Variables"
feature, not a bug or a permissions issue — sensitive vars are encrypted such
that even the project owner cannot view the value again through any of
Vercel's own surfaces once it's created. It is not something to "try harder"
to work around (e.g. don't spend time hunting for another CLI flag).

### Fix / Workaround
For a database provisioned through Vercel's own "Create Database" flow, run
SQL directly against it without ever needing the connection string, via the
Neon integration's embedded **Query** tool (Vercel dashboard → project →
**Storage** → the database → **Query**, in the left nav under "Database"):
- The first write query in a session requires **2FA** confirmation (the
  account's own security — have the account owner complete it; don't attempt
  to bypass it).
- Toggle **Read-only** off before running write statements.
- **The query box only accepts one SQL statement per execution** — see
  Issue 29's fix and `docs/DEPLOYMENT.md` step 3 for the resulting
  one-statement-at-a-time schema-application workflow.
- A **Schema** tab (same left nav) lets you inspect tables per-schema; it
  defaults to Neon's own internal `neon_auth` schema in the URL, not the
  app's `public` schema — switch the schema selector explicitly.

### Prevention / Recommendation
For future agencies, consider provisioning the Neon database directly at
[console.neon.tech](https://console.neon.tech) (outside Vercel's Marketplace
flow) and connecting it to Vercel as an *existing* database instead of using
"Create Database." That path gives permanent access to the real connection
string from Neon's own console, which means `npm run db:migrate` works locally
against production without the embedded-query workaround. The first secondary
agency database already existed via the Marketplace flow before this constraint
was discovered.

---

## Issue 31: Vercel Framework Preset silently defaulting to "Other" causes every route to 404 despite a successful build

### Status
- Fixed for the affected agency deployment (redeployed after correcting the setting); added as an
  explicit check to the new-agency runbook so it isn't rediscovered by
  accident again.

### Observed
After a new agency Vercel project's first production deployment showed
**Ready** with no errors in the build log, every route on its custom domain
— including `/`, `/display`, and even the apex — returned Vercel's generic
`404: NOT_FOUND` page (format: `Code: NOT_FOUND`, `ID: <region>::<hash>`).
Confirmed the domain and SSL were correctly pointed at the deployment (DNS and
TLS were fine); the deployment itself just didn't route to anything.

### Root Cause
**Settings → Build and Deployment → Framework Preset** was set to **"Other"**
instead of **"Next.js"** for this project. `npm run build` (via `next build`)
still succeeds under "Other" — Vercel just doesn't know to wire the resulting
`.next` output up as a Next.js app's routing/serverless functions, so nothing
is actually reachable. There is no warning or error anywhere in the build log
or deployment summary pointing at this; the only symptom is every route 404ing
in production while the build itself reports success. Likely cause: the
project was originally created via the Storage/"Create Database" flow before a
Git repository was ever connected, so Next.js auto-detection (which normally
inspects the connected repo's `package.json`/`next.config.ts`) never ran
against real project files at creation time.

### Fix
1. **Settings → Build and Deployment → Framework Preset** → change to
   **Next.js** (this repopulates the Build/Output/Install/Dev Command fields
   with Next.js defaults) → **Save**.
2. Saving the setting does **not** retroactively fix the already-Ready
   deployment — a new deployment must be triggered. Used **Deployments → ⋯ →
   Redeploy**, which explicitly offers "with the latest Project Settings," and
   left **Use existing Build Cache** unchecked to avoid reusing any
   "Other"-preset build artifacts.
3. Confirmed the new deployment's Environment showed **Current** with the
   domain attached, then loaded `/display`, `/`, `/inventory` (expected 404 —
   queue-only profile), and `/admin` (expected redirect to sign-in) to confirm
   real Next.js routing was active, not just a bare 404 for everything.

### Prevention
`docs/DEPLOYMENT.md`'s new-agency runbook (step 1.4) makes verifying Framework
Preset an explicit, named check before the first deployment, specifically
because nothing else in the setup flow surfaces this failure.

---

## Issue 32: Personalized-homepage header logo can overlap "NOW SERVING" on mobile for brands with a taller-than-wide logo lockup

### Status
- Fixed (`src/components/personalized-home-page.tsx`); merged and deployed.

### Observed
On a real iPhone, a secondary agency's personalized homepage showed its taller
header logo sitting almost flush against the
"NOW SERVING" label directly below it, with very little clearance — reported
by comparing directly against the William Temple House variant on the same
device, where the equivalent gap is clearly visible. Did **not** reproduce in
an initial local check at a 375×812 mobile viewport with generous measured
clearance, which is a useful data point on its own: a quick local viewport
resize is not sufficient verification for this class of bug — check on an
actual device, or at least take and inspect a real screenshot rather than
reasoning from computed CSS box measurements alone.

### Root Cause (Code References)
- `src/components/personalized-home-page.tsx`: the header (`LanguageSwitcher` +
  `BrandLogo` + `ThemeSwitcher`) is rendered in an `absolute` positioned
  container (`absolute left-6 right-6 top-4 z-30`), overlaid on top of
  `ReadOnlyDisplay`'s normal document flow rather than pushing it down.
- `src/components/readonly-display.tsx`: the personalized-mode wrapper reserves
  a **fixed** top clearance (`pt-14` plus `mt-10`/`mt-12` on the first content
  row) sized to comfortably fit William Temple House's very wide horizontal
  wordmark (`wth-logo-horizontal.png`, declared 2314×606 → ~3.82:1 aspect
  ratio at any given width).
- `src/components/brand-logo.tsx` previously sized the header logo by a fixed
  **width** (`className="w-full max-w-[220px]"`) with `h-auto`, so its
  rendered height was purely a function of each brand's own aspect ratio.
  The secondary logo's stacked wordmark (~2.3:1 at the light-mode asset's
  declared dimensions) rendered
  noticeably taller than WTH's at the same width — enough, in practice, to
  exceed the reserved clearance and overlap the flowed content below it.

### Fix
Changed the header logo instance in `personalized-home-page.tsx` to size by a
fixed **height** instead: `imageClassName="h-12 w-auto max-w-full"`. This caps
the rendered logo to the same height for every brand regardless of its
lockup's aspect ratio, so the fixed clearance below it is guaranteed to be
sufficient without needing to be retuned per brand. Verified locally at a
375×812 mobile viewport for both the secondary appearance (no more overlap)
and WTH (visually unaffected — its logo was already under the new height cap).

### Prevention
Carried into `docs/CONFIGURABLE_BRANDING_PLAN.md` as the fixed-height header
logo rule, including the "don't trust a quick localhost check" lesson from how
this one was actually found.

---

## Issue 33: A secondary light-mode primary button had poor text contrast

### Status
- Fixed in the retired secondary compiled stylesheet; merged and deployed.

### Observed
Filled primary buttons in the secondary light theme (e.g. "Enter a new ticket
number") showed dark, low-contrast text against the mid-green button fill —
hard to read.

### Root Cause (Code References)
- The retired secondary theme's light block set `--primary-foreground` to a
  near-black green
  (`oklch(0.270912 0.040942 166.051)`), which sits too close in lightness to
  `--primary` (`oklch(0.644157 0.121025 163.057)`) for comfortable contrast on
  a filled `bg-primary text-primary-foreground` surface.
- No automated check catches this: the existing branding regression tests
  (see `docs/CSS_THEME_ARCHITECTURE.md`) verify that agency selectors don't
  override *protected operational-status* tokens, but they don't assert
  contrast between a brand's own `--primary`/`--primary-foreground` pair.

### Fix
Changed light-mode `--primary-foreground` to
`oklch(0.953 0.051 180.801)` (a crisp near-white) per explicit design
direction. Dark mode's `--primary-foreground` was left unchanged — it wasn't
reported as a problem, and the fix intentionally stayed scoped to the theme
block that was actually observed to be broken rather than "fixing" an
unconfirmed pairing preemptively.

### Prevention
The lesson moved into `docs/CONFIGURABLE_BRANDING_PLAN.md`: validate
primary/foreground contrast automatically for every saved appearance.

## Issue 34: Page-wide Radix `useId` hydration mismatch reported on `/admin` (not reproducible on a consistent build)

**Reported (2026-07-19):** during Appearance testing ("when switching
themes"), the dev overlay showed a hydration warning on `/admin` in which
every Radix-generated id (`aria-controls`, accordion `id`/`aria-labelledby`)
differed between server and client — attributes only, identical tree shape
and text. In React 19, `useId` values encode tree position, so a page-wide
shift means the server and client rendered structurally different component
trees.

**Investigation:** could not be reproduced across clean loads of `/admin` in
any state: custom appearance active (inline runtime `<style>` present),
activation + reload round-trips, dark mode, Hi-viz, or defaults. A full audit
of components rendered on `/admin` found no render-time structural branches
on `typeof window`, storage, time, or randomness — the classic causes; all
such reads are effect-guarded (`ThemeSwitcher` uses the mounted-state
pattern, `ContrastModeProvider` applies classes in effects, admin state
initializers are deterministic).

**Most likely causes (both environmental):**
1. **Dev-server restarts mid-session.** The dev server was killed/restarted
   several times while a browser held a previously loaded session; the next
   reload can hydrate new server HTML with stale cached client chunks (or
   vice versa), yielding exactly this signature. Not possible in a
   production build (hashed immutable chunks).
2. **A browser extension** mutating the DOM before React hydrates (password
   managers, Grammarly, etc.) — explicitly called out by React's own
   hydration-error message and consistent with attributes-only, page-wide id
   shifts in one browser profile but not a clean one.

**Related real fix made during the audit:** the public board's service clock
(`readonly-display.tsx`) initialized from `Date.now()` and rendered
`Intl.DateTimeFormat` text that can legitimately differ between the server
render and hydration (minute boundary; Node vs. browser ICU emitting
different spaces before AM/PM). That is a genuine hydration-warning source of
the same family the report cites, now fixed with `suppressHydrationWarning`
on the clock text (the mounted clock interval corrects the value
immediately).

**Prevention/reopening:** if this reproduces on a production build or on a
clean browser profile with a stable dev server, treat it as real: bisect by
commenting regions of `admin-page-client.tsx` and diff the SSR HTML
(`curl /admin`) against the hydrated DOM's Radix id sequence to locate the
first divergent sibling.

---

## Issue 35: Severe input lag typing in the Announcement editor on older devices (iPad mini 4)

### Status
- **Resolved in v1.20.1 (2026-07-20).**
- This is a recurrence of the Issue 14 class of defect (page-wide keystroke
  fan-out) in a surface added *after* the v1.5 input-isolation work.

### Observed
- On iPad mini 4 class hardware, editing the Announcement copy in
  `/admin` → Advanced → Announcement produced multi-second latency between
  pressing a key and seeing the character appear.
- Not reproducible on the development machine (Apple silicon, 128 GB), which
  is exactly the blind spot recorded in Issue 14: the fan-out is identical on
  both machines, but only A8-class hardware is slow enough for it to be felt.

### Root Cause (Code References)
The announcement draft was lifted into root `AdminPageClient` state, so **every
keystroke re-rendered the entire `/admin` component tree**.

- `src/app/admin/admin-page-client.tsx` held
  `const [pendingAnnouncement, setPendingAnnouncement] = React.useState(...)`
  and passed `setPendingAnnouncement` straight into `AnnouncementEditor`.
- `AnnouncementEditor.emit()` (`src/components/announcement-editor.tsx`)
  constructs a **new** `Announcement` object per change, so the state identity
  changed on every character and no bail-out was possible.
- `AdminPageClient` is a ~2,870-line component. Only three subtrees
  (`RangeGenerationControls`, `ResetActionControls`, `DrawPositionControls`)
  were memoized by the v1.5 work; everything else re-reconciled per keystroke.

This was the **worst-case** input on the page, because the Announcement card
lives inside the Advanced accordion, and `AccordionContent` mounts its children
when open (`keepRendered = false`, but the section *is* open while editing).
So typing an announcement re-rendered, per character:

- `TranslationCard` — and because `TabsContents`
  (`src/components/animate-ui/primitives/animate/tabs.tsx`) renders **all**
  children rather than only the active tab, that means `LanguageSettingsTab`,
  `AiConfigTab`, **and** `TranslationManagementTab` (~1,360 lines combined) all
  re-rendered even though only one is visible.
- `AppearanceCard` (+ the always-mounted `AppearanceWizard`).
- `OperatingHoursEditor`, `DisplayLanguageRotationEditor`.
- The Live State / History / QR cards, including a `react-qr-code` re-render.
- One `ConfirmAction` (Radix `AlertDialog`) per returned and per unclaimed
  ticket.

Three secondary costs compounded it, all on the synchronous keystroke path:

1. **Synchronous `localStorage` write per character.** The draft-persistence
   effect was keyed on `[pendingAnnouncement, state?.announcement]`, so every
   keystroke ran two `JSON.stringify` calls plus a blocking
   `localStorage.setItem`.
2. **Full-document Markdown serialization per character.** Tiptap's `onUpdate`
   calls `getEditorMarkdown()`, which re-serializes the whole ProseMirror
   document. Cost scales with announcement length, and the field allows up to
   `ANNOUNCEMENT_MAX_LENGTH = 1800` characters — so the lag is worst on exactly
   the long announcements staff actually write.
3. **An extra editor re-render per ProseMirror transaction**, from the
   `editor.on("transaction", forceTick)` toolbar-state subscription in
   `src/components/markdown-editor.tsx`.

### Measurement
An instrumented render-count harness (now kept as
`tests/announcement-input-isolation.test.tsx`) counted sibling re-renders while
typing into the announcement field:

| | `TranslationCard` | `AppearanceCard` | `DisplayLanguageRotationEditor` |
|---|---|---|---|
| Before | 1 per keystroke | 1 per keystroke | 1 per keystroke |
| After | 0 | 0 | 0 |

Note that a wall-clock assertion would be useless here — the development
machine renders the whole tree fast enough that the bug is invisible. The
regression test therefore asserts the **isolation property** (heavy siblings do
not re-render at all while typing), which fails on any machine if the draft is
re-lifted to root state.

### Fix
- Added `src/components/announcement-section.tsx`: a `React.memo` component
  that owns the announcement draft in local state, renders the editor and the
  Save button, and calls `onSave(draft)` only when Save is pressed. This is the
  same input-isolation pattern as `RangeGenerationControls` /
  `ResetActionControls` (docs/V1.5_OPTIMIZATIONS.md §2C).
- Removed `pendingAnnouncement` state, the draft-hydration effect, and the
  draft-persistence effect from `AdminPageClient`. `handleSaveAnnouncement` now
  takes the draft as an argument instead of closing over root state, so its
  `useCallback` identity is stable across renders.
- Draft persistence moved into the isolated section and **debounced**
  (`DRAFT_PERSIST_DEBOUNCE_MS = 500`), with a flush on `pagehide` and on
  unmount so a pending write is never lost when the accordion collapses or the
  tab is backgrounded. The synchronous storage write no longer lands on the
  keystroke path.
- Draft/server reconciliation semantics are unchanged: an unsaved draft still
  survives reload and tab-refocus, and a genuine server-side change (saved on
  another device) is still adopted.

### Verification
- `tests/announcement-input-isolation.test.tsx` — 4 tests: isolation, save,
  debounced draft persistence, draft hydration on mount.
- Full suite: 707 passing. The 3 remaining full-suite-only failures
  (`public-inventory-page`, `readonly-display-public`) reproduce on `main`
  without this change and pass in isolation — the known worker-pool contention
  flake documented in Issue 27 and AGENTS.md.
- `npm run build`, `npm run lint`, and `npm run check:legacy-bundles` clean.
- On-device dev verification: typed into the WYSIWYG editor with a
  PerformanceObserver armed for `longtask`; **zero long tasks** recorded across
  37 characters in an unminified dev build. Draft persistence and
  reload-recovery confirmed against the running app.

### Prevention
- **Any new text input added to `/admin` must own its own state.** The root
  `AdminPageClient` tree is large enough that lifting a high-frequency input to
  it is a performance defect by construction, regardless of how cheap the
  individual input looks.
- Prefer extending an existing isolated section, or add a new memoized section
  component, rather than adding a `useState` to `AdminPageClient`.
- When adding an input, add an isolation assertion alongside it. Timing-based
  tests will not catch this class of bug on modern development hardware.
- Note the `TabsContents` behavior: any card using
  `components/animate-ui/primitives/animate/tabs` mounts **all** of its tabs,
  so its render cost is the sum of every tab, not just the visible one.

## Issue 36: Microsoft Defender consumed Magic Links before staff could use them

### Status

Resolved in v1.22.0.

### Observed

LOTTO offered Magic Link sign-in, but William Temple House's Microsoft Defender
mail protection followed the Auth.js callback URL during inspection. Because a
standard callback GET consumes the single-use verification token, the later
human click reached an expired link. Staff had to use OTP even though the UI
continued to advertise Magic Link.

The adjacent OTP flow had two correctness gaps: requesting a code deleted every
verification token for the address (including a pending Magic Link), and a
failed request still moved the interface to a misleading “Code sent” state.
Magic Link copy promised ten minutes while the provider retained its default
expiry.

### Root Cause

- `src/app/api/auth/[...nextauth]/route.ts` previously exported Auth.js GET
  directly, giving scanners and humans identical token-consuming behavior.
- `src/app/api/auth/otp/request/route.ts` deleted by `identifier` without a
  method discriminator.
- `src/components/login-experience.tsx` used one OTP `error` state for both
  request failure and verification failure.
- `src/lib/auth.ts` did not set an explicit email-provider `maxAge`.

### Approaches

1. Remove Magic Link and use codes only. Simple, but eliminates the better
   staff experience and leaves email branding fragmented.
2. Replace Auth.js email authentication. Maximum control, but unnecessarily
   duplicates session and token security.
3. Preserve Auth.js and require a human POST after a harmless GET. This keeps
   the established architecture and matches FEED's scanner-safe contract.

### Fix

- Email callback GETs now redirect to `/login/confirm` without invoking
  Auth.js. The page contains no automatic submission; its explicit **Sign in**
  POST is the only path that spends the token.
- Both methods now expire in ten minutes through shared constants.
- The additive `verification_token.type` column isolates `otp` rows from
  `magic_link` rows.
- Magic Link is the default sign-in method; Verification Code remains the
  fallback. Request failures stay on the email step with actionable feedback.
- Both messages now share runtime-branded React Email HTML/plain-text templates
  and centralized Resend/SMTP delivery.

### Verification

- `tests/magic-link-interstitial.test.ts` proves repeated callback GETs never
  reach Auth.js and callback POSTs still do.
- `tests/auth-token-isolation.test.ts` protects the additive schema and
  type-scoped OTP queries.
- `tests/login-experience.test.tsx` protects tab order and honest request-state
  behavior.
- `tests/auth-email-branding.test.tsx` renders both built-in identities in HTML
  and plain text.

## Issue 37: Valid logo uploads failed on Vercel and errors blamed the image

### Status

Resolved in v1.22.1.

### Observed

- A valid 2.7 KB NVIDIA SVG (`viewBox="0 0 2560 1440"`) was rejected from the
  Appearance wizard with “Unable to process the image. Please try a different
  file.”
- The SVG was self-contained, contained only paths plus an internal CSS class,
  passed LOTTO's safety policy, and decoded successfully through Sharp.
- St. Johns' configured **Dark plate** treatment appeared correctly in the app
  preview but was missing from Magic Link and Verification Code email, leaving
  the light lettering nearly invisible on the white email shell.

### Root Cause

The asset service always wrote to `data/brand-assets/`. That is correct for
local and self-hosted deployments but not for an immutable Vercel Function
filesystem. The write failed after image validation, then the route collapsed
every non-SVG exception into one generic image-processing response. A valid
image was therefore blamed for a storage architecture failure.

Separately, `createAuthEmailBrand()` resolved the logo URL and colors but
dropped `logo.presentation`. The shared email shell could not know that the
light logo required the configured dark surface.

### Approaches

1. Store image bytes in Neon. This avoids a second service but makes the
   operational database serve binary files and conflicts with the established
   branding plan.
2. Embed data URLs in Appearance JSON. This is easy initially but bloats rows,
   email markup, and every configuration read.
3. Use public Vercel Blob with the filesystem fallback retained for local and
   self-hosted LOTTO. This is the pre-documented architecture and keeps each
   store focused on its proper role.

### Fix

- Vercel-hosted uploads use `@vercel/blob` and store random-suffixed public
  URLs; local/self-hosted uploads retain `/api/brand-assets` filesystem URLs.
- A Vercel deployment without a connected Blob store now returns a specific
  503 response telling the operator to ask a deployment administrator to
  connect public Blob storage. It never attempts the deployment filesystem.
- Upload acceptance is based on inspected bytes, not browser-supplied MIME
  labels. Valid SVG `<defs><style>...</style></defs>` content remains allowed;
  unsafe scripts, event handlers, external references, embedded documents,
  data URIs, and CSS imports remain blocked.
- The server-upload limit is 4 MB, leaving room below Vercel Functions' 4.5 MB
  body limit. Client and server both enforce it with actionable copy.
- Upload responses now distinguish invalid requests, empty files, size limits,
  unsafe SVGs, unreadable images, unavailable storage, and unexpected failures.
- Public Blob is allowed by Next Image and CSP. Palette-loading images set
  anonymous CORS before `src`, preserving canvas color extraction.
- The authentication-email brand contract carries `logoPresentation` and the
  hex `logoSurface`; the shared React Email shell renders a table-backed dark
  plate only when configured.

### Verification

- `tests/brand-assets.test.ts` covers internal class-styled SVGs, durable Blob
  URLs, public upload options, and the missing-store message.
- `tests/api-brand-assets.test.ts` covers ASK responses for unreadable,
  oversized, and storage-unavailable uploads.
- `tests/auth-email-branding.test.tsx` verifies the plate in both St. Johns
  authentication messages and its absence for William Temple House.
- Full suite: 745 passing. Lint, legacy-bundle validation, and production builds
  for both William Temple House and St. Johns are clean.

### Prevention

- Never persist user uploads to a Vercel deployment filesystem.
- Never collapse storage or infrastructure failures into a message that tells
  the user their image is bad.
- Any new email consumer of a brand asset must carry the asset's presentation
  contract as well as its URL.

## Issue 38: Hosted uploads could not be saved and the first picker action was unreliable

### Status

Resolved in v1.22.2.

### Root Cause

The v1.22.1 upload service correctly returned durable absolute Vercel Blob
URLs, but the shared Appearance schema still enforced the older local-only
root-relative asset contract. The wizard could preview a successful upload but
then rejected every hosted logo and generated icon during Save.

The upload trigger was also a visually styled `<label>` rather than a button.
That indirect file-input activation did not provide reliable first-action
button behavior across the supported browser/device range.

### Fix and Prevention

- The shared client/server schema accepts HTTPS URLs only when their hostname
  is a public Vercel Blob host and their path is inside LOTTO's managed
  `/brand-assets/` namespace. Arbitrary remote hosts, credentials, query
  strings, fragments, and unmanaged Blob paths remain invalid.
- Each upload control is now a real Shadcn button that explicitly invokes its
  associated native file input.
- Schema coverage exercises uploaded logo plus browser, Apple, and manifest
  icon URLs and proves that arbitrary remote URLs still fail closed.
- Interaction coverage proves the first button press opens the picker and the
  first selected file is uploaded and applied.

## Issue 39: Runtime public copy and Arcade bypassed the shared localization catalog

### Status

Resolved in v1.22.3.

### Root Cause

The configurable public service label was rendered as raw Appearance text.
LOTTO's translation content discovery, missing-translation audit, language-pack
builder, and client context knew about hardcoded UI strings, announcements, and
inventory, but not this runtime visitor-facing string. **Find Missing** could
therefore report complete coverage while the public board remained in English.

Arcade was added before dynamic languages and retained its own static map of the
eight core language codes and labels. Its UI consumed the shared translation
context, but its picker did not consume `availableLanguages`. Enabled catalog
languages were consequently translated in Arcade content but impossible to
select there; a persisted dynamic selection could also lack a native trigger
label on a direct Arcade load.

### Fix and Prevention

- Translation content now has a `brand_string` domain for active client-facing
  Appearance copy. The service label is discovered, audited for every enabled
  non-English language, prioritized, delivered in language packs, and rendered
  with safe English fallback. Stale label translations are retained for history
  but excluded from the active pack.
- The localization boundary is explicit: client-facing public copy is
  translatable; sign-in and Admin Appearance copy is intentionally not.
- Arcade now renders `availableLanguages` from `LanguageProvider`, loads the
  shared catalog on open or when a persisted code is absent locally, uses the
  catalog's native labels, and applies the established fixed-height ScrollArea
  when the list grows.
- Any future client-facing language picker must consume the shared catalog; a
  private `Record<Language, string>` is not an acceptable source of options.
- Regression coverage verifies brand-copy readiness and pack filtering plus
  dynamic Arcade discovery, labeling, and selection.

## Issue 40: Visitor language readiness polled an unqueued condition indefinitely

### Status

Resolved in v1.22.3.

### Root Cause

The homepage exposed enabled-but-incomplete dynamic languages immediately. If
a visitor selected one, a dedicated readiness branch called
`GET /api/languages?client` every four seconds until the language became ready.
That loop was separate from LOTTO's operating-hours-aware adaptive queue polling:
it had no backoff, visibility pause, timeout, or terminal error state.

The defect became visible when active public brand copy joined the translation
contract. Bosnian already had every UI string translated but no `brand_string`
row for the newly active service label, so readiness became false. No
translation request had been queued; the browser was polling a condition that
could not change by itself.

On Vercel, one stuck tab could issue 21,600 dynamic requests per day. Each
request could consume an Edge Request and Function invocation and fan out into
multiple Neon reads. Multiple visitors or abandoned tabs multiplied the waste.

### Fix and Prevention

- Enabling a dynamic language remains an authenticated Admin action and
  automatically runs the complete **Find Missing Translations** staged sweep.
  The progress UI owns this work and reports failures for staff review.
- The public language catalog now contains the eight core languages plus only
  dynamic languages whose required UI and active public-brand translations are
  complete. Incomplete languages never enter Home, Display, or Arcade menus.
- The visitor `getting-ready` branch and its fixed four-second API interval were
  removed. A persisted dynamic code that is no longer in the ready catalog
  safely returns to English after the catalog loads.
- Serverless polling guidance now lives in `AGENTS.md`: never poll an unqueued
  condition; avoid fixed unbounded intervals; use bounded adaptive backoff,
  visibility pausing, caching, and request-count tests when polling is necessary.
- The authenticated staged translation runner is explicitly finite: it stops if
  a chunk does not reduce the queue and caps one staff action at 100 follow-up
  requests (up to 10,000 rows at the current batch size). Remaining work stays hidden
  and is reported for staff recovery rather than becoming an API loop.
- Regression coverage asserts that incomplete dynamic languages are withheld
  and that the homepage does not start a language-readiness request loop; job
  progression tests also assert completion, no-progress termination, and the
  hard request budget.

## Issue 41: Translation sent one provider request and one store write per string

### Status

Resolved in v1.24.0.

### Root Cause

LOTTO's translation engine inherited a single-string provider primitive. A
staged job selected only a small queue slice and called the provider once for
every row, then persisted each response independently. That design did not use
the structured-output and large-context capabilities of current models such as
Gemini 2.5 Flash-Lite. It multiplied Vercel execution time, provider request
count, latency, and database traffic without improving translation quality.

AI Configuration also treated the model's advertised output-token limit as the
ordinary per-request setting. Selecting Gemini could therefore copy its 65,536
token capability directly into LOTTO's translation configuration even though
the application's output was only a modest set of short UI phrases.

### Approaches

1. Keep single-row calls and increase concurrency. This shortens wall time but
   preserves excessive provider and database traffic and raises rate-limit
   pressure.
2. Send every missing translation for every language and domain at once. This
   minimizes calls but creates large failure domains, weak recovery behavior,
   and difficult source/result alignment.
3. Use bounded homogeneous structured batches with stable ids, strict complete-
   set validation, one bulk write, and a separate operational token budget.
   This captures the model's useful capacity without making one response an
   all-or-nothing translation deployment.

### Fix and Prevention

- The engine groups at most 100 pending rows by target language and content
  type and sends one structured provider request.
- Every output must preserve each input row id exactly. Missing, duplicate,
  empty, changed, or invented items reject the response before any translation
  is written.
- Validated results enter the file or Postgres store through one bulk update.
  Aggregate provider token usage is allocated deterministically across rows so
  existing per-row usage and cost reporting remains useful.
- A malformed structured response can split into two smaller batches once. An
  HTTP, authentication, quota, provider, or network failure receives no
  recursive retry and marks the affected rows failed for deliberate recovery.
- The provider output limit remains truthful model metadata. LOTTO's distinct
  translation output budget defaults to 8,192, scales downward for small
  batches, and is capped at 16,384. Legacy configurations that copied the
  provider ceiling normalize safely at runtime.
- Regression tests assert one provider call and one store write for 100 rows,
  exact token-allocation totals, strict structured validation, bounded splitting,
  and the absence of HTTP retry storms.

### Verification

- The full v1.24.0 suite passes: 107 files and 770 tests, plus lint, the
  legacy-bundle scan, and both William Temple House and St. Johns production
  builds.
- A local end-to-end run against the configured Google
  `gemini-2.5-flash-lite` translated 174 Armenian rows with zero pending or
  failed results. It used four expected homogeneous batches: two single-row
  visitor-copy domains plus UI batches of 100 and 72.
- Real adaptive output budgets ranged from 2,048 to 7,304 tokens—below LOTTO's
  8,192 default and far below the model's 65,536 capability. Armenian entered
  the client catalog only after all required rows completed; the temporary
  language enablement was then removed after validation.

---

## Issue 42: Custom appearances rendered unusable on the iPadOS 15 support floor

### Status

Resolved in v1.24.2.

### Root Cause

`oklch()` requires Safari 16.4. LOTTO's declared floor is iPadOS 15
(`docs/BROWSER_SUPPORT.md`), where the deployed iPad mini 4 runs Safari 15.6.
Every OKLCH value is invalid on that engine.

Hand-authored brand stylesheets were unaffected because they pass through the
build, where Lightning CSS downlevels `oklch()` to sRGB for the browserslist
floor; the compiled stylesheet contains no OKLCH at all. Runtime brand themes
take a different path. They are derived per request and injected as an inline
`<style>` in `<head>`, so they never reach that pipeline and shipped their
OKLCH values verbatim.

The failure was therefore invisible in the two built-in brands and total in
every custom appearance. Because an invalid value is dropped at computed-value
time, surfaces fell back to transparent while unrelated declarations survived:
cards, popovers, and modal surfaces lost their fill; `--border` became invalid
so `border-color` fell back to `currentColor`, drawing dark outlines around
every panel; toggle switches disappeared entirely; and modals became unreadable
because both the surface and the backdrop scrim were transparent, letting page
content show through the dialog.

This affected the white-label feature on precisely the hardware it is deployed
to. It was not a simulator artifact.

### Approaches

1. Change the simulator's WebKit experimental flags. Rejected: it cannot fix a
   real device, and there is no such control on a deployed tablet. It would
   conceal the defect rather than repair it.
2. Emit sRGB only. Correct on every engine and simplest, but discards wide-gamut
   colour on modern displays for all users to accommodate one old device.
3. Emit an sRGB baseline followed by the OKLCH values inside `@supports`. Old
   engines keep the baseline, current engines take the richer form. Chosen.

### Fix and Prevention

- `serializeBrandThemeCss` writes each of the four scopes twice: an sRGB
  baseline, then the OKLCH values guarded by `@supports (color: oklch(0 0 0))`.
- Colours inside gradients and shadows are converted in place rather than
  skipped, and alpha is preserved through the conversion.
- Derived values are unchanged. Only serialization differs, which keeps the
  change clear of the derivation rules in `src/lib/brand-theme/derive.ts`.
- The obsolete `produces OKLCH-only output` invariant was replaced rather than
  deleted, by five tests covering the layered contract: a legacy-safe baseline,
  the OKLCH authoring standard preserved inside `@supports`, token parity
  between the two layers, gradient and alpha conversion, and an sRGB/OKLCH
  round-trip within one part in 255 so an incorrect conversion cannot pass as
  merely legacy-safe.
- `AGENTS.md` and `docs/BROWSER_SUPPORT.md` now state the general rule:
  runtime-generated CSS must be legacy-safe at emit time, because the build
  only protects authored stylesheets.
- Recorded in both documents: the two-declaration shorthand
  (`--card: #fff; --card: oklch(...)`) does **not** work. Custom properties are
  not validated at parse time, so both declarations are accepted and the later
  always wins; the invalidity surfaces only at `var()` substitution, which then
  falls back to the property's initial value rather than the earlier
  declaration. `@supports` is the only correct guard.

### Verification

- Measured on iPadOS 15.4 rather than inferred:
  `CSS.supports("color", "oklch(0.7 0.15 145)")` returns `false` and the value
  computes to `rgba(0, 0, 0, 0)`. `color-mix()` **is** supported on that engine
  and was not implicated.
- After the fix, on-device token resolution returns real colours for `--card`,
  `--popover`, `--primary`, `--border`, `--muted`, and `--secondary`.
  `--popover` is the modal surface that had been transparent.
- Confirmed visually on the simulated iPad mini 4 running iPadOS 15.4 with the
  Lift Up appearance, in both the dev server and a production build: card fills,
  brand-green toggle and primary button, correct field borders.
- Full suite passes at 107 files and 780 tests, with lint, `tsc`, the
  legacy-bundle scan, and a production build. The serializer appears in zero
  client chunks; it is server-side only.

---

## Issue 43: `npm run dev` aborted hydration on the iPadOS 15 support floor

### Status

Resolved in v1.24.2.

### Root Cause

iOS/iPadOS 15 Safari refuses the Next.js hot-reload WebSocket with a
`SecurityError` ("The operation is insecure"). Next constructs that socket
inside its asynchronous `appBootstrap`, so the synchronous throw became an
unhandled promise rejection that aborted bootstrap **before `hydrateRoot` ran**.

The application server-rendered correctly and then never hydrated: no event
handlers attached and no `useEffect` fired. On `/admin` this presented as a
permanent `Loading state from datastore…` spinner with inert theme and language
switches — the same outward signature as the Issue 5 outage, from an unrelated
cause. Production was never affected, because a production build contains no
hot-reload client.

### Approaches

1. `next dev --experimental-https` with an mkcert certificate trusted in the
   simulator keychain. The page loaded over HTTPS with a valid padlock and threw
   the identical error, so the page's secure context was not the cause.
2. Safari's `NSURLSession WebSocket` experimental toggle. No effect.
3. Abandon dev-mode testing on the floor and verify only against production
   builds. Workable but costs a rebuild per iteration.
4. Prevent the constructor from throwing, accepting the loss of hot reload on
   that engine alone. Chosen.

### Fix and Prevention

- `src/app/layout.tsx` emits a development-only inline script wrapping
  `window.WebSocket` so construction cannot throw, returning an inert stub when
  the real constructor raises. Bootstrap then completes and the app hydrates.
- Gated on `process.env.NODE_ENV === "development"`. A controlled comparison —
  build at the previous commit, build with the shim, diff chunk hashes —
  confirmed all 48 production client chunks byte-identical, and the shim string
  appears in zero shipped chunks.
- `AGENTS.md` records that the shim must not be removed, together with the
  failure signature, so the symptom is not mistaken for an application bug.

### Verification

- Diagnosed by forwarding client `error` and `unhandledrejection` events, with
  stacks, to a URL the dev server logs, with the device under test as the sole
  client. Static bundle greps produced four consecutive false leads whose matches
  turned out to be comments and CSS class names; the runtime probe identified the
  cause in one attempt.
- Confirmed on-device rather than from server-log traffic: the spinner is
  replaced by the resolved *Persistence confirmed* card, and the QR code renders
  a display URL taken from fetched state. An earlier apparent fix was retracted
  after the traffic proving it was traced to a desktop browser left open on the
  same port.

## Issue 44: The Appearance preview was blank on the support floor — the other half of Issue 42

**Status:** fixed.

Issue 42 made the *injected stylesheet* legacy-safe: `serializeBrandThemeCss`
writes an sRGB baseline and restores OKLCH inside
`@supports (color: oklch(0 0 0))`, so a custom appearance renders on iPadOS 15.
That fix is correct and remains the model. It just does not cover every way a
derived colour reaches the page.

The Appearance wizard paints its four-mode preview and its logo swatches with
React `style` props, fed straight from `deriveBrandTheme` and `formatOklch`:

    style={{ background: tokens.background }}   // oklch(0.129 0.042 264.695)
    style={{ background: formatOklch(entry.color) }}

An inline style has no `@supports` to hide behind. It is one declaration, and on
that engine `oklch()` with a bare-number lightness is invalid — the floor
requires a percentage — so the declaration is **dropped**. The panels were not
mis-coloured; they had no colour at all, and inherited the dialog's dark
surface. Light and dark previews looked identical, and "Found in logo" rendered
as empty circles. An operator on the shipped hardware could not see what they
were choosing.

The tell is worth remembering: an invalid colour in CSS is not approximated, it
is discarded. A wrong colour means a bad rule; *no* colour means an unparseable
one.

**Fix.** `toLegacyValue` is exported from `serialize.ts`, and
`useLegacySafeColor` (`src/hooks/use-legacy-safe-color.ts`) applies it to inline
styles. It reads support through `useSyncExternalStore` rather than an effect,
with the server snapshot set to the floor, so the first client paint agrees with
the server and modern engines keep the wide-gamut original.
`ThemePreview` converts its whole token map once at the component boundary
rather than at each `style` prop — one missed call site is an invisible panel,
so a new swatch should be safe without anyone remembering.

**Regression cover.** `tests/brand-inline-style-legacy.test.tsx`. Note that
jsdom *keeps* a declaration Safari would drop, so "the two panels differ" passes
even unfixed; the assertions that bite are that each panel carries a colour the
floor can parse. Both were confirmed to fail with the fix disabled.

**Rule.** Any inline style fed from `deriveBrandTheme`, `formatOklch`, or an
extracted logo colour must pass through `useLegacySafeColor`. Tokens referenced
as `var(--…)` are already safe — they resolve from the serialized stylesheet.

## Issue 45: Dark-mode shadows lose their assigned hue

**Status:** fixed in the Unreleased FEED-parity follow-up after
v1.26.0-beta.1. Verified on the iOS 15.4 and iPadOS 26.5 simulators; the Vercel
preview and real-device promotion gates remain part of the release checklist.

Dark mode is supposed to tint its shadows with the brand. `derive.ts` emits a
deliberately saturated shadow colour for the dark and hi-viz-dark scopes:

    "base-shadow-color": formatOklch({ l: 0.742, c: 0.161, h: serving.h - 6 })

Chroma 0.161 is not a subtle tint — it is a strong, hue-bearing colour. The
rendered shadow did not carry it. Sampled off the
iOS 15.4 simulator, the halo around a dark-mode control measured
`rgb(87, 84, 86)` — r minus b of **+1**, which is neutral grey. The hue is being
lost somewhere between the token and the pixel.

**Root cause.** Every consumer had the same shape, 26 of them across the
authored stylesheets:

    color-mix(in oklch, var(--base-shadow-color), transparent 85%)

That construction contains two distinct compatibility failures. In engines
that implement the interpolation, polar-space mixing toward transparent can
drag or erase the authored hue — FEED's violet-shadow defect. On LOTTO's
iPadOS 15 floor the build cannot reduce the expression because its source is a
runtime `var()`. Lightning CSS emitted an opaque custom-property fallback and
kept the alpha mix behind a feature query the floor does not enter. The result
was not merely an inaccurate hue: the fallback shadow was too opaque.

Changing `oklch` to FEED's `oklab` fixed the modern interpolation half but did
not fix the legacy fallback. LOTTO therefore ports FEED's principle at the
token boundary: the generator and compiled brands now emit three already-
alpha-bearing values — `--base-shadow-soft-color`, `--base-shadow-color`, and
`--base-shadow-strong-color`. Shared shadow recipes compose geometry from those
tokens directly and contain no runtime `color-mix()`. The serializer converts
each alpha-bearing OKLCH value to an sRGB baseline for iPadOS 15 and restores
OKLCH in its existing `@supports` layer for modern engines.

Protected operational gradients were inspected and are not part of this
change. The new token names remain in the derivable identity vocabulary, not
the protected status vocabulary.

**A correction worth recording.** Earlier in the investigation this was measured and
written off. The check was looking for FEED's symptom — a *warm* halo — found
r−b of +1, and concluded "no halo bug." That reading was backwards: a neutral
result was never evidence of health here, because the token is authored at
chroma 0.161 and neutral is precisely what it should not be. Measuring for the
symptom you already know is how you miss the one in front of you.

**Regression cover.** `tests/brand-tailwind-palette.test.ts` requires every
scope to emit the three alpha-bearing shadow tokens and requires the shared
recipes to contain no `color-mix()`. The iOS 15.4 simulator rendered the
custom dark theme without the former opaque neutral halo and completed
hydration to **Persistence confirmed**. The iPadOS 26.5 simulator retained the
authored branded tint without the polar-space artifact.

## Issue 46: Built-in card gradients diverged between legacy and modern iPads

**Status:** fixed in the current Unreleased work.

The WTH card wash used `color-mix(in oklch, var(--primary) 8%, transparent)`.
Modern WebKit produced the intended subtle wash, but the iPadOS 15 build
fallback became an opaque primary stop. The same built-in appearance therefore
looked materially warmer and heavier on the support-floor tablet.

LOTTO now ports FEED's current WTH card atmosphere as explicit opaque gradient
stops for light and dark mode. The browser performs no runtime mixing, so both
engines consume the same visual result. Tests reject `color-mix()` in the WTH
card-gradient tokens.

## Issue 47: Theme selection required a dropdown for three choices

**Status:** fixed in the current Unreleased work.

FEED established a faster one-control pattern. LOTTO now uses the same
single-tap interaction and cycles Light → Dark → Hi-viz → Light. The control's
icon, tooltip, and accessible name describe the mode the next tap will select;
the dropdown and its extra decision step are gone.

## Issue 48: Two compiled appearances duplicated maintenance

**Status:** fixed in the current Unreleased work.

The configurable Appearance workflow supersedes compiled per-agency profiles.
LOTTO now compiles only William Temple House, uses FEED's current WTH colors and
SVG identity assets, and prunes retired template rows while preserving saved
custom appearances. Agency differences live in database-backed Appearance
records and Blob assets, not source selectors or a public build variable.

## Issue 49: Help navigation targeted a retired staff route

**Status:** fixed in the current Unreleased work.

The authenticated Help index linked to `/staff`, which now redirects through
sign-in instead of returning staff to their workspace. The upper-left control
is now **Back** and links directly to `/admin`.

## Issue 50: Animated navigation icons clipped during playback

**Status:** fixed in the current Unreleased work.

Some animated icon paths and panels temporarily leave their resting SVG
viewBox. The navigation icon/label wrapper now keeps SVG overflow visible, so
the full animation renders without changing hit targets or resting geometry.

## Issue 51: Arcade omitted ready, staff-activated languages

**Status:** fixed in the current Unreleased work; revised after simulator
validation exposed a stale-provider case.

Arcade previously loaded the shared language catalog only after a dynamic
language was already selected. Its first-open menu could therefore show only
the built-in list. Preloading on mount fixed a fresh provider, but the root
`LanguageProvider` persists across client navigation and permits its guarded
catalog request only once. If staff enabled another language after that request,
opening Arcade beneath the same provider still showed the stale list.

The switcher now awaits a fresh `GET /api/languages?client` response on each
explicit menu-open action and reveals the options afterward. This is bounded,
action-driven refresh—not visitor polling—and the server continues to withhold
languages whose required translation pack is incomplete.

Simulator validation showed that all 11 ready options were present but the
last three sat below a 320 px viewport with no visual affordance. The menu now
uses native touch scrolling and masks its bottom fifth with a blur/fade while
more choices remain. The cue disappears at the final option.

## Issue 52: Form inputs lost their surface fill

**Status:** fixed in the current Unreleased work.

The shared Input component used a transparent light-mode fill and a translucent
dark-mode override. This made the ticket-range, append, reset-confirmation, and
language-search fields visually disappear into their cards. Inputs now use the
solid `bg-background` token in every mode, matching FEED's field standard.
Focused tests cover each reported field.

## Issue 53: Theme switcher changed icon and label during hydration

**Status:** fixed in the current Unreleased work.

The server cannot know the device's system theme and rendered the one-tap
control as **Switch to dark theme**. On a dark-preferring client, `next-themes`
could resolve Dark on the first render and produce **Switch to high-visibility
theme** before hydration finished. React discarded the server tree on `/`.

The already-disabled pre-mount control now has one deterministic Dark target on
both sides. After the mount effect, it resolves the actual Light → Dark →
Hi-viz cycle. The legacy production smoke and a pure target-selection
regression cover the boundary.

## Issue 54: Queue progress borrowed canonical success green

**Status:** fixed in the current Unreleased work.

The configurable Appearance engine correctly made **Now Serving** and
**Served** follow Primary, while **Returned** and **Unclaimed** stayed on their
protected red/gold vocabulary. The Admin **Live State** values and **Next up**
card still used `--status-success-*`, however, so one queue-progress surface
remained green even when every related state used the agency's Primary color.

The fix does not redefine protected success tokens. Live State values now use
`text-primary`, and Next up consumes the configurable `ticket-serving`
gradient with its matched border/text roles. The stack is ordered **Next up →
Unclaimed → Returned**. Generic success alerts remain canonical; Returned and
Unclaimed still consume only their protected status gradients, text, and
operational action variants. `tests/queue-color-boundary.test.ts` guards both
sides of the boundary.

Follow-up visual alignment links the seven neutral Live State metric cards to
the exact `--gradient-card-info` surface used by **Draw position**. Both
consumers reference one shared class constant, so built-in and custom
appearances cannot drift between those related surfaces. The protected Next up,
Unclaimed, and Returned treatments remain unchanged.

## Issue 55: Installed apps had no manual refresh affordance

**Status:** implemented in the current Unreleased work; simulator and installed
preview validation required before promotion.

Adding LOTTO to an iOS or Android home screen removes browser chrome, including
the ordinary reload control. Long-lived queue and Arcade sessions therefore had
no direct way to request a full refresh.

`PullToRefresh` detects standalone mode using both the standard display-mode
media query and iOS's `navigator.standalone`. A single downward gesture may
begin anywhere while the page is at scroll position zero. Crossing the resisted
72 px threshold shows a branded indicator and reloads the current page.
Inputs, sliders, and explicitly marked nested scrollers are excluded so their
native gestures keep working. Browser-tab behavior is unchanged and the
feature creates no background requests.

## Issue 56: Standalone Arcade controls crowded the home indicator

**Status:** fixed in the current Unreleased work; installed-phone visual
validation required before promotion.

Without browser chrome, the sticky game control docks sat directly above the
swipe-home affordance used by modern iPhones. Snake, Brick Mayhem, and Day of
the Dead now add 32 px below their controls in standalone mode, in addition to
the device's `safe-area-inset-bottom`. Both the display-mode media query and the
client standalone marker apply the same rule so the first paint and legacy iOS
path agree.

## Issue 57: iOS 15 iPhone active navigation became an opaque block

**Status:** fixed in the current Unreleased work.

The bottom navigation used Tailwind's `bg-primary/12` utility for its selected
tab. On iOS 15 iPhones the required runtime color mix fell back to an opaque
Primary fill, covering the animated icon and label; the wider iPad path happened
to render the intended translucent surface.

Every theme scope now emits `--nav-active-background` with alpha already
applied, and the navigation consumes that token directly. Configured themes
serialize an sRGB baseline and gate their OKLCH enhancement, so both engines
receive the same translucency without runtime mixing.

## Issue 58: Runtime Appearance stopped at the Arcade boundary

**Status:** fixed in the current Unreleased work.

Custom appearances styled core client and staff pages, but Arcade continued to
use only its compiled William Temple House palette. An Arcade-scoped bridge now
maps resolved background, panel, Primary, Accent, border, foreground, shadow,
control, and Now Serving roles into Arcade chrome. Snake pieces, pellets,
bricks, board art, and other gameplay cues remain fixed; protected raffle
status tokens are not part of the bridge.

## Issue 59: Custom Next up cards lost their gradient

**Status:** fixed in the current Unreleased work.

The Admin **Next up** card correctly consumed the configurable
`--ticket-serving` token, but custom light appearances derived that token as a
two-stop gradient whose stops were identical. It was syntactically a gradient
and visually a solid fill, unlike the Unclaimed and Returned cards in the same
stack and unlike compiled WTH.

Custom standard light mode now derives a bottom-to-top serving ramp from the
configured serving color to a lighter, slightly richer rung—the same
relationship as compiled WTH. Contrast validation checks the chosen text
against both stops. Custom dark mode already used a true ramp and is unchanged;
both Hi-viz scopes remain deliberately flat. The protected red/gold operational
tokens are unchanged.

## Issue 60: Public service date crossed timezones during hydration

**Status:** fixed and revalidated on the isolated beta in the current
Unreleased work.

During the Phase 4 realtime observation window, both the observer page and its
polling-only control logged React production error 418. The canary was not the
cause. At 9:32 PM Pacific, Vercel's server HTML contained **Wednesday,
September 2nd, 2026**, while the hydrated browser correctly showed **Tuesday,
September 1st, 2026**. `ReadOnlyDisplay` initialized its clock with `Date.now()`
on both sides but formatted it in each runtime's local timezone, so identical
instants produced different text after UTC midnight.

The display clock now begins at a deterministic `null` value, renders an em
dash on both sides, and resolves the real clock immediately in the existing
mount effect. Service-date formatting then uses the authoritative pantry
timezone (falling back to LOTTO's default until the first state poll). This
avoids a stale build-time timestamp, removes the UTC/Pacific hydration branch,
and also gives remote clients the pantry's service date rather than their
device date. A date-format regression fixes the observed instant at the UTC
boundary and asserts both Pacific and UTC results.

Deployment `Da5gC8yMFixrFfJVAHTuACTmB986` reproduced the server side as a stable
em-dash placeholder, then showed **Tuesday, September 1st, 2026** on fresh
observer and polling-only pages with no console errors. The observer remained
matched at `hub r70 / poll r70`, and the repaired page passed the iOS 15.4 iPad
mini 4 simulator background/foreground cycle again.
