# Polling Strategy

## Current Implementation (as of today)
- Client polling lives in `src/components/readonly-display.tsx` and uses
  `getPollingIntervalMs` from `src/lib/polling-strategy.ts`.
- Poll cadence is driven by:
  - `timeSinceChange` (based on `state.timestamp`),
  - a burst window (30-second polling for 2 minutes after a change),
  - operating-hours windows with a 30-minute slack before/after open,
  - visibility pause (hidden tabs stop polling).
- Windows are derived from `state.timezone`: `closed`, `pre-open`, `open`.
- Baselines when no change has been detected in this session:
  - Closed: every 30 minutes.
  - Pre-open: every 5 minutes.
  - Open: every 5 minutes.
- Active cadence after a change (time since last change):
  - <10 minutes: every 1 minute.
  - 10-30 minutes: every 2 minutes.
  - 30-60 minutes: every 5 minutes.
  - 60-240 minutes: every 10 minutes.
  - >=240 minutes: every 15 minutes (open/pre-open) or 30 minutes (closed).
- Clamps:
  - Pre-open never slower than 5 minutes.
  - Open never slower than 5 minutes to avoid long idle gaps during service hours.
  - Closed never overshoots the next pre-open start.
- Polling pauses when the tab is hidden and resumes immediately on visibility
  return (with change tracking reset).
- Errors retry every 30 seconds.

## Rationale for Open-Window Clamp
During service hours, long idle gaps make the board feel unresponsive and
undermine trust. Clamping open-window polling to 5 minutes ensures the display
refreshes reliably even after overnight idle, so changes show up quickly once
the pantry opens.

## Implementation Details (as of today)
### Goals
- Ensure the display is responsive at and just before opening.
- Provide a short, high-frequency burst when changes occur, then back off
  predictably as activity quiets down.
- Keep request volume low during long idle periods.

### Definitions
- `openTime` / `closeTime`: from `operatingHours`.
- `preOpenStart`: `openTime - 30 minutes` (pre-open slack).
- `postCloseEnd`: `closeTime + 30 minutes` (post-close slack).
- `window`: `closed`, `pre-open`, or `open` (open window runs `openTime` through
  `postCloseEnd`).
- `changeDetected`: a poll where `state.timestamp` differs from the last poll.
- First poll of a session is treated as a change to seed the burst window.
- `sessionLastChangeAt`: timestamp of the first change observed by the current
  display session; set to local `now` when a change is detected; `null` until
  a change is detected.
- `timezone`: use `state.timezone` for window calculations; fall back to the
  device local clock if unavailable.

### Scheduling Rules
1. Visibility:
   - If the tab is hidden, stop polling.
   - On visibility return, poll immediately.
2. Timezone handling:
   - Compute `openTime`, `closeTime`, and `preOpenStart` in `state.timezone`.
3. Opening trigger:
   - Always schedule a poll at `preOpenStart`, even if currently on a long
     closed cadence.
4. Window baselines:
   - Closed: every 30 minutes (outside pre-open/open windows).
   - Pre-open (from `preOpenStart` to `openTime`): every 5 minutes.
   - Open (from `openTime` to `postCloseEnd`): every 5 minutes.
5. Change burst:
   - When `changeDetected`, enter a burst window of 30-second polling for
     2 minutes.
   - Reset the burst window on every detected change (2 minutes from last change).
   - After the burst, switch to the active cadence below.
6. Active cadence (time since `sessionLastChangeAt`):
   - <10 minutes: every 1 minute.
   - 10-30 minutes: every 2 minutes.
   - 30-60 minutes: every 5 minutes.
   - 60-240 minutes: every 10 minutes.
   - >=240 minutes: every 15 minutes (open/pre-open) or 30 minutes (closed).
7. Cadence selection:
   - If `sessionLastChangeAt` is `null`, use the window baseline.
   - Otherwise, use the active cadence table.
   - While open, never allow a cadence slower than 5 minutes.
   - While pre-open, never allow a cadence slower than 5 minutes.

### Decisions Confirmed
- Burst duration: 2 minutes.
- Burst reset: yes, on every detected change.
- Use `state.timezone` for schedule calculations.
- Timezone implementation: use `date-fns-tz`.
- Pre-open cadence: always 5-minute polling unless a change is detected.
- Slack: 30 minutes before open and 30 minutes after close.
- Admin warning: if `state.timezone` differs from the browser/system timezone by
  more than 55 minutes, show an informational warning and let the user proceed.

### Admin Timezone Mismatch Consent (Draft)
When saving operating hours/timezone:
- Compare the browser/system timezone offset to the selected `state.timezone`
  offset at the current time (handle DST).
- If the absolute difference exceeds 55 minutes, show a modal warning:
  - Message: "Your device timezone does not match the pantry timezone. The
    timezone should match the location of services. Continue anyway?"
  - Actions: "Continue and Save" and "Cancel".
- If the user proceeds, save normally. If they cancel, keep the editor open.

### Pre-open Cadence Options (Pros/Cons)
Option A (selected): Always 5-minute polling during pre-open.
- Pros: Strong guarantee of responsiveness right before opening; less sensitive
  to long idle history.
- Cons: Higher request volume every morning even if the site is closed or quiet.
