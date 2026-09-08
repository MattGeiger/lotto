# Announcements & Formatting

Post a message that greets every guest when they arrive — a schedule change, a
special notice, or anything else worth calling out before they get their
ticket.

![The Announcement editor showing its formatting toolbar, live preview, schedule, and save control](/help-screenshots/announcement-editor.webp)

## Writing One

1. Open the [Staff Dashboard](02-staff-controls.md) (`/admin`) and expand
   **Advanced**.
2. Find the **Announcement** card and type in **Live Preview**, using the
   toolbar for titles, bold, italics, and lists. Switch to **Edit Code** when
   you want to type Markdown directly.
3. Announcements are capped at 1,800 characters; a live counter shows how much
   room is left. Unsaved drafts stay in your browser if you switch away and
   come back.
4. Optionally set **Show from** / **Hide after** dates to schedule when it
   appears — leave them blank to show it right away, indefinitely.
5. Save.

## Formatting Announcements

![The Announcement editor in Edit Code mode with formatted Markdown and its controls](/help-screenshots/announcement-formatting.webp)

The toolbar handles the common options, so you do not need to memorize the
syntax. Use **Live Preview** to check the finished message before saving. If you
prefer to work in **Edit Code**, these are the supported patterns:

### Titles

Start a line with `##` and a space:

```
## Pantry closed Friday
```

### Bold and italics

Use double asterisks for bold and single underscores or asterisks for italics:

```
We are **closed** on Friday.
Please arrive _before_ noon.
```

### Lists

Start each bulleted line with a dash and each numbered line with a number and
period:

```
- Canned goods
- Fresh produce
- Bread

1. Take a ticket
2. Watch the board
3. Come up when your number is called
```

### Links

Put the link text in square brackets and the address in parentheses:

```
See [today's hours](https://williamtemple.org).
```

## Where Guests See It

The announcement appears as a step in the homepage welcome flow — after
choosing a language, before entering a ticket — shown once per visit. Only one
announcement is active at a time; saving a new one replaces the old.

## What To Read Next

- Running the rest of the queue: [Staff Controls](02-staff-controls.md).
