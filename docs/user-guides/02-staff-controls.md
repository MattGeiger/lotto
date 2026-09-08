# Staff Controls

Everything you do to run the queue happens on the **Staff Dashboard**. Go to
`/login` and sign in with an authorized staff email. **Magic Link** is the
default; **Verification Code** sends a 6-digit alternative.

![The staff sign-in page with Verification Code selected](/help-screenshots/sign-in-code.webp)

For a Magic Link, open the email and select **Sign in** on the confirmation
page. That final confirmation prevents email security scanners from consuming
the link. Either method opens `/admin`; already signed-in staff can go there
directly.

## Setting Today's Ticket Range

Before calling anyone, tell LOTTO which ticket numbers are in play.

![Ticket range, order mode, Now Serving, Returned, and Unclaimed controls on the Staff Dashboard](/help-screenshots/staff-dashboard.webp)

1. Open the Staff Dashboard (`/admin`).
2. Enter the **start** and **end** numbers for today's tickets.
3. Save. The board and client lookups now recognize that range.

A drawing can be **random** (numbers are shuffled into a fair order) or
**sequential**, depending on how your event hands out tickets.

## Calling Numbers

When you're ready for the next person:

1. Use the **Now Serving / Draw Position** control on the dashboard.
2. The number you call becomes "Now Serving" on the [display board](03-display-board.md)
   and on that client's phone — with a celebration when it's their turn.
3. Repeat as each client is served.

## Handling Problem Tickets

Not every called number shows up. You can mark a ticket:

- **Unclaimed** — called, but nobody came. It stays visible in gold so staff and
  clients can spot it.
- **Returned** — pulled out of the drawing entirely; it will not be called.

Mark these from the dashboard; the board updates with the matching status color.
The **Mark ticket** action is red for Returned and gold for Unclaimed. Until a
valid ticket number is entered, the action stays neutral to show that it is not
yet available.

The dashboard's **Live State**, **Now Serving**, **Served**, and **Next up**
surfaces follow the active appearance. Their regular light/dark gradients
become flat in Hi-viz. **Returned** always stays red and **Unclaimed** always
stays gold, regardless of agency branding.

**Made a mistake?** In the **Returned tickets** and **Unclaimed tickets** lists,
tap any ticket number and confirm **Revert** to clear its status — the ticket
returns to normal without changing who's currently being served.

![The Unclaimed and Returned ticket lists, where tapping a number starts a revert](/help-screenshots/ticket-status-lists.webp)

![The confirmation required before LOTTO reverts a ticket's status](/help-screenshots/ticket-status-revert.webp)

## Operating Hours & the Display URL

- **Operating hours** tell the board when the pantry is open, before-open, or
  closed, so clients see the right message.
- The **display URL / QR code** can point clients to wherever you like; by
  default the board's QR sends them to the home screen to look up their ticket.

## Ending a Service Day

Choose **Reset for New Day** when the queue is finished. LOTTO first preserves
the meaningful queue activity for FEED Analytics, then clears the live board.
An empty reset creates no history. If a reset happens the following morning,
the preserved session still belongs to the date its first tickets entered the
queue.

LOTTO records the operational facts only. If the pattern looks like testing or
an accidental setup, FEED withholds it from Analytics and asks staff to classify
it there; Reset does not add another question to the end-of-shift workflow.

## Connect Queue History To FEED

![The History card with undo, snapshot restoration, and FEED synchronization controls](/help-screenshots/feed-history.webp)

An authorized administrator can open the **History** card, find **Sync With
FEED**, and select **Setup**. A status tag shows whether LOTTO has an active
token, and the line beneath the button shows when that token was generated.
The window shows the LOTTO URL and lets you generate the one active
synchronization token. Copy both values into FEED's **Data Management → LOTTO
Queue Data → Configure** window, then use **Sync now** in FEED.

The token is shown once. Generating another immediately invalidates the value
already saved in FEED, so update FEED before the next synchronization. Ordinary
daily synchronization and review happen in FEED; LOTTO's Reset workflow does
not change. The **Configured** tag confirms that LOTTO has a token; a successful
FEED synchronization confirms that both applications hold the matching pair.

![The FEED setup window with the LOTTO URL, pairing instructions, and token action](/help-screenshots/feed-setup.webp)

## The Advanced Section

![The expanded Advanced section with configuration cards for less-frequent setup work](/help-screenshots/advanced-section.webp)

Expand **Advanced** on the dashboard for less-frequent setup tasks: operating
hours, display-language rotation, writing an
[announcement](10-announcements.md), and
[AI-powered translation](11-ai-translation.md).

The **Help** link opens the searchable staff guides. Use **Back** in the
upper-left corner of Help to return directly to the Staff Dashboard.

Destructive confirmations such as **Clear draw position** and **Reset for New
Day** blur the dashboard behind the confirmation window. The blur is a visual
focus cue; it does not change what will happen, and the action still requires a
separate confirmation.

## What To Read Next

- How clients see all this: [Tickets & the Queue](04-tickets-queue.md).
- Putting the board on a screen: [The Display Board](03-display-board.md).
- Greeting guests with a message: [Announcements](10-announcements.md).
- Adding more languages: [AI-Powered Translation](11-ai-translation.md).
- Something not working? [Troubleshooting](08-troubleshooting.md).
