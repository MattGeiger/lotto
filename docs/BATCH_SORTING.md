# Dynamic Ticket Range & Batch Locking Implementation Plan
## Summary

This plan updates backend and admin UI behavior so range edits are never deceptive:
1. `startNumber` locks after first draw (full generate or first batch).
2. `endNumber` can grow during active batching, but cannot shrink.
3. Batch draws always use the undrawn set within `start..end`.
4. Once pending is exhausted, both Start/End fields lock and operators must use Append.
5. All rejections return ASK-style actionable messages (no silent ignores).

## Pattern Alignment
- **Within existing patterns:** centralized state rules in `state-manager`/`state-manager-db`, API mediation through `/api/state`, Sonner feedback in admin UI.
- **Against current behavior (intentional correction):** current UI accepts post-draw Start/End edits that backend ignores; this plan removes that mismatch.

## Scope
- In scope: `src/lib/state-manager.ts`, `src/lib/state-manager-db.ts`, `src/app/api/state/route.ts`, `src/app/admin/page.tsx`, tests, and docs.
- Out of scope: schema migration, display page behavior, auth/security architecture changes.

## Decision-Locked Product Rules
1. Append remains supported and is the only range-growth path after the current range is fully sorted.
2. Pending pool is defined as: all numbers in `start..currentEnd` not already in `generatedOrder`.
3. Initial range must satisfy `end > start` (single-number range is invalid).
4. Start field becomes muted/locked after first draw; click/tap shows ASK Sonner message.
5. End field stays editable during active batching only; it is read/validated on batch action, not persisted while typing.
6. After pending reaches zero, End field becomes muted/locked; user must use Append.
7. Backend rejects mismatched `startNumber` after initialization.
8. `generateBatch` expansion is atomic: when `input.endNumber > current.endNumber`, expansion and draw persist together in one state write; if draw fails, no range mutation is saved.
9. Canonical ASK templates must include concrete values:
- Shrink rejection: `The end number is currently {currentEnd}. Please choose a number greater than {currentEnd}.`
- Start-lock rejection: `Start number is locked at {currentStart} after the first draw. Reset to start a new range.`

## Backend Specification
### 1) Validation primitives (both managers)
Implement identical logic in:
- `src/lib/state-manager.ts`
- `src/lib/state-manager-db.ts`

Rules:
1. Initial setup validation (`generateState`, first `generateBatch`):
- integers only
- positive only
- max 6 digits (`<= 999999`)
- `end > start` strictly

2. Post-initialization `generateBatch`:
- reject if `input.startNumber !== current.startNumber` with:
  - `Start number is locked at {currentStart} after the first draw. Reset to start a new range.`
- reject if `input.endNumber < current.endNumber` with:
  - `The end number is currently {currentEnd}. Please choose a number greater than {currentEnd}.`
- accept `input.endNumber === current.endNumber` (no expansion)
- accept `input.endNumber > current.endNumber` and treat as range expansion before draw

3. Pending computation:
- `pool = [start..effectiveEnd] - generatedOrder`
- random mode: shuffle pool, take `batchSize`
- sequential mode: take lowest `batchSize`
- append selected to end of `generatedOrder` only

4. Append gating:
- `appendTickets` must reject when pending exists (`undrawnCount > 0`)
- message must direct operator to finish pending via batch first
- preserve existing append behavior only when pending is zero

### 2) Atomic Persistence Contract
`generateBatch` must treat expansion + draw as one atomic state transition:
1. Expansion + selection + append execute as one transactional/persist unit.
2. Success persists:
- `endNumber: effectiveEnd`
- appended `generatedOrder`
- snapshot/history entry (existing behavior)
3. Any validation/business-rule failure persists nothing:
- previous `endNumber` remains intact
- no partial expansion state
### 3) Error transport for ASK messaging
Current API wraps most errors as generic 500, so actionable messages are lost. Implement controlled user-facing errors:
1. Add a lightweight typed error (for example `UserInputError`) with `status=400`.
2. Throw typed errors for validation/business-rule failures in state managers.
3. In `/api/state` POST handler:
- if typed user error: return `{ error: <message> }` with 400
- else: keep generic 500 response (do not leak internals)

This preserves security behavior for unknown exceptions while enabling ASK toasts.

## Admin UI Specification (`src/app/admin/page.tsx`)
### 1) Field lock states
1. `hasDrawStarted = state.generatedOrder.length > 0`.
2. `isRangeExhausted = undrawnCount === 0`.
3. Start input:
- enabled only when `!hasDrawStarted`
- muted/disabled when `hasDrawStarted`
- wrapper click/tap Sonner: `Start number is locked at {currentStart} after the first draw. Reset to start a new range.`

4. End input:
- enabled when `hasDrawStarted && !isRangeExhausted` (active batching)
- muted/disabled when `hasDrawStarted && isRangeExhausted`
- wrapper click/tap Sonner when exhausted: “All tickets in this range are sorted. Use Append to increase the end number.”
- action-time shrink rejection feedback (backend 400) must preserve concrete-bound copy:
  - `The end number is currently {currentEnd}. Please choose a number greater than {currentEnd}.`

### 2) Batch dialog count preview
To match operator expectation, “X tickets remaining” must reflect a valid increased End value even before submit:
1. Compute `previewEnd = max(currentEnd, parsedEndInput)` when batching is active.
2. Compute `previewUndrawnCount` using set-difference against `generatedOrder`.
3. Use `previewUndrawnCount` in batch modal copy and batch button disable logic.
4. If entered End is invalid shrink (`< currentEnd`), do not apply preview expansion and allow backend ASK message on submit.

### 3) Action triggers
1. End edits stay local until action.
2. `Generate batch` submits current Start (locked value) and entered End.
3. Append section remains enabled only when pending is exhausted.
4. Keep existing toast-on-disabled pattern for blocked controls; update copy to reflect new rules.

### 4) Copy updates
Update ambiguous text like “generate or re-generate” to reflect lock semantics and one-way range behavior.

## Public API / Interface Changes
1. `POST /api/state` `action: "generateBatch"` semantic changes:
- After init, `startNumber` is immutable and must match current state.
- `endNumber` may be equal or greater than current; smaller is rejected.
- `endNumber > current` expands range before drawing.
- Returns actionable 400 errors for rule violations with concrete-bound messages:
  - Start mismatch: `Start number is locked at {currentStart} after the first draw. Reset to start a new range.`
  - End shrink: `The end number is currently {currentEnd}. Please choose a number greater than {currentEnd}.`
- Expansion persistence is atomic: `endNumber` updates only when draw succeeds.

2. `POST /api/state` `action: "append"` semantic change:
- rejected when pending pool is non-empty.
- accepted only when current range is fully sorted.

3. Validation constraints:
- `startNumber`, `endNumber`, append `endNumber` capped at 6 digits.
- initial creation requires `end > start`.

4. No `RaffleState` schema changes required.

## Test Plan
### Unit tests (`tests/state-manager.test.ts`)
Add scenarios:
1. `generateState` rejects `end === start`.
2. first `generateBatch` rejects `end === start`.
3. `generateBatch` post-init rejects start mismatch and includes locked-start value in the message.
4. `generateBatch` post-init rejects shrink end and includes current-end value in the message.
5. `generateBatch` with increased end expands range and draws from expanded pending pool.
6. `generateBatch` with unchanged end draws from remaining pending only.
7. locked prefix immutability: prior drawn positions unchanged after subsequent batches.
8. `appendTickets` rejects while pending remains.
9. `appendTickets` succeeds when pending is zero and appends according to mode.
10. 6-digit boundary checks on range-changing actions.
11. successful expanded batch persists new `endNumber` (verify via reload/subsequent batch).
12. failed expanded batch does not mutate `endNumber`.

### API route tests
Add/adjust route tests to verify:
1. typed user errors return 400 with exact concrete-bound messages.
2. unexpected errors still return generic 500 without sensitive details.
3. existing security non-leak guarantees remain intact.

### UI tests (`tests/*.test.tsx`)
Add admin tests for:
1. Start input disabled after first draw.
2. Start wrapper click shows exact start-lock ASK message.
3. End input enabled during active batching.
4. End input disabled when pending is zero and wrapper click explains Append path.
5. Batch modal remaining-count preview updates when End increases locally.
6. Shrink attempt surfaces exact concrete-bound ASK message from backend 400.

## Documentation Updates
1. Populate `docs/BATCH_SORTING.md` with this specification and rule matrix.
2. Update `CHANGELOG.md` with behavior changes and UX guardrails.
3. Update relevant admin workflow docs (`docs/ADMIN_PAGE.md` and/or `docs/ISSUES.md`) to reflect:
- locked Start after first draw
- dynamic End during active batch phase
- End lock + Append-only expansion after exhaustion
- API enforcement of non-deceptive range semantics

## Rollout / Risk Control
1. Implement backend invariants first, then UI locks and messaging.
2. Run targeted tests (`state-manager`, API error handling, admin UI tests).
3. Verify both storage managers (file + DB) have identical validation behavior.
4. Manual QA sequence:
- reset → initial batch → edit End up → next batch reflects expansion
- attempt End shrink → ASK rejection
- exhaust pending → Start/End locked, Append available
- attempt append with pending > 0 via API call → rejected

## Important Public API / Interface Notes
1. No new routes.
2. No payload shape changes.
3. Behavioral contract changes:
- `generateBatch` has strict start immutability enforcement with specific 400 copy.
- `generateBatch` shrink rejection requires concrete-bound 400 copy.
- Expansion persistence semantics are explicitly atomic and test-enforced.

## Acceptance Scenarios
1. Current state `start=1,end=40`, user submits batch with `start=2`:
- API returns 400 with: `Start number is locked at 1 after the first draw. Reset to start a new range.`
2. Current state `end=40`, user submits batch with `end=39`:
- API returns 400 with: `The end number is currently 40. Please choose a number greater than 40.`
3. Current state `end=40`, user submits batch with `end=50`, valid `batchSize`:
- Batch succeeds.
- Persisted state now has `end=50`.
4. Current state `end=40`, user submits batch with `end=50`, invalid draw request:
- Batch fails.
- Persisted state remains `end=40`.

## Assumptions and Defaults
1. `extendRange` remains non-UI and unchanged unless later explicitly folded into this workflow.
2. ASK copy is English-only in this iteration.
3. No migration needed for existing persisted state; rules apply from current state snapshot onward.
4. “First draw” means first successful `generateState` or `generateBatch`.
5. Pending exhaustion is computed from state (`start..end` minus `generatedOrder`), not ticket-status flags.
6. Message strings above are canonical contract text (backend source of truth).
