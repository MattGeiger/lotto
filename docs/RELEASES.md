# William Temple House Digital Raffle System v1.1.1

**Release Date:** January 13, 2026

## Fixes & Reliability

- Draw position advance now skips tickets marked as returned.
- Confirmation dialogs now close after confirming, even when follow-up errors occur.
- Display date now refreshes correctly after long idle periods (including the standalone display title).

## Display Cadence

- Public display polling interval adjusted to 10 seconds (built-in + standalone).
- Standalone `READONLY_POLL_MS` default updated to `10000`.

## Included from v1.1.0 (Feature Highlights)

- Admin actions to mark tickets as returned or unclaimed with validation.
- Returned tickets excluded from wait-time estimates; returning the current ticket auto-advances.
- Unclaimed tickets can only be marked after their draw position has been called.
- Live State sections for Returned tickets and Unclaimed tickets.
- Display legend for ticket status and ticket detail messaging for returned/unclaimed/called-at.
- Read-only standalone display updated for parity with new legend/status behavior.
- Admin cards use subtle status gradients; Sonner toasts added for validation/error feedback.

## Versioning

- Bumped application version to **1.1.1**.
