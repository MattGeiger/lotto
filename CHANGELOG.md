# Changelog

## [1.4.1] - 2026-02-11
### Changed
- Increased base light/dark radius tokens to `1.25rem` in `globals.css` per updated design direction.
- Updated Admin “Generate full” UX so the action stays disabled until Start/End inputs are valid, with wrapped disabled-tap Sonner guidance (ASK style).
- Reduced the Admin header William Temple wordmark to match the display page logo footprint.
- Fixed destructive confirmation button styling so “Yes, Reset Lottery” remains destructive-filled and transitions to destructive-outline on hover (no mixed primary styles).
- Fixed Hi-viz “Pending” descender clipping in the Now Serving header by using a loaded weight and increased line-height.
- Added an Animate UI button primitive and wired `src/components/ui/button.tsx` to use hover/tap scale motion by default (`+5%/-5%`), with reduced-motion support and opt-out props.
- Updated `AlertDialogAction` and `AlertDialogCancel` wrappers to compose the shared animated `Button`, so modal footer buttons now inherit button motion.
- Restored theme switcher trigger icon sizing after animated icon migration and fixed `Button` `asChild` forwarding so icon+label button layouts remain aligned.
- Animated the login page OTP/Magic tabs with demo-style motion: spring sliding highlight, subtle blur/glass overlay, and smooth content transitions using local Animate UI-style tab primitives.

## [1.4.0] - 2026-02-11
### Added
- Added a persisted high-contrast mode (`Hi-viz`) layered alongside existing light/dark/system color-scheme selection.
- Added `ThemeProvider` contrast context and root-class synchronization (`html.hi-viz`) for token-based accessibility theme overrides.
- Added integration tests for theme menu options, Hi-viz persistence, and switching back to standard themes.

### Changed
- Updated the theme switcher dropdown to show iconized menu items: Light, Dark, System, and Hi-viz.
- Added high-contrast token overrides in `globals.css` for both light and dark system contexts.
- Updated Hi-viz custom fonts to Open Sans, Bodoni Moda SC, and IBM Plex Mono (via `next/font/google`) and wired Hi-viz font tokens to the loaded font variables.
- Refined Hi-viz tokens from `docs/HC_UI.md`, and kept both “Now Serving” text and legend serving state on the existing light/dark gradient palette values.
- Fixed font token recursion in `@theme inline` by mapping Tailwind font tokens to separate app font variables, so local render now applies the configured fonts instead of falling back to default sans.
- Updated CSP allowlist for Vercel Speed Insights script/connect hosts to prevent local browser blocks from `va.vercel-scripts.com`.
- Updated NextAuth `trustHost` logic to honor explicit `AUTH_TRUST_HOST=true` (while still trusting Vercel automatically), preventing local `UntrustedHost` failures in development.
- Hardened email provider selection so Resend is only used when `RESEND_API_KEY` matches expected key format, and OTP requests now fall back to SMTP/MailDev in non-production when Resend delivery fails.
- Added a non-production OTP fallback path that still issues a code when email delivery is unavailable and surfaces the development code in the login UI for local testing.
- Enabled automatic auth bypass for localhost development (`NODE_ENV=development` and non-Vercel), so `/admin` and write APIs do not require OTP/login in local dev while production keeps strict auth requirements.
- Fixed Hi-viz font variable resolution by moving Next font variable classes to the root `<html>` element, so `:root.hi-viz` font tokens resolve correctly.
- Updated Admin “Mark ticket as returned/unclaimed” cards to reuse the same `ticket-returned` and `ticket-unclaimed` status styles used by the display legend/key.
- Updated Admin Live State “Next up” sub-card to use the same success/green status token styling used across themes.
- Mapped the latest `docs/HC_UI.md` updates into Hi-viz tokens in `globals.css`, including the updated light card surface value and the revised 3px/4px shadow model for both light and dark Hi-viz variants.

## [1.2.1] - 2026-02-03
### Changed
- Clamp open-window polling to a 5-minute maximum so the public display stays responsive during service hours even after long idle periods.

## [1.2.0] - 2026-01-20
### Changed
- Polished the public display header search cluster so the pill shares the same palette-based gradient, hover fill, and elevation as the language/theme toggles while keeping responsive text/icon scaling, extra horizontal padding, and digit-only input behavior.

### Notes
- 2026-01-22: Rolled back the experimental Blob snapshot caching and restored production to the polling + timezone warning revision.

## [1.1.3] - 2026-01-19
- Added multilingual, mobile-friendly header search that launches the ticket detail modal or a “ticket not found” dialog so clients can find their number fast.

## [1.1.2] - 2026-01-16
### Changed
- Public display polling now uses adaptive backoff with idle tiers and pauses when the tab is hidden.
- Polling honors operating-hours slack windows and caps closed-window intervals by time to next opening.

## [1.1.1] - 2026-01-13
### Changed
- Public display polling interval adjusted to 10 seconds (built-in + standalone).

### Fixed
- Advancing the draw position now skips tickets marked as returned.
- Confirmation modals now close after confirming, even if a follow-up error is surfaced.
- Display date now refreshes correctly after long idle periods.

## [1.1.0] - 2026-01-13
### Added
- Admin control to mark tickets as returned, stored in raffle state for queue adjustments.
- Sonner toast notifications for admin and login error states.
- Returned tickets list in the Live State card for quick verification.
- Admin control to mark tickets as unclaimed after a draw position has been called.
- Unclaimed tickets list in the Live State card for quick verification.
- Display legend for ticket status (not called, now serving, called, unclaimed, returned).
- Display ticket modal messaging for returned/unclaimed tickets and called-time context.

### Changed
- Returned-ticket input styling now matches default input backgrounds for clarity.
- Display URL validation errors now surface via toast notifications.
- Returned tickets are excluded from display wait time estimates, and returning the current ticket auto-advances to the next available draw position.
- Returned/unclaimed admin cards now use subtle status gradients for better readability.
- Live State card description copy updated for clearer staff-facing language.

## [1.0.4] - 2025-12-12
### Changed
- Login now defaults to OTP and places the OTP tab left of the Magic Link tab.
- Documented the recommended OTP-first auth approach and Microsoft Defender magic-link limitation in `docs/AUTHENTICATION.md`.
- Updated the staff landing page to display the app version from `package.json`.
- Cleaned up lint warnings (unused imports/variables, and Next.js `next/image` guidance).

## [1.0.3] - 2025-11-29
### Added
- Operating hours with timezone selection (default PST) persisted in state; display page now shows “Pantry Hours” and closed-day messaging with next open day.
- Admin UI for setting open days/hours with per-day toggles and time inputs; timezone selector added.
- Shadcn select/checkbox/popover primitives added to support the new editor.
- Localized day names and closed labels; clarified reset-state messaging (before opening, after closing, closed today).

### Changed
- Reset now preserves operating hours and timezone instead of wiping them.
- Translations updated with pantry hours/closed messaging.

## [1.0.2] - 2025-11-28
### Changed
- Refined global shadow tokens in `globals.css` (OKLCH base shadow mixes, adjusted transparency) and added `shadow-sm` to default/secondary buttons for clearer elevation.
- Forced Gregorian calendar for all locales in date/time formatting to avoid Solar Hijri display in Farsi/Arabic locales on the public board.

## [1.0.1] - 2025-11-28
### Added
- Added Vietnamese, Farsi, and Arabic translations (raffle-appropriate terminology) to the public display and language switcher.
- Introduced RTL awareness for Arabic/Farsi via `DocumentDirection` (dynamic `dir`/`lang` on `<html>`), reusable RTL utility, and logical text alignment on the display card.

### Changed
- Extended time/date locale formatting to cover all languages and documented RTL requirements in `docs/LANGUAGES.md`.
- Updated README and PROJECT_OVERVIEW feature summaries to list all supported languages and RTL coverage.
- Adjusted ticket detail dialog close button to use logical positioning (`end-4`) for RTL layouts.
- Localized display timestamps to the selected language (including RTL locales) on the public board.
- Scoped RTL handling to the public display so staff/admin pages remain LTR and unaffected by display language choices.

## [1.0.0] - 2025-11-27
### Added
- Production-ready deployment on Vercel at `williamtemple.app` using Neon Postgres, Resend magic links, and OTP fallback.
- Branded OTP email template (React Email, Lato) and shared Neon pool for auth/OTP to avoid connection exhaustion.
- Dual authentication paths (magic link + OTP) with @williamtemple.org domain restriction and rate limiting/lockouts.
- Phase-specific env templates and production env defaults set to `login@williamtemple.app`.
- Snapshot cleanup API and admin controls (keep last 7 or 30 days) with automatic 30-day cleanup on reset to stay within Neon 512MB free tier.
- Vercel Speed Insights integrated in root layout.

### Changed
- Default sender updated from `noreply@williamtemple.app` to `login@williamtemple.app` for better deliverability.
- Middleware migrated to `proxy` for Next.js 16; build-time `DATABASE_URL` enforcement and node runtime declarations retained.
- Login UX rebuilt with shadcn Tabs and InputOTP for clearer flows; admin “Clear” draw position requires confirmation.

### Security
- OTP/magic link tokens hashed, 10-minute expiry, 5-attempt lockout with cooldown, and 1/minute request throttling.
- Auth restricted to `@williamtemple.org`; file storage disabled in production; shared DB pool to prevent connection churn.

## [0.9.0] - 2025-11-26
### Added
- Production-ready deployment on Vercel using Neon Postgres and Resend magic links; custom domain `williamtemple.app` configured.
- Phase-specific env templates for Vercel (preview, custom domain no-auth, full auth).

### Changed
- NextAuth switched to the official Resend provider with email/SMPP fallback for local dev; login form now targets the Resend provider.
- Middleware migrated to `proxy` for Next.js 16, with explicit node runtime in API routes and build-time `DATABASE_URL` enforcement (Turbopack enabled).
- Admin “Clear” draw position now requires confirmation to avoid accidental taps.

## 2025-11-28
- Made display QR rendering robust: added API `getDisplayUrl`, persisted `displayUrl` in state, and switched the display page QR to canvas (`qrcode`) to avoid SVG cropping for long URLs; display now respects admin-configured URLs.
- Reinitialized Shadcn UI primitives (button, input, badge, card, label, separator, switch, dropdown, tooltip, alert-dialog) and aligned them to the generator OKLCH palette with proper `@theme inline` mapping.
- Standardized status styling by adding success/warning/danger badge variants; removed manual per-button color overrides on admin controls for consistent hover/active states.
- Refined admin UI: unified arrow and append buttons (outline + muted state), outline nav buttons, subtler gradient info boxes, theme-aware logos, and consistent “UPDATED” pills; shared display/admin logo sizing and badge styling.
- Updated staff/login/read-only surfaces to use semantic tokens (no slate/emerald/blue literals) and generator gradients; board grid now uses status tokens instead of hard-coded colors.
- Documented Shadcn/Tailwind v4 theme structure and current palette in `docs/UI_DESIGN.md`; cleaned globals to remove stray imports and ensure generator colors drive components.
- NOW SERVING headline gradient: blue in light mode, gold in dark mode via `--serving-text-gradient`.
- Added utilities for badge success styling and gradient cards; removed inline styles from login and staff pages.

## 2025-11-23
- Replaced `/display` with the high-contrast read-only UI from the standalone server, now polling `/api/state` every 4 seconds inside Next.js.
- Added `ReadOnlyDisplay` React component to render the wall-screen layout with served/upcoming styling and date/title updates.
- Documented the built-in display route and clarified the standalone `npm run readonly` server is optional/legacy.
- Made the public display the homepage (`/`) and moved the former landing page to `/staff`; updated internal links and docs accordingly.

## 2025-11-22
- Removed client-side polling timers from `/admin` and `/display` to keep form inputs stable while editing.
- Added a standalone read-only board server (`npm run readonly`) on its own port that polls the persisted JSON state.
- Updated documentation to cover the new read-only board and the non-polling behavior of the main UI.
- Restyled the read-only board with a high-contrast theme, clearer labels, and simplified header content.
- Updated the read-only board header to show the service date and removed the footer disclaimer text.
- Fixed date formatting in the read-only board script to avoid template literal parsing errors.
- Reformatted the read-only board title to show full weekday and ordinal date (e.g., “Saturday, 22nd November, 2025”).
- Adjusted read-only title to show the date without duplicate prefix and to format as “Saturday, November 22nd, 2025”.
- Expanded the read-only board layout to occupy more viewport width.
- Enlarged raffle number badges on the read-only board for better long-distance readability.
- Further increased raffle number badge size and weight for maximum visibility.
- Widened the top info cards and increased their number sizing to stay larger than the raffle badges.
- Changed the admin “Now Serving” control to step through draw positions with arrow buttons using Lucide icons and ordinal labels.
- Added a distinct style for already-called tickets on the read-only board.
- Updated read-only board styling to make served tickets pop and mute upcoming tickets instead.
- Loosened spacing and line-height for read-only number badges and summary numbers to avoid cropped digits.
- Added horizontal spacing for raffle badges and widened their padding for better legibility.
- Protected raffle order when switching modes: mode toggles now only affect future tickets, keep existing order intact, and require confirmation.
- Replaced the “William Temple House” pill on the landing page with the official horizontal logo asset for better branding.
- Removed the “Digital Raffle” pill and expanded the homepage logo to span the card responsively.
- Centralized UI styling around global design tokens in `globals.css` and refactored button, badge, card, input, switch, tooltip, and separator components to consume them.
- Increased contrast for primary buttons via the shared `Button` component rather than page-level overrides.
- Fixed anchor inheritance inside buttons so CTA text uses the button’s foreground color instead of the global link color.
- Increased contrast on the “Open Staff Dashboard” CTA to prevent text blending into the button background.
- Ensured all cards use the solid surface background to match the landing page styling.
- Aligned the read-only board shell to the top of the viewport.
- Removed the mode pill from public and admin headers to simplify the UI and avoid low-contrast badges.
- Added the William Temple House horizontal logo to the top of the read-only board.
- Served static assets (e.g., the read-only board logo) from `public/` so they render correctly.
- Tweaked the draw position arrows so the previous arrow stays muted/outlined and the next arrow remains emphasized.
- Swapped draw-position button styles: previous now uses the filled secondary style, next uses the outlined muted style.
- Fixed admin draw-position button typing by importing `ButtonProps`.
- Reduced and left-aligned the read-only board logo.
- Shrunk read-only number cards and badges for a more compact layout.
- Styled the “Append additional tickets” heading to match primary card titles.
- Kept append arrows inline with the input and placed the Append button beneath for consistent layout.
- Corrected append section markup after layout changes.
- Prevented append arrows from wrapping under the input by constraining widths and disabling wrap on larger screens.
- Made the append left arrow start as secondary and switch to outline once the value advances beyond the starting end.
- Applied a responsive grid layout to the read-only drawing order badges.
- Centered the read-only stat cards and badge content for improved alignment.
- Removed the read-only board shell background so content sits directly on the page.
- Added a welcoming empty state outside the grid when no tickets exist on the read-only board.
- Enlarged the read-only empty-state welcome message for long-distance readability.
- Broke the read-only empty-state message into centered, large multiline lines.
- Forced the read-only empty-state lines to block display to ensure visible line breaks.
- Moved the “Now Serving” card inline with the logo at the top of the read-only layout.
- Added spacing around the ticket range dash on the read-only “Tickets Issued” card for clarity.
- Realigned the read-only header row: logo left, “Now Serving” centered.
- Enlarged the “Now Serving” value on the read-only page to exceed the date line size.
- Further amplified the “Now Serving” value for top-of-page visual hierarchy.
- Doubled the “Now Serving” text size for maximum prominence.
- Doubled the “Now Serving” size again for extreme visibility.
- Refined header grid so the logo sits left with a spacer and the “Now Serving” card remains centered.
- Added mobile tweaks so the logo stacks above the “Now Serving” card on narrow viewports.
- Applied the gold gradient fill to the “Now Serving” value on the read-only page.
- Removed the border on the “Now Serving” card for a cleaner header look.
- Deepened the read-only background with stronger blue radial gradients.
- Added snapshot history support (list, restore, undo/redo) with admin UI controls.
- Matched the “System reset” heading style to other admin card titles.
- Placed Live State beside History (instead of above) for balanced admin layout.
- Ensured “Share the live board” sits alongside “System reset” on wide viewports.
- Reordered the admin dashboard rows: Ticket Range/Now Serving, Live State/History, then System reset/Share.
- Removed the “Upcoming preview” sub-card from Ticket Range & Order to streamline the admin card.
- Removed the unused divider at the bottom of the “Now Serving” admin card.
- Added the horizontal William Temple House logo to the admin header to match the landing page branding.
- Removed the Staff Dashboard and Auto-save badges from the admin header for a cleaner top bar.
- Relaxed the Now Serving line-height on the read-only board to avoid clipping descenders (e.g., the “g” in “Waiting”).
- Documented Vercel hobby/free deployment intent and the need to move persistence off local files to Neon-backed storage.
- Added a concrete Vercel/Neon deploy runbook covering Postgres schema, magic-link auth setup, env vars, snapshot retention, and migration notes.
- Documented routing plan for production domain `williamtemple.app` (root = read-only board, `/login` for magic links, `/admin` for staff).
- Added a Neon/Postgres-backed state manager option gated by `DATABASE_URL` (file storage remains for local dev/tests); documented selection rules without extra toggles.
- Added NextAuth email-based magic link auth (Resend + domain allowlist), protected `/admin` and write APIs via middleware, and introduced a `/login` page.
- Added `AUTH_BYPASS` flag so localhost dev can skip auth and Neon; noted local dev guidance in README.
- Fixed build issues by removing duplicate imports, adding nodemailer dependency, and making snapshot timestamps monotonic for stable undo/redo ordering.
- Added conditional NextAuth Postgres adapter support (Neon) for email magic links and recorded the deployment migration plan in `DEPLOYMENT_MIGRATION.md`.
