# Admin Page — Live State Card

The **Live State** card on the admin page (`/admin`) provides a real-time summary of today's raffle drawing. It is the primary at-a-glance status display for staff operating the food distribution lottery.

## Layout

The card uses a responsive CSS Grid with three breakpoint tiers:

| Breakpoint | Grid | Behavior |
|------------|------|----------|
| Mobile (default) | 1 column | All subcards stack vertically |
| Small (`sm`) | 2 columns | Compact pairs; full-width rows span 2 |
| Large (`lg`) | 6 columns | Supports 3-wide (span-2), 2-wide (span-3), and full-width (span-6) rows |

**Container class:** `grid gap-4 sm:grid-cols-2 lg:grid-cols-6`

### Row layout (large screens)

```
Row 1 — 3 columns:   RANGE  |  TICKETS ISSUED  |  CURRENT MODE
Row 2 — 2 columns:   NOW SERVING  |  MAX WAIT TIME
Row 3 — 2 columns:   TICKETS CALLED  |  PEOPLE WAITING
Row 4 — full width:  NEXT UP
Row 5 — full width:  RETURNED TICKETS
Row 6 — full width:  UNCLAIMED TICKETS
```

### Column spans

| Subcard | `sm` | `lg` |
|---------|------|------|
| Range | 1 | `col-span-2` |
| Tickets Issued | 1 | `col-span-2` |
| Current Mode | `col-span-2` | `col-span-2` |
| Now Serving | 1 | `col-span-3` |
| Max Wait Time | 1 | `col-span-3` |
| Tickets Called | 1 | `col-span-3` |
| People Waiting | 1 | `col-span-3` |
| Next Up | `col-span-2` | `col-span-6` |
| Returned Tickets | `col-span-2` | `col-span-6` |
| Unclaimed Tickets | `col-span-2` | `col-span-6` |

## Subcards

### Existing subcards

| Subcard | Source | Display |
|---------|--------|---------|
| **Range** | `state.startNumber` – `state.endNumber` | e.g. "10530 – 10580" |
| **Tickets Issued** | `endNumber - startNumber + 1` | e.g. "51" |
| **Current Mode** | `state.mode` | "random" or "sequential" |
| **Now Serving** | `state.currentlyServing` | Ticket number or "—" |
| **Next Up** | Next 5 tickets after currently serving (skips returned) | Badge list |
| **Returned Tickets** | `ticketStatus` entries with value `"returned"` | Badge list (danger) |
| **Unclaimed Tickets** | `ticketStatus` entries with value `"unclaimed"` | Badge list (warning) |

### New subcards

#### Max Wait Time

**Purpose:** Estimated wait time for the last person in the queue. Staff use this to answer "How long is the wait?" when new arrivals ask.

**Computation:** `Math.round(peopleWaiting * 2.2)` minutes, where `2.2` is the average minutes per ticket (same constant used in the public display's ticket detail dialog at `readonly-display.tsx:307`).

**Display:** Formatted via `formatWaitTime(minutes, "en")` from `src/lib/time-format.ts`. Examples: "12 minutes", "1 hour, 6 minutes". Shows "—" when no one is waiting.

#### Tickets Called

**Purpose:** Number of tickets that have been called so far, including unclaimed tickets but excluding returned tickets.

**Computation:** Count tickets from index 0 through `currentIndex` in `generatedOrder`, excluding any with `ticketStatus === "returned"`. Unclaimed tickets are counted because they *were* called.

**Display:** Integer or "—" when no tickets have been generated.

#### People Waiting

**Purpose:** Number of tickets still waiting to be called, excluding returned tickets.

**Computation:** Count tickets from `currentIndex + 1` to end of `generatedOrder`, excluding any with `ticketStatus === "returned"`.

**Display:** Integer or "—" when no tickets have been generated.
