# William Temple House Digital Raffle System v1.4.0

**Release Date:** February 13, 2026

## Batch Range Integrity

- Locked `startNumber` after the first successful draw so staff cannot silently drift the starting bound mid-process.
- Allowed `endNumber` to move only forward during active batching; shrink attempts are rejected with concrete ASK messaging that includes the current bound.
- Ensured `generateBatch` range expansion is atomic: expanded `endNumber` persists only when the draw succeeds, preventing preview/state mismatch.
- Restricted Append while undrawn tickets remain in the active range to preserve first-in fairness for pending tickets.

## Operator Guidance

- Added canonical concrete-bound messaging:
  - `Start number is locked at {currentStart} after the first draw. Reset to start a new range.`
  - `The end number is currently {currentEnd}. Please choose a number greater than {currentEnd}.`
- Updated admin range controls so disabled Start/End interactions provide immediate Sonner guidance instead of silent failure.

## Validation

- Localhost verification completed for start-lock enforcement, forward-only end expansion, append gating with pending tickets, and atomic expansion persistence.

## Versioning

- Bumped application version to **1.4.0**.

---

# William Temple House Digital Raffle System v1.2.1

**Release Date:** February 3, 2026

## Display Cadence

- Open-window polling now clamps to a 5-minute maximum to keep the public display responsive during service hours, even after long idle periods.

## Versioning

- Bumped application version to **1.2.1**.

---

# William Temple House Digital Raffle System v1.2.0

**Release Date:** January 20, 2026

## Ticket Lookup Experience

- Header search controls now share the same gradient/palette fill, hover treatment, and elevation as the language and light/dark toggles, while extra horizontal padding and responsive text/icon scaling keep the pill legible on desktop and tactile on mobile.
- The search pill sits inside its own padded cluster, so it feels visually cohesive yet distinct from other header buttons, and the digit-only input behavior plus the dedicated icon trigger deliver the same modal/“ticket number not found” experience.

## Versioning

- Bumped application version to **1.2.0**.

---

# William Temple House Digital Raffle System v1.1.3

**Release Date:** January 19, 2026

## Ticket Lookup Experience

- Added a multilingual header search so clients can type or tap a ticket number, with a dedicated light/dark-friendly icon button that triggers the same ticket detail modal or a “Ticket number not found” dialog when the lookup misses.

## Versioning

- Bumped application version to **1.1.3**.

---

# William Temple House Digital Raffle System v1.1.2

**Release Date:** January 16, 2026

## Fixes & Reliability

- Public display polling now backs off during idle periods and pauses when the tab is hidden.
- Operating-hours-aware polling uses a 15-minute slack window before opening and after closing.
- Closed-window polling caps at a maximum of 120 minutes or half the time to the next open window.

## Display Cadence

- Public display now uses adaptive polling with idle tiers, visibility pause, and operating-hours-aware backoff.
- Closed-window polling caps at a maximum of 120 minutes or half the time to the next open window.

## Included from v1.1.1 (Fixes & Reliability)

- Draw position advance now skips tickets marked as returned.
- Confirmation dialogs now close after confirming, even when follow-up errors occur.
- Display date now refreshes correctly after long idle periods (including the standalone display title).

## Included from v1.1.0 (Feature Highlights)

- Admin actions to mark tickets as returned or unclaimed with validation.
- Returned tickets excluded from wait-time estimates; returning the current ticket auto-advances.
- Unclaimed tickets can only be marked after their draw position has been called.
- Live State sections for Returned tickets and Unclaimed tickets.
- Display legend for ticket status and ticket detail messaging for returned/unclaimed/called-at.
- Read-only standalone display updated for parity with new legend/status behavior.
- Admin cards use subtle status gradients; Sonner toasts added for validation/error feedback.

## Versioning

- Bumped application version to **1.1.2**.
