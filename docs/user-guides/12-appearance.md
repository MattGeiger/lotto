# Appearance

Make LOTTO look like *your* organization — name, logos, colors, and the icon
guests see when they install the app — all from a guided setup, no code
required.

## Opening the Setup

![The Appearance manager and live preview on the Staff Dashboard](/help-screenshots/appearance.webp)

Open the [Staff Dashboard](02-staff-controls.md), expand **Advanced**, and find
**Appearance**. The manager names the live configuration; the preview shows its
logo, queue colors, primary action, card surface, and universal status colors
in the current Light, Dark, or Hi-viz mode. Choose **Set up appearance** or
**New appearance** to begin.

## The Steps

### 1. Starting point

Begin from the William Temple House template or a neutral blank slate, then
give the configuration a short name. Saving that name again updates the same
configuration.

![The Starting Point step with template choices and the configuration name](/help-screenshots/appearance-wizard.webp)

### 2. Organization identity

Set the organization and app names, the service heading shown above the board's
date, installed-icon label, tagline, website, public address, and page
descriptions. **Use suggested wording** drafts the descriptions from the
organization name; edit them freely.

![The Organization Identity step with names, service label, links, and descriptions](/help-screenshots/appearance-identity.webp)

### 3. Logos & icons

Upload light- and dark-mode logos as SVG, PNG, JPEG, or WebP, up to 4 MB.
LOTTO verifies the file, previews it at its real app size, warns about
undersized raster art, and can place light artwork on a **Dark plate**. A
roughly square mark generates the browser, Apple, and install icons.

![The Logos and Icons step with light and dark previews and upload controls](/help-screenshots/appearance-logos.webp)

### 4. Your color story

Choose the **Main color**, then optionally add **Accent**, **Background tint**,
**Dark anchor**, and **Light anchor** in that order. Select an exact Tailwind
stop such as `emerald-600`, or use **Extract from light logo** and adjust the
suggestions. The four-mode preview checks readability and protects the
universal Returned-red and Unclaimed-gold meanings.

![The Color Story step with palette roles and a live four-mode preview](/help-screenshots/appearance-colors.webp)

### 5. Staff sign-in

Set the heading, guidance, and field placeholder staff see on the login screen.

![The Staff Sign-in step with its three editable text fields](/help-screenshots/appearance-staff.webp)

### 6. What's in stock

If your organization runs FEED, enable inventory and paste its public inventory
address. Leave this off for a queue-only app.

![The What's in Stock step for enabling an organization's FEED inventory](/help-screenshots/appearance-inventory.webp)

### 7. Review & save

Check the summary and four-mode preview. **Preview in app** applies the draft
only to your current browser; **Stop preview** restores the live look. Use
**Save draft** to keep working later, or **Save & activate** to make it live
after LOTTO prepares any changed service heading for every enabled visitor
language. If translation fails, the draft is saved but the current live
appearance stays in place.

![The Review and Save step with the configuration summary, theme preview, and save actions](/help-screenshots/appearance-review.webp)

## Good to Know

- **Ticket status colors never change.** Returned stays red and Unclaimed
  stays gold in every appearance — those colors mean the same thing in every
  LOTTO, so staff and guests can always trust them. The wizard shows them in
  the preview so you can see they stay put. Your Primary choice does style the
  **Next up** queue card with a bottom-to-top gradient in regular light and dark
  modes; Hi-viz deliberately flattens that surface along with the status cards.
- **Arcade shares your identity, not its game pieces.** Page surfaces, panels,
  controls, text, and Now Serving use the active appearance. Snake pieces,
  pellets, bricks, and other gameplay colors remain stable and recognizable.
- **Activation is atomic and reversible.** LOTTO prepares changed localized
  service copy first, then applies the whole appearance for everyone at once.
  **Use built-in appearance** on the Appearance
  card reverts just as instantly; your saved configuration stays available.
- **Drafts are safe.** A saved draft changes nothing until you activate it.
- **Editing.** Choose **Edit** next to a saved appearance to reopen the
  steps with its current values.
- **Confirmations stay visually focused.** Delete, deactivate, and other
  confirmation windows blur the page behind them consistently with the rest of
  LOTTO's modal windows.

## What To Read Next

- [Staff Controls](02-staff-controls.md) — the rest of the dashboard.
- [Languages & Themes](06-languages-themes.md) — light, dark, and
  high-visibility modes your colors flow into.
