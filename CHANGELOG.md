# Changelog

## [1.4.4] - 2026-02-14
### Changed
- Added explicit Arcade guardrails to `AGENTS.md` requiring clean route/code/style separation from raffle features.
- Documented the Arcade architecture boundary (`src/app/(arcade)/arcade/*` and `src/arcade/*`) and clarified that Arcade must not be integrated into the public display page.
- Replaced `docs/GAME.md` strategy with a separation-first Snake plan using standalone Arcade routes and simple pixel-art UI direction instead of raffle UI element reuse.
- Added `docs/V2.0_PLANNED_FEATURES.md` with v2.0 scope: standalone Arcade page, persistent top "NOW SERVING" banner, game menu, and Snake as launch game.
- Added a dedicated Arcade route group with `/arcade` and `/arcade/snake`, including a persistent top `NOW SERVING` banner and an 8-bit launch menu focused on Snake.
- Added Arcade-scoped 8bitcn-style shadcn wrappers under `src/arcade/ui/8bit/*` and isolated Arcade styling in `src/arcade/styles/arcade.css` to avoid collisions with shared raffle UI.
- Added `@8bitcn` registry metadata in `components.json` for future retro component pulls while keeping current imports separated in Arcade paths.
- Added self-hosted `Press Start 2P` font asset (`src/arcade/fonts/PressStart2P-Regular.ttf`) and applied it via `next/font/local` to Arcade-only layout typography.
- Pruned `src/arcade/lucid_icons` to runtime-useful assets (`SVG/Flat`, `PNG/Flat/16`, `PNG/Flat/32`, and `License`) and removed shadow/spritesheet/Aseprite/source-support extras.
- Enforced `Press Start 2P` as the default inherited typeface across the entire Arcade scope unless a component explicitly overrides it.
- Reduced `/arcade/snake` gameplay instruction copy by four Tailwind size steps total for a cleaner card fit on smaller screens.
- Added a centered `PLAY NOW` Arcade button beneath the `/arcade/snake` instructions card.
- Added a top-left `BACK` button on `/arcade/snake` linking to `/arcade`, using the `Chevron-Arrow-Left` Arcade icon.
- Fixed `/arcade/snake` `BACK` button content alignment so the icon and label render on the same horizontal line.
- Switched the `/arcade/snake` back icon to an inline SVG with `currentColor` fill so the chevron always matches button text color.
- Added the same top-left `BACK` button on `/arcade`, linking users back to the home page (`/`).
- Reordered `/arcade` header layout so `ARCADE GAMES` appears above the `BACK` button.
- Center-aligned Arcade titles (including shared Arcade `CardTitle` output and game-tile `h2` headings) so titles are no longer left-justified.
- Added a mobile-first `/arcade/snake` gameplay shell with a stable square board (`clamp(240px, 88vw, 420px)`) and a sticky bottom D-pad (`UP/LEFT/RIGHT/DOWN`) with safe-area padding.
- Replaced `/arcade/snake` D-pad text labels with the requested chevron icon assets (`Chevron-Arrow-Up/Down/Left/Right`) rendered as `currentColor` SVGs and explicitly styled to Arcade yellow.
- Wired `/arcade/snake` `PLAY NOW` to smooth-scroll and focus the gameplay board section automatically.
- Centered the `D-PAD` label in the middle control cell of the `/arcade/snake` on-screen D-pad.
- Switched Arcade `Now Serving` polling from a fixed interval to the same adaptive display strategy (visibility-aware timeout scheduling, burst mode on changes, operating-hours-aware cadence, and 30s error retry).
- Added explicit documentation-priority guardrails to `AGENTS.md`, requiring docs to stay current and implementation plans to be documented before major feature work.
- Expanded `docs/GAME.md` with a current-state snapshot and a detailed Snake logic implementation checklist (engine, loop, controls, collisions, scoring, lifecycle, testing, and MVP definition of done).
- Added a current implementation checkpoint to `docs/V2.0_PLANNED_FEATURES.md` so the v2.0 plan clearly distinguishes completed Arcade shell work from remaining Snake gameplay logic/tasks.
- Implemented the first Snake gameplay increment: a running movement loop with a fixed 3-segment snake body, controlled by keyboard arrows and the Arcade D-pad (no food/collision/scoring yet).
- Updated Snake page instructional copy and board HUD to reflect navigation-only behavior for this milestone.
- Implemented the next Snake increment: wall/self collision detection, game-over state, and restart/reset controls while keeping food/scoring deferred.
- Updated `docs/GAME.md` and `docs/V2.0_PLANNED_FEATURES.md` checkpoints to reflect that movement + collision milestones are now complete and food/scoring remain in progress.
- Increased `/arcade/snake` game-over overlay text sizing to large-display scale for improved restart readability.
- Removed the `RESTART RUN` button state, kept the `RESET` button, changed overlay copy to `TAP HERE TO PLAY AGAIN`, and made the Snake play area tap/click-restart the run while in `GAME OVER`.
- Added Snake food pellet gameplay with random spawn on unoccupied cells, score increment on pellet collection, and immediate pellet respawn while keeping body length fixed at 3 for this increment.
- Added dedicated `.arcade-snake-pellet` styling in Arcade-scoped CSS so food is visually distinct from snake segments.
- Removed a duplicate `/arcade/snake` restart callback and corrected game-over input-queue clearing to run on status transitions.
- Updated `docs/GAME.md` and `docs/V2.0_PLANNED_FEATURES.md` checkpoints to reflect that food+score is complete and growth-on-food is now the next pending gameplay milestone.
- Fixed `/arcade/snake` hydration mismatch by removing random pellet generation from initial render and using a deterministic first pellet position in interior grid cells (so the pellet is visible on first load) before client-side gameplay randomization begins.
- Enabled Snake growth on pellet consumption (`+1` segment each pellet) and updated movement/collision logic so growth ticks still enforce correct self-collision behavior.
- Updated `/arcade/snake` pellet visual from a circular glow to a solid green pixel that fills one grid cell.
- Replaced Snake `STOP` with a `PAUSE` -> `START` toggle that preserves active run state and resumes from the same board position.
- Removed in-board top/bottom Snake stat overlays and moved gameplay readouts above and below the board to keep food/snake cells unobscured.
- Enhanced Arcade `NOW SERVING` visibility with a retro-styled change alert pulse on the banner/value whenever the serving number updates.
- Stabilized the top Snake readout to a fixed two-row layout so direction/value text changes (for example `UP` vs `RIGHT`) no longer shift the board position during gameplay.
- Updated Snake head color from pink to orange for clearer player-avatar contrast within the Arcade board.
- Removed the bottom Snake `LAST INPUT` readout banner to reduce duplicate direction telemetry and keep the play area focused on board + D-pad interaction.
- Updated Snake scoring so each pellet awards `1000` points (score now advances in 1,000-point increments).
- Updated Snake readout labels from `DIR` to `DIRECTION` and from `LEN` to `LENGTH` for clearer status terminology.
- Simplified the Snake top readout to show only `SCORE` and `LENGTH`, removing `STATUS` and `DIRECTION` and collapsing the bar to a single-row metrics layout.
- Replaced the center `D-PAD` text with a functional `PAUSE`/`START` control button in the on-screen controls and removed the duplicate pause toggle from the upper action row.
- Updated the center Snake control to a three-state label flow: `START` on initial load, `PAUSE` while running, and `PLAY` while paused.
- Styled the center Snake `PAUSE`/`PLAY` control as the primary filled yellow button (instead of outline) to match Arcade action emphasis.
- Wired the center Snake `START` action to the same smooth scroll/focus behavior used by `PLAY NOW`, so start from the D-pad also jumps the user to the gameplay area.
- Added adaptive mobile viewport sizing for Snake gameplay by deriving board/readout width from both `vw` and `dvh`, plus short-screen control-density tuning (smaller D-pad spacing/button heights) to improve fit on smaller devices.
- Adjusted Snake scoring to award `10` points per pellet (score now advances in 10-point increments).
- Increased short-screen Snake board sizing slightly (within the adaptive `dvh`/`vw` clamp) so gameplay area is larger while preserving full-content fit on smaller devices.
- Updated the `/arcade` menu Snake CTA to use the primary filled Arcade button style and explicit `SNAKE` label, with a direct link target of `/arcade/snake`.
- Updated the `/arcade` Snake CTA label from `SNAKE` to `PLAY SNAKE`.
- Reworked Arcade `NOW SERVING` number-change animation to a three-phase sequence in-banner: zoom to `2x` with `+20px` drop, 10 back-and-forth `±10deg` shakes, then return to original scale/position without obstructing gameplay.
- Tuned Arcade `NOW SERVING` number-change animation by keeping the zoom/drop sequence and replacing the shake phase with the prior retro pulse/blink treatment for improved readability.
- Simplified `/arcade` menu game-card CTA rendering so any non-`comingSoon` game reliably renders its play button (ensuring `PLAY SNAKE` remains visible for the Snake card).
- Updated `/arcade/snake` instruction card copy to the concise five-line ruleset (`USE ARROWS TO MOVE`, `EAT PELLETS FOR POINTS`, `EATING MAKES YOU GROW`, `AVOID WALLS AND YOUR BODY`, `CRASHING ENDS THE GAME`).
- Increased Arcade typography scale across menu/gameplay/banner/controls/language-switcher surfaces to compensate for the newly standardized pixel font's smaller visual footprint.
- Increased Arcade typography by an additional step across the same section-wide surfaces for improved readability with the new pixel font.
- Added an Arcade-only same-color hard text shadow to retro/UI text styles to create a pseudo-bold pixel-font treatment while preserving existing glow accents.
- Refined Arcade pseudo-bold text shadow to use tighter offsets with fuller directional coverage, reducing double-print artifacts while keeping heavier glyph weight.
- Increased Arcade global character spacing again (`.arcade-retro` to `0.64em`, `.arcade-ui` to `0.32em`) so glyphs have stronger horizontal separation with the new standardized pixel font.
- Fixed Arcade RTL language switcher dropdown anchoring so Arabic/Farsi menus open inward (`left-0`) instead of off-screen when the control sits on the left edge.
- Added an Arcade-only retro light/dark mode toggle in the top bar (no system/hi-viz option), with homepage-style placement: language on upper-left and theme toggle on upper-right.
- Added a WCAG-focused Arcade light-theme pass by remapping light-mode accent tokens and action/contrast tokens (`--arcade-action-*`, `--arcade-ghost-contrast`) so text + control states meet AA contrast targets.
- Fixed Arcade light-mode game-tile card contrast by replacing the hard-coded dark tile fill with a theme token (`--arcade-menu-card-bg`) and assigning an AA-compliant light tile surface for card text.
- Added Arcade Snake settings slider support using the `@8bitcn/slider` component in `/arcade/snake`.
- Consolidated Snake speed/difficulty into one six-step mode slider (`VERY EASY`, `EASY`, `NORMAL`, `HARD`, `VERY HARD`, `NIGHTMARE`).
- Mapped mode stops to integrated behavior profiles (tick speed + wall-distance spawn gating), including Nightmare pellet timeout respawn after 5 seconds when uneaten.
- Removed decorative border framing around slider controls after moving to the single-slider design.
- Improved Arcade Snake slider contrast tokens for WCAG non-text contrast in dark mode (with light-mode parity checks), increasing visibility of the track/range/thumb against card backgrounds.
- Removed hard text-shadow treatment from small Snake UI text (mode label and score/length readout) to improve readability while keeping heavier retro styling on larger headings/alerts.
- Added localized Snake mode-setting labels across all supported display languages in `src/contexts/language-context.tsx`.
- Updated `docs/GAME.md`, `docs/ISSUES.md`, and `docs/V2.0_PLANNED_FEATURES.md` to document the unified mode slider and Nightmare behavior.

## [1.4.3] - 2026-02-13
### Changed
- Added a local Animate UI-style theme transition primitive at `src/components/animate-ui/primitives/effects/theme-toggler.tsx` with directional View Transition `clip-path` animation for Light/Dark/System theme changes.
- Updated `ThemeSwitcher` to route base theme updates through the new transition primitive while preserving existing `Hi-viz` contrast behavior and menu UX.
- Added reduced-motion and no-View-Transition fallback handling so theme updates remain immediate when animation should not run.
- Added `ThemeSwitcher` test coverage for the `document.startViewTransition` path.
- Verified full suite + production build after integration (125 tests passing; build clean).

## [1.4.2] - 2026-02-13
### Changed
- Enforced concrete-bound batch validation messages so post-init `generateBatch` rejects now return actionable copy with the current locked value (start mismatch and end shrink cases).
- Locked batch expansion semantics to atomic persistence: when `endNumber` is increased during `generateBatch`, the expanded end is only persisted if the draw succeeds.
- Strengthened batch/append safety rules by rejecting append attempts while undrawn tickets remain in the active range.
- Updated admin range controls so Start is locked after first draw, End locks after pending reaches zero, and batch remaining counts preview pending tickets for a locally increased End value before submission.
- Added tests covering concrete-bound message contracts, atomic end-number persistence on successful/failed expanded batches, and route-level 400 handling for typed user-input errors.
- Documented the localhost-verified problem/solution flow in `docs/ISSUES.md` and published release notes in `docs/RELEASES.md` for v1.4.0.
- Fixed login tab hydration mismatch by using stable trigger/content IDs and ARIA pairings instead of runtime-generated IDs.
- Fixed login tab shadow-edge artifacts by removing inactive-panel blur filtering while preserving slide + height animation behavior in animated tabs.
- Removed animated blur filters from morph text transitions (display now-serving, language morph text, and shared morphing primitive defaults) to improve frame consistency on low-power Chromium clients.

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
- Restored demo-parity motion for `Button` `asChild` usage by routing `src/components/animate-ui/primitives/buttons/button.tsx` through the motion-capable animate `Slot`.
- Upgraded local animate tabs primitive to demo-parity sequencing (horizontal panel track + auto-height animation + trigger tap-scale), and documented the full parity audit in `docs/V1.4_PLANNED_FEATURES.md`.
- Replaced static icons with animated variants wherever available from Animate UI and lucide-animated (admin/staff/theme/language/dialog/ui primitives), while keeping unsupported icons static.
- Fixed Hi-viz theme trigger icon sizing by forcing `EyeIcon` SVG size to match Sun/Moon in the mode switch control.
- Updated `/staff` CTA button icons to animate reliably on initial page load, hover, and tap/click by driving icon motion from button interaction events.
- Updated `/staff` footer attribution text to include individual links for Matt Geiger, Temple Consulting, Claude, and Codex.
- Updated admin page icon behavior so static Lucide icons now animate on initial page load, hover, and tap/click using a shared `AdminAnimatedIcon` wrapper; enhanced existing animated icons with tap and load triggers.
- Replaced the admin “Live State” title icon with animated `MonitorCheckIcon` (`lucide-animated`) for parity with the v1.4 motion direction.
- Updated admin “Draw position” card hierarchy so the large value is the ticket number, while draw position is shown as smaller text with position-of-total context.
- Replaced the display page “Now Serving” value transition with the Animate UI `MorphingText` primitive so updates morph between values (including `Pending` to first serving number).
- Tuned display “Now Serving” transition to a bottom-up insert/sweep profile (instead of default crossfade-like morph settings) using MorphingText `initial/animate/exit` overrides.
- Enabled one-character-at-a-time sequencing for display “Now Serving” transitions by adding per-character stagger support to `MorphingText`.
- Applied the same per-character bottom-up morph style to display-page translated labels/messages (including the ticket detail and not-found dialogs) so visible text animates on language switches.
- Added word-aware wrapping mode to `MorphingText` and made `LanguageMorphText` use it by default, preventing per-character line breaks (for example, Spanish display labels no longer orphan trailing letters).
- Reverted an over-slow text morph timing experiment and restored the approved v1.4 spring baseline for display readability (`Now Serving`: `80/16/0.45`, `LanguageMorphText`: `90/16/0.4`).
- Fixed Vietnamese waiting-state wrapping on the display page by forcing the large "Now Serving" morph text to wrap by word (`wordWrap="word"`), preventing orphan trailing characters (for example `ờ`) on a separate line.
- Updated the public display "Now Serving" value animation to use Animate UI `RollingText` for numeric ticket values while preserving `MorphingText` for word states (for example, localized waiting text).
- Increased per-character stagger timing on the public display numeric `Now Serving` rolling animation for a more pronounced sequential roll.
- Fixed numeric `Now Serving` rolling transitions to animate from the previous value to the next value (for example, `36 -> 43`) instead of rolling the new value against itself.
- Slowed the public display numeric `Now Serving` rolling animation by 50% (`duration: 0.75`, per-character stagger `delay: 0.15`) for improved readability.
- Updated the public display search icon trigger mapping to use `path` on initial view load, `find` on hover, and `default` on tap/click.
- Updated display search icon wiring to use `AnimateIcon` wrapper triggers with `completeOnStop`, ensuring tap/click runs visibly while preserving `path` (load) and `find` (hover) behavior.
- Set display search icon size parity to `1.8rem` to match language/theme switch button glyph sizing.
- Updated `/admin` icon behavior split: interactive control icons (`ArrowLeft`, `ChevronLeft/Right`, `Undo2`, `Redo2`) remain load/hover/tap animated, while visual/status card iconography is now static.
- Updated mode switcher icon behavior so Light (`Sun`), Dark (`Moon`), System (`SunMoon`), and Hi-viz (`Eye`) all animate on load/hover/tap using default animations, and retrigger default motion when switching between mode icons.
- Fixed ThemeSwitcher hydration mismatch by rendering a mount-safe SSR fallback icon state before resolving client theme/contrast mode.

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
