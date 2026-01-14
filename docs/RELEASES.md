# William Temple House Digital Raffle System v1.1.0

**Release Date:** January 13, 2026

## Queue Management (Returned/Unclaimed)

- Added admin actions to mark tickets as returned or unclaimed with validation.
- Returned tickets are excluded from wait-time estimates; returning the current ticket auto-advances to the next available draw position.
- Unclaimed tickets can only be marked after their draw position has been called.

## Live State Visibility

- Added Returned tickets and Unclaimed tickets sections under Live State for quick confirmation.

## Public Display Updates

- Added ticket status legend (not called, now serving, called, unclaimed, returned).
- Ticket detail dialog now shows status-specific messaging and called-time context.
- Read-only standalone display updated for parity with new legend/status behavior.

## Admin UX & Feedback

- Returned/unclaimed admin cards use subtle status gradients and consistent input backgrounds.
- Sonner toast notifications added for validation and error feedback.

## Versioning

- Bumped application version to **1.1.0**.
