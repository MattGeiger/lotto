# Unreleased

# LOTTO v2.0.0-rc.3

**Release Date:** September 7, 2026 (production release candidate)

RC.3 is the first build intended to run on `williamtemple.app` itself. It
separates two questions that RC.2 answered with one variable: whether a
deployment may use the realtime hub, and whether it is the beta sandbox.

`LOTTO_DEPLOYMENT_ENVIRONMENT` previously permitted realtime only when set to
`beta`, and that same value drives the sandbox presentation — the "Beta test
environment" banner, the blocking `robots.txt`, and the `X-Robots-Tag` header.
Production therefore could not enable realtime without de-indexing the live site
and telling every client that their actions do not affect the real app. Realtime
eligibility now accepts `beta` or `production`, while every sandbox behavior
still requires exactly `beta`.

The gate remains fail-closed, which was the point of the original restriction:
only those two exact values qualify. An unset, empty, or near-miss value
(`prod`, `Production`, `staging`) refuses realtime rather than assuming it is
welcome, so a deployment must opt in deliberately — being merely "not beta" is
never sufficient.

The Cloudflare Worker gains a named `production` environment deploying as
`lotto-realtime-production`, which carries its own Durable Object namespace and
allowlists only `https://williamtemple.app`. No beta namespace, secret, origin,
or state is reused. Publish and control tokens must be freshly generated per
environment.

This release candidate targets the existing personal Hobby production account.
The migration to the organization's Vercel Pro account remains pending approval
and is unchanged as the eventual destination; this deployment is a validation
step toward it, not a substitute for it. The stable v2.0 gates — Pro account,
ten representative service days, physical iPadOS 15 device validation, and the
measured reduction in public-origin Neon reads — are still open, which is why
this remains a release candidate.

**Deployment order matters.** `raffle_state.revision` is written on every
mutation, so the additive schema must be applied to production Neon *before*
this build is deployed. See `docs/PRODUCTION_RC3_CUTOVER.md`.

# LOTTO v2.0.0-rc.2

**Release Date:** September 3, 2026 (beta release candidate — not promoted)

RC.2 makes the realtime/fallback controller the default for ordinary Home,
Display, Inventory, and Arcade URLs on the isolated beta. The exact initial
Neon/hub handshake remains mandatory, healthy realtime suppresses scheduled
state polling, and every authority failure performs immediate reconciliation
before resuming the existing adaptive poller.

The release adds `?realtime=poll` as a socket-free control, retains
`?realtime=observe` and `?realtime=source` for diagnostics and compatibility,
and introduces the Vercel application gate plus authenticated Cloudflare
drain/resume control. Production, `main`, and `williamtemple.app` are unchanged.

Realtime operational hardening now includes two independent emergency
controls: a server-only Vercel application gate for new page loads and a
Cloudflare Durable Object drain/resume control for existing sockets. Draining
does not stop publication, remove the latest public state, or affect Neon staff
transactions. Realtime and polling also share one activity clock, preserving
the existing quiet-time and off-hours cadence after fallback.

The isolated beta deployment connected all four ordinary public routes at
revision `91`. A live Worker drain forced a fresh Display load into adaptive
polling fallback, resume restored realtime automatically, and the ordinary
Display route connected on the iOS 15.4 simulator. The Vercel master gate is
deployed and code/build-tested; unlike the Worker control, it has not been
live-toggled because that exercise requires disable and restore deployments.

The William Temple House production migration is planned for a new project in
the consulting business's existing Vercel Pro account, with an attended change
window no earlier than September 3, 2026 after 2:30 PM Pacific. The old
production and Hobby beta account/project remain rollback/comparison targets
until explicit acceptance.

# LOTTO v2.0.0-rc.1

**Release Date:** September 2, 2026 (beta release candidate — not promoted)

LOTTO v2.0.0-rc.1 identifies the completed Phase 5 realtime-source canary and
the documented production-test direction. The Cloudflare Durable Object hub is
a derived public read model; Neon remains authoritative for authenticated
commands, atomic revisions, snapshots, undo/redo, and repair evidence. Home,
Display, Inventory, and Arcade have all passed a full-stack pushed revision on
the isolated beta, with automatic return to adaptive polling when realtime
authority is lost.

This is a release-metadata milestone, not the default-realtime behavior change.
Ordinary beta URLs still poll, and the source controller still requires the
exact `?realtime=source` cohort. The next Phase 6 implementation will make that
controller the ordinary beta default, add a polling-only control, rerun the
release gates, and prepare production-scoped resources. Production, `main`, and
the apex domain are unchanged.

# LOTTO v1.26.0

**Release Date:** August 30, 2026

LOTTO v1.26.0 promotes the complete beta.1/beta.2 Appearance program to the
stable release line. FEED's fixed-role Tailwind v4 color workflow, image
processing, family/weight picker, four-scope preview, and dev-only palette
calibration experience are now adapted to LOTTO's Next.js, localization,
Vercel Blob, protected queue-status, and iPadOS 15 emission boundaries.

The final release adds two staff-facing presentation improvements. The Admin
Advanced grid now places a live semantic preview beside Appearance management,
so the active identity, queue progression, primary action, ordinary surface,
and universal status colors are visible without opening the wizard. The shared
AlertDialog overlay now includes the same backdrop blur already used by Dialog
and Sheet, bringing Clear draw position, Lottery Reset, appearance deletion,
and every other confirmation into one modal-focus contract.

The release also closes the final beta follow-ups: Live State metrics share the
Draw position gradient; custom Next Up uses a real two-stop serving gradient;
and Hi-viz inherits the regular type hierarchy. The prior beta entries below
retain the complete implementation, compatibility, and device-validation
record.

Documentation was reviewed as part of the release rather than treated as a
version-number edit. README feature claims now match the dynamic language
catalog, current production Arcade, Tailwind v4 branding, and project roadmap.
Help guidance explains the live preview and modal focus treatment. Arcade
planning no longer calls a shipped Snake incomplete or describes Pantry Time as
a commercial-game clone. `docs/V1.30_PLANNED_FEATURES.md` establishes an
original-expression review and a bounded candidate/prototype process for the
next game.

Release verification is green: lint passes; 121 test files contain 821 passing
tests plus one intentionally skipped production-only fixture; the production
build succeeds; all 42 chunks pass the legacy syntax scan; and the production
hydration/interactivity smoke passes for `/` and `/login`. The local production
server and `.next` tree were removed after verification.

# LOTTO v1.26.0-beta.2

**Release Date:** August 30, 2026 (beta — not promoted)

The FEED parity work now ports the live color-step interaction instead of
maintaining LOTTO's shorter reimplementation. Fixed slots, logo extraction,
closest-family suggestions, search, family/weight selection, and add/clear
behavior align with FEED. LOTTO retains only product-boundary differences:
four preview modes, localization-safe activation, protected queue semantics,
and Next/Vercel storage and legacy-emission adapters.

The previously recorded Accent/Ambient reach gap is closed. Issue 45 is also
fixed with pre-alpha soft/base/strong shadow tokens, which avoids both FEED's
polar-space hue defect and LOTTO's opaque iPadOS 15 fallback. The full suite,
production build, 42-chunk legacy scan, hydration smoke, and both simulator
checks are recorded in the Unreleased changelog; Vercel preview plus real-device
sign-in remain the promotion gate.

The beta also closes the simulator findings from the cross-device pass:

- The iOS 15 iPhone active-navigation surface uses a pre-alpha theme token and
  no longer becomes an opaque block over the icon and label.
- Arcade's enabled-language list shows a bottom-fifth blur cue while more
  choices remain, and its native scroller is not captured by pull-to-refresh.
- Pull-to-refresh may begin anywhere on an unscrolled installed-app page.
- Next Up uses the configurable serving gradient; the card order is Next Up,
  Unclaimed, Returned, with the latter two still canonical.
- Runtime Appearance roles now style Arcade chrome and Now Serving without
  changing game-art colors.
- FEED's development-only live palette calibration side sheet and JSON export
  are ported with LOTTO's legacy-safe CSS emission boundary.

# LOTTO v1.26.0-beta.1

**Release Date:** August 29, 2026 (beta — not promoted)

LOTTO v1.26.0-beta.1 brings FEED's white-label colour and image workflow to the
Appearance wizard. Colours are chosen as five fixed semantic roles — Primary,
Accent, Ambient, Dark anchor, Light anchor — and every choice is an exact
Tailwind v4 palette stop rather than free-form CSS, so a role's value is stable,
comparable, and cannot drift. Clearing an optional role no longer reorders the
ones after it. Logo extraction, canvas picks, and the EyeDropper all snap to the
same palette, and the preview covers light, dark, and both high-visibility
modes.

## Fixed on the support floor

The wizard's own preview did not survive iPadOS 15. `serializeBrandThemeCss`
already made the injected brand stylesheet legacy-safe with an sRGB baseline and
an `@supports (color: oklch(0 0 0))` layer on top, but the preview paints with
React `style` props fed straight from the derived tokens, and an inline style has
no `@supports` to hide behind. On that engine `oklch()` with a bare-number
lightness is invalid, so the declaration was dropped outright — the panels had no
background and inherited the dialog's dark surface, making the light and dark
previews identical, and "Found in logo" rendered as empty circles. An operator on
the shipped hardware could not see what they were choosing.

Inline styles now pass through `useLegacySafeColor`, which reads engine support
with `useSyncExternalStore` — the server snapshot is the floor, so the first
client paint matches and modern engines keep the wide-gamut original. Verified on
the iOS 15.4 simulator. See `docs/ISSUES.md` Issue 44.

## Known gaps before promotion

- **Accent and Ambient do not reach every scope they are labelled for.** Accent
  changes no tokens in dark or either high-visibility mode; Ambient tints card
  gradients but never the page backdrop, which is driven by Primary regardless.
  Closing this means editing the derivation rules, which requires approval,
  tests, and doc updates under `AGENTS.md`. Tracked for beta.2.
- **Device validation is incomplete.** This is a client-bundle change, so a
  Vercel preview off `dev` and a successful sign-in on the real iPad mini 4 are
  still required before promotion.

# LOTTO v1.25.1

**Release Date:** August 26, 2026

LOTTO v1.25.1 makes the SMTP transport structurally unavailable in production.

Every branch in `auth-email-service.ts` that reached `smtpTransport()` already
checked `isProduction` — except the one where `RESEND_API_KEY` is absent or
malformed, which fell through unguarded. `src/lib/auth.ts` refuses to start in
production without a valid key, but `/api/auth/otp/request` imports the email
service directly and never loads that config, so the OTP path was not covered.
Delivery in production depended on the environment being correct rather than on
the code refusing to do otherwise.

The practical impact of the old behaviour was low. An SMTP attempt on Vercel
would have dialled `localhost:1025`, been refused, and failed the request closed
without sending mail. The remaining nodemailer advisory also needs
attacker-controlled message options, and LOTTO builds the message itself.

The value of the change is in what it settles. That advisory requires nodemailer
9.0.1 or later, which falls outside the Auth.js peer range of
`^7.0.7 || ^8.0.5`, so it cannot be resolved by upgrading while Auth.js remains
on its current line. Production can no longer construct an SMTP transport at
all, which makes the advisory's dev-only reachability a property of the code
rather than of the deployment configuration.

`tests/auth-email-transport.test.ts` covers the transport contract, which had no
tests. Both exported senders are exercised, since they are reached by different
routes with different guards. The three guard assertions were confirmed to fail
with the guard removed, so they are regression guards rather than descriptions
of current behaviour.

---

# LOTTO v1.25.0

**Release Date:** August 26, 2026

LOTTO v1.25.0 upgrades Next.js from 16.0.10 to 16.3.2 and closes the remaining
dependency advisories. The client bundle shrinks by roughly 176 KB, from 48
chunks and 3,394,148 bytes to 41 chunks and 3,218,514 bytes.

Next 16.3 bundles its own `sharp` 0.35.4, which reintroduced the libvips
duplicate-class collision first seen during v1.24.1 — but mirrored. The root
copy remained on 0.34.5 with libvips 8.17.3 while Next resolved 8.18.6, loading
two dylibs into one process on the image paths. In v1.24.1 the correct response
was to revert; here it is to move forward, and raising the root copy to
`^0.35.4` deduplicates to a single `sharp`.

`nodemailer` moves to 8.0.11. This was blocked in v1.24.1, when `@auth/core`
still required `^6.8.0`; the beta.32 upgrade in v1.24.3 widened both Auth.js
peer ranges to `^7.0.7 || ^8.0.5` and made the 8.x line available. It resolves
six of the seven nodemailer advisories, including the CVSS 7.5 `addressparser`
denial of service.

The `linkify-it` advisory needed no upgrade at all. The lockfile had pinned
`markdown-it` 14.2.0, holding `linkify-it` at 5.0.1; ordinary resolution moves
to 14.3.0 and 5.0.2, which is patched. An earlier attempt to force
`markdown-it` 15.x through an npm override was reverted once the simpler
resolution proved sufficient — `tiptap-markdown` declares `^14.1.0`, so that
pairing is not one upstream tests, and taking it would have added risk for no
benefit.

What remains is a single unfixed issue: nodemailer's message-level `raw` option
bypassing `disableFileAccess`/`disableUrlAccess`, which requires 9.0.1 or later
and therefore falls outside the Auth.js peer range. `npm audit` reports it as
four entries, because nodemailer 8 now satisfies that peer range and npm can
traverse the edge to `@auth/core`, `@auth/pg-adapter` and `next-auth`; at
7.0.10 the peer mismatch hid it. The entry count rises from 2 to 4 while the
number of real vulnerabilities falls from 8 to 1. The count is the misleading
figure. Neither remaining path is reachable by a visitor: production requires
Resend and never constructs an SMTP transport, and `linkify-it` ships only in
the authenticated `admin` chunk because visitor markdown renders through
`remarkGfmSafe`.

The upgrade also required fixing 18 TypeScript errors across 13 test files.
Those errors were not introduced by it. The same 18 are present on 16.0.10,
confirmed by running `tsc` against both dependency sets and diffing the
normalized error lists. Next 16.0.10's build silently skipped typechecking test
files; 16.3.2 honours `tsconfig`'s `include`, so the build fails until they are
addressed. Every fix is a type annotation — no assertion was weakened and no
`src/` file changed. One was a real defect:
`appearance-logo-upload.test.tsx` omitted the required `templates` prop, so
`AppearanceStepProps` had gained a member without its test being updated.
`npx tsc --noEmit` is now clean for the first time.

Investigating the `linkify-it` chain exposed an untested surface. The
announcement editor's Markdown pipeline had no coverage at all:
`admin-range-locking.test.tsx` mocks the editor out entirely, and
`markdown-guide-legacy-safe.test.tsx` exercises the separate render pipeline.
`tests/markdown-editor-parser.test.tsx` now covers it, bringing the suite to
108 files and 784 tests.

The upgrade also broke `npm run dev` on the iPadOS 15 support floor, in a way
that took some unpicking. Next 16.3 ships a React development build that calls
`eval()` to reconstruct callstacks across the server/client boundary. Modern
engines take another path; older WebKit falls back to eval, and LOTTO's CSP
carried no `'unsafe-eval'`. Safari 15 additionally does not treat `ws:`/`wss:`
as covered by `connect-src 'self'`, so the hot-reload socket was refused. Both
relaxations are gated on `NODE_ENV !== "production"` and the production headers
are unchanged. The failure was silent — no error, rejection, `console.error` or
CSP violation — and presented as the page rendering without ever hydrating, the
same outward signature as Issues 5 and 43 from an unrelated cause.

Because every client chunk is rebuilt by a framework upgrade, a static scan is
not sufficient evidence for the iPadOS 15 support floor. Verification was done
on a simulated iPad mini 4 running iPadOS 15.4 with a custom appearance
applied. The device fetched `/api/auth/session` and two RSC prefetch requests —
both issued only by a hydrated client router — proving hydration completed
rather than merely that the page painted. This was observed through a logging
proxy placed in front of the production server, leaving the application under
test unmodified. `nodemailer` 8.0.11 was separately exercised against a local
SMTP listener using the exact transport options from `auth-email-service.ts`.

---

# LOTTO v1.24.3

**Release Date:** August 26, 2026

LOTTO v1.24.3 completes the security work begun in v1.24.1. Upgrading
`next-auth` to 5.0.0-beta.32 and `@auth/pg-adapter` to 1.11.3 brings
`@auth/core` to 0.41.3 and clears the last three critical advisories.
Production now reports six advisories, none critical, against sixteen — three
of them critical — before v1.24.1.

The upgrade fixes upstream the two weaknesses v1.24.1 had to mitigate in
LOTTO's own code: a non-OK session response now yields no session rather than
an error object, so existence checks fail closed, and email addresses are
normalized with NFKC. Both LOTTO mitigations are retained rather than reverted.
The `proxy.ts` gate requires a populated `session.user`, which is stricter than
the upstream behaviour, and the admin allowlist screens non-ASCII characters on
the raw address before any normalization runs. They are now defense in depth.

The v5 line has been in beta for roughly 1,000 days across 33 releases with no
committed stable date, and the release cadence has been lengthening rather than
converging. That is not a reason to stay on beta.30: v4 does not support the
App Router, so the practical choice was between an older beta carrying three
criticals and a current one that fixes them. `next-auth` therefore remains
pinned exactly, without a caret, enforced by
`tests/security-nextauth-pin.test.ts`.

This release also resolves the `nodemailer` peer-dependency drift observed
during v1.24.1, where `@auth/core` required `^6.8.0` against an installed
7.0.10 and produced an `ERESOLVE` warning on every Vercel build. Both packages
now declare `^7.0.7 || ^8.0.5`.

No client code changed. Forty-seven of the forty-eight built chunks are
byte-identical to v1.24.2 and total chunk bytes are unchanged; the only
difference is the inlined `package.json` metadata carrying the two new version
strings. Sign-in was confirmed rendering and hydrating on a simulated iPad
mini 4 running iPadOS 15.4 with a custom appearance applied, and the stricter
email validation introduced in beta.31 was exercised against the live OTP
route rather than assumed.

---

# LOTTO v1.24.2

**Release Date:** August 25, 2026

LOTTO v1.24.2 is a bug-fix release. Custom appearances did not render on the
declared iPadOS 15 support floor, and only the two hand-authored built-in brands
were exempt.

`oklch()` requires Safari 16.4. Hand-authored brand stylesheets are safe because
the build downlevels them to sRGB for the browserslist floor, but runtime brand
themes are derived per request and injected as an inline `<style>`, so they never
pass through that pipeline. Every OKLCH value was invalid on the deployed iPad
mini 4: card, popover, and modal surfaces rendered transparent, `--border` fell
back to `currentColor` and drew dark outlines around every card, toggle switches
vanished, and modals became unreadable as page content showed through both the
missing surface and the missing backdrop.

`serializeBrandThemeCss` now emits each scope twice — an sRGB baseline, then the
OKLCH values inside `@supports (color: oklch(0 0 0))`. Modern engines take the
richer form; iPadOS 15 keeps the baseline. Colours inside gradients and shadows
are converted in place with alpha preserved, and derived values are unchanged:
only serialization differs.

The release also makes `npm run dev` usable on that floor. iOS 15 Safari refuses
the Next.js hot-reload WebSocket, and because Next constructs it inside an async
bootstrap, the rejection aborted hydration before it began — the app rendered but
never became interactive. A development-only shim keeps the constructor from
throwing; hot reload is unavailable on that engine, nothing else changes, and
production output is byte-identical.

Both defects are recorded in full in `docs/ISSUES.md` as Issues 42 and 43,
including the approaches considered and rejected.

---

# LOTTO v1.24.1

**Release Date:** August 24, 2026

LOTTO v1.24.1 is a security patch. It closes the two exploitable Auth.js
weaknesses in LOTTO's own code rather than waiting on an upstream upgrade, and
removes a development-only tool from the production dependency tree.

`src/proxy.ts` is the single authorization gate in front of every gated API
prefix, and it tested session truthiness alone. Auth.js can resolve `auth()` to
an error-carrying object rather than `null` when the configuration factory
throws, so that check could treat a failed configuration as an authenticated
session. The gate now requires a populated `session.user`.

Admin email authorization now screens for non-ASCII characters on the raw
address before normalizing, and normalizes with NFKC before validating rather
than after. Unicode confusables such as U+FF20 FULLWIDTH COMMERCIAL AT collapse
into a plain `@`, so a check applied after normalization cannot see the
characters it exists to reject.

`react-email` moved to `devDependencies`. It is a preview CLI that no source
file or script imports, and shipping it as a production dependency pulled
`socket.io`, `engine.io`, `ws`, `minimatch`, `ajv`, and `fast-uri` into the
deployed tree. Production advisories fall from 16 to 9.

The release deliberately changes no client-side code. Of the 48 built client
chunks, 47 are byte-identical to v1.24.0; the sole difference is the inlined
`package.json` metadata. Hydration was verified against the deployed build on a
simulated iPad mini 4 running iOS 15.4, matching the declared support floor.

The Next.js and Auth.js package upgrades that clear the remaining advisories
are held for a separate release, because both ship code into the client bundle
and require device verification. See `CHANGELOG.md` for the reasoning on each
deferred item.

---

# LOTTO v1.24.0

**Release Date:** August 24, 2026

LOTTO v1.24.0 translates structured batches of up to 100 related strings in a
single AI-provider request. Responses carry stable row identifiers and must
pass a complete-set validation before any translation is written, preserving
the row-level audit trail while sharply reducing provider and Vercel traffic.

The release also separates a model's technical output ceiling from LOTTO's
operational request budget. Gemini 2.5 Flash-Lite may support a much larger
response, but ordinary LOTTO batches default to an adaptive maximum of 8,192
tokens and can never exceed the application ceiling of 16,384. Malformed
structured output receives one bounded split; provider failures stop without a
retry storm and remain visible for staff recovery.

---

# LOTTO v1.22.3

**Release Date:** August 24, 2026

LOTTO v1.22.3 brings runtime Appearance copy into the client localization
contract. The active custom public service label is now found, translated,
audited, packed, and rendered for every enabled visitor language; administrative
and sign-in copy remains intentionally untranslated.

The Arcade language picker now reads the same enabled-language catalog as Home
and Display. Dynamic languages such as Bosnian are available throughout the
client experience, including when a visitor opens Arcade directly with a saved
selection.

Language preparation is now entirely staff-driven. Enabling a dynamic language
automatically runs the complete missing-translation sweep, and only completed
languages enter client menus. Visitors no longer wait behind a fixed readiness
poller, eliminating an unbounded Vercel/Neon request loop.

---

# LOTTO v1.22.2

**Release Date:** August 24, 2026

LOTTO v1.22.2 completes the hosted asset contract introduced in v1.22.1.
Appearance validation now accepts only LOTTO-managed public Vercel Blob URLs
or the existing local root-relative paths, allowing uploaded logos and install
icons to save without opening configuration to arbitrary remote assets. Upload
controls also use explicit buttons so the first file selection is handled
reliably.

---

# LOTTO v1.22.1

**Release Date:** August 24, 2026

LOTTO v1.22.1 completes hosted Appearance asset persistence with public Vercel
Blob storage while retaining the local filesystem fallback. Valid logos are
inspected from their bytes, stored durably, and remain available to the app,
palette extraction, install metadata, and authentication email across
deployments. Upload failures now follow the ASK contract with a specific cause
and useful next action.

Authentication emails also honor the configured light-logo treatment. An
appearance set to **Dark plate** renders its logo on the configured dark brand
surface in both Magic Link and Verification Code messages.

---

# LOTTO v1.22.0

**Release Date:** August 24, 2026

LOTTO v1.22.0 makes Magic Link authentication viable on systems protected by
Microsoft Defender and similar email-scanning gateways. Callback GETs now show
a branded confirmation page without consuming the single-use credential; only
an explicit staff POST completes the native Auth.js callback.

Magic Link is the default sign-in method and Verification Code remains the
fallback. Both expire in ten minutes, coexist safely through typed verification
rows, enforce the same staff policy, and use one runtime-branded HTML/plain-text
email service for William Temple House, St. Johns, and saved Appearance
configurations. Full details are in `docs/AUTHENTICATION.md` and
`docs/V1.22_AUTHENTICATION_PLAN.md`.

---

# LOTTO v1.21.0

**Release Date:** August 22, 2026

LOTTO v1.21.0 makes operational queue history durable. Ticket issuance,
write-once first calls, batch boundaries, appends, and Random-to-Sequential
transitions are retained in active state and closed immutably when staff reset
for a new day. The closeout path is transactional in Neon and durable-first in
the development file store.

The versioned, bearer-authenticated FEED endpoint delivers only privacy-minimized
session facts in append order. It never emits physical ticket numbers or client
identity. Classification remains FEED's responsibility: source facts always
synchronize, while unusual sessions stay out of Analytics pending staff review.

Deployment and contract details are in `docs/LOTTO_FEED_INTEGRATION.md`.

---

# LOTTO v1.20.1

**Release Date:** July 20, 2026

A patch release fixing severe input lag when editing Announcement copy on
older staff devices (iPad mini 4 class hardware).

The announcement draft was held in the root `/admin` component's state, so
every keystroke re-rendered the entire Admin page — including the Translation
card (which mounts all three of its tabs, not just the visible one), the
Appearance card, the operating-hours and language-rotation editors, and one
dialog per returned/unclaimed ticket. On A8-class hardware this produced
multi-second latency between a keypress and the character appearing. The
development machine is fast enough that the same fan-out is imperceptible,
which is why it survived testing — the same blind spot recorded in Issue 14.

The draft now lives in an isolated, memoized `AnnouncementSection` that
notifies the root only when Save is pressed, and draft persistence to browser
storage is debounced off the keystroke path. Measured sibling re-renders per
keystroke dropped from one-per-character to zero, locked in by
`tests/announcement-input-isolation.test.tsx`. No user-facing behavior changed.

Details in `CHANGELOG.md`, `docs/ISSUES.md` Issue 35, and
`docs/V1.5_OPTIMIZATIONS.md` §2M.

---

# LOTTO v1.20.0

**Release Date:** July 20, 2026

LOTTO v1.20.0 ships database-backed, runtime-configurable branding for every
agency deployment. Staff can create, preview, save, and activate an appearance
configuration from Admin without editing source code. The seven-step wizard
covers identity, logos and generated install icons, a semiotics-aware color
story, staff copy, optional inventory capability, and final review.

The release adds automatic logo-palette recommendations, reserved operational
status-color protection, derived light/dark/Hi-viz themes with contrast
validation and correction, safe vector-logo handling, a configurable public
service heading, and fail-closed resolution back to the compiled William Temple
House or St. Johns profile. Both production Neon databases received the
additive `brand_configurations` table and one-active-row index before rollout.

Custom uploaded brand assets still use the documented filesystem fallback and
are therefore not durable on Vercel until the planned Blob storage integration
ships. Built-in profile/template assets and database-backed appearance settings
are production-ready.

Full implementation details are in `CHANGELOG.md`,
`docs/CONFIGURABLE_BRANDING_PLAN.md`, `docs/COLOR_SEMIOTICS.md`, and
`docs/user-guides/12-appearance.md`.

---

# LOTTO v1.19.0

**Release Date:** July 18, 2026

LOTTO introduced deployment-selected branding from one repository. William
Temple House remained the no-configuration production default while a second
compiled profile proved the identity, metadata, install-asset, public-URL, and
optional-integration boundaries later replaced by configurable Appearance.

This release also separates shared operational status semantics from agency
identity colors, adds additive exact-address and managed-domain staff
authorization for organizations using public email providers, and restructures
core and Arcade palettes around an OKLCH-only CSS authoring standard. Full
details are in `CHANGELOG.md`, `docs/CONFIGURABLE_BRANDING_PLAN.md`, and
`docs/CSS_THEME_ARCHITECTURE.md`.

---

# William Temple House Digital Raffle System v1.17.3

**Release Date:** June 4, 2026

The public navigation now gives the live board a first-class entry point:
**Dashboard** links directly to `/display`, placed between **Your ticket** and
**What's in stock**.

## Dashboard tab in public navigation

- **New destination:** the bottom nav now reads **Your ticket**, **Dashboard**,
  **What's in stock**, and **Games**.
- **Direct board access:** **Dashboard** links to `/display`, the large public
  raffle board.
- **Core icon:** the Dashboard tab uses a native imperative `grip` icon with a
  staggered dot-fade animation.
- **Consistent chrome:** `/display` now renders the same fixed bottom nav as the
  other core public pages, and the core and Arcade bars share the same desktop
  dock offset to avoid jumps between routes.
- **Arcade separation preserved:** the Arcade index mirrors the same four public
  destinations with its own pixel-art dashboard icon and arcade-styled bar.

Design and implementation notes live in `docs/NAVIGATION.md`.

---

# William Temple House Digital Raffle System v1.17.1

**Release Date:** June 4, 2026

A small follow-up to the language-rotation release: the QR code on the public
board now sends people to the app's home screen — where they can choose a
language and find their ticket — instead of back to the board itself. The new
"Rotate display languages" control in Admin was also tidied to match the rest of
the dashboard.

---

# William Temple House Digital Raffle System v1.17.0

**Release Date:** June 4, 2026

The public **Display** board can now greet everyone in their own language. Staff
can turn on **language rotation** and pick which languages the board cycles
through — a polite, inclusive touch for clients who don't read English and can't
tap a passive screen to change it.

## Rotating language mode

- **Set it in Admin.** A new "Rotate display languages" control lets you flip
  rotation on, choose any of the eight supported languages, and set how many
  minutes each one shows.
- **Hands-free on the big screen.** The `/display` board automatically cycles
  through the chosen languages on your timer, smoothly transitioning each change
  and flipping to right-to-left for Arabic and Farsi.
- **Stays out of the way.** Rotation only affects the large-format board — the
  personalized homepage still lets each client pick their own language.

Design and implementation notes live in `docs/DISPLAY_LANGUAGE_ROTATION.md`.

---

# William Temple House Digital Raffle System v1.16.0

**Release Date:** June 3, 2026

The personalized homepage graduates from preview to the **front door**. Opening
the app now greets each guest with the language picker and ticket lookup, while
the live "who's being served" board moves to its own dedicated address.

## Personalized homepage is now the home screen

- **One welcoming entry point.** The language + ticket onboarding (previously the
  `/new` preview) is now what you see at the site root. Returning guests with a
  saved ticket skip straight to their personalized status.
- **The public board lives at `/display`.** The full searchable board is
  unchanged — it just has its own address now. Point lobby and TV displays at
  `/display`.
- **"Your ticket"** in the bottom navigation now takes you to the home screen.

## Easier "just looking"

- The no-ticket option is now a clear, prominent **"I'm just looking"** button,
  and once you've chosen a language you can close the welcome dialog with an
  **X**, the **Escape** key, or by tapping outside it.

Design and implementation notes live in `docs/V2.0_PLANNED_FEATURES.md`.

---

# William Temple House Digital Raffle System v1.12.0

**Release Date:** May 31, 2026

**Zombie Attack!** gets a big gameplay overhaul — it's now a **top-down survival
game** with hand-drawn NES-era sprites, a helicopter rescue you have to defend
across timed rounds, and a special soldier zombie.

## Zombie Attack! — Top-Down Survival

- **New view & art.** The game is now played from above, with detailed,
  multi-colour sprites: four kinds of **civilian zombies** in street clothes, a
  **hero** wielding an Uzi, and a military **helicopter** on a marked helipad.
- **Shamble from above.** Zombies pour in from the top and weave downward toward
  your **bunker line**. Most don't shoot — the danger is the sheer crowd. Hold
  the line; if they overrun the bunkers, the pad falls.
- **Meet Bub.** A zombie **soldier** (a nod to *Day of the Dead*) shows up now and
  then — he takes two shots, fires back with his pistol, and may **drop a live
  grenade** when he falls. Shoot the grenade to blow a hole in the horde.
- **Defend the extraction.** Each game runs as a **timed rescue** in four rounds —
  the chopper flies in, **refuels**, **boards passengers**, and **takes off**.
  Outlast the clock each round to get them out, then a tougher cycle begins.
- **Watch for the ambulance.** A runaway ambulance occasionally barrels through —
  shoot it to set off a blast that clears the zombies around it.
- **Controls & difficulty.** Slide to move, hold **A** to fire your Uzi. Six
  difficulty settings tune the crowd size, speed, and how often Bub appears
  (Nightmare is relentless and removes the sandbag bunkers). Eight languages, and
  still tuned for the 2015 iPad Mini baseline.

Design and implementation notes live in `docs/ZOMBIE_ATTACK.md`.

---

# William Temple House Digital Raffle System v1.11.0

**Release Date:** May 30, 2026

The Arcade's third game gets a full re-theme — *Star Swarm* becomes
**Zombie Attack!**, a last-stand against a shambling horde — along with several
new mechanics, a taller play area, and a streamlined fire control.

## Zombie Attack!

- **New look.** The aliens are now three kinds of **shambling zombies** (skinny,
  ribs-exposed, and fat), crossing a **dirt lot** instead of a starfield. Your gun
  defends a **fence** and four **sandbag bunkers** at the bottom of the screen.
- **The fence.** A wooden fence stands in front of the bunkers. The horde presses
  on it, and the more zombies there are the faster it gives way. When it
  collapses, the horde breaks through — and reaching the bunkers is game over.
- **Carried bombs.** Some zombies carry bombs (marked in red). Shoot a carrier and
  it **drops its bomb**; shoot the dropped bomb to set off a **big blast** that
  clears every zombie nearby — a satisfying chain kill.
- **Flaming truck.** Every so often a **burning truck barrels down** toward the
  fence. It takes several shots to stop (more on harder settings); if it reaches
  the fence, it crashes through and takes the fence with it.
- **Bigger play area.** The board is **25% taller**, so the game fills much more of
  a phone screen with less wasted space up top.
- **Simpler controls.** Firing is now a compact **"A"** button (hold to keep
  shooting), leaving a wider slider for moving — and the on-screen buttons no
  longer accidentally highlight their text while you play.
- **Difficulty twists.** **Nightmare** removes the bunkers entirely (the fence
  still stands); **Very Easy** makes the bunkers bomb-proof so only your own shots
  wear them down. Still six settings, still eight languages, still tuned for the
  2015 iPad Mini baseline.

Design and implementation notes live in `docs/ZOMBIE_ATTACK.md`.

---

# William Temple House Digital Raffle System v1.10.0

**Release Date:** May 29, 2026

The Arcade gets its **third game: Star Swarm** — a fixed-shooter in the classic
Space Invaders lineage, thematically at home next to the Arcade's invader icon.
It joins Snake and Brick Mayhem with the same retro pixel-art look, the same
mobile-first control dock, and the same good-citizen behavior (it pauses the
instant a raffle ticket is called).

## Star Swarm

- **The game.** Pilot a ship along the bottom of the board and clear a
  descending formation of **40 invaders** — five color-tiered rows worth more
  points the higher they sit — before they march down to your level.
- **Hold to fire.** A big **FIRE** button auto-fires while held; a thumb
  **slider** moves the ship. (On a keyboard: ←/→ to move, Space/↑ to shoot.)
- **Shields & saucers.** Four **destructible bunkers** give you cover, a periodic
  **bonus saucer** streaks across the top for 50–300 points, and you can even
  **shoot incoming bombs out of the air**.
- **Endless waves.** Clear the swarm and the next wave drops in, a little lower
  and a little faster. The formation also speeds up as you thin it out — the last
  few invaders are the tense ones.
- **Six difficulty presets** (Very Easy → Nightmare) tune how fast the swarm
  marches and how hard it rains bombs. Lose a life and your ship blinks briefly
  invulnerable so you can recover.
- **Everywhere, in every language.** Fully localized across all eight supported
  languages, theme-aware (light / dark / high-contrast), and tuned to run on the
  2015 iPad Mini performance baseline like the rest of the Arcade.

Design and implementation notes live in `docs/STAR_SWARM.md`.

---

# William Temple House Digital Raffle System v1.9.0

**Release Date:** May 29, 2026

A large, cohesive **UX/UI pass** that makes the whole app feel like one designed
material system — building on the frosted-glass and card-gradient work introduced
in 1.8.0. The headline is a redesigned, color-coded display board for dark mode,
a fully flat high-contrast accessibility theme, and a long tail of polish across
the display, admin, and inventory surfaces.

## Color-Coded Display Board (Dark Mode)

The live board's ticket cells were reworked into a clear, high-contrast color
language so clients can read their status at a glance:

- **Now Serving** — a deep-to-medium **blue** cell with crisp **white** numerals.
- **Called** — **green/teal**, with bright mint numerals.
- **Unclaimed** — **gold**, with vibrant-yellow numerals.
- **Returned** — **red**, with soft-pink numerals.
- The large "NOW SERVING" number at the top of the page is a light **powder blue**.

Every ticket cell, in both light and dark mode, now uses the same bottom→top
gradient direction (deeper at the base, lighter at the top), matching the cards.

## Consistent "Material" Surfaces

- The **ticket-detail popup** (tapping a ticket number) is now frosted glass,
  matching the language-entry dialog — so every modal in the app feels the same.
- All colored fills across the app share one gradient orientation; the
  previously-flat alert fills (returned / unclaimed) gained matching gradients.

## High-Visibility Theme Is Now Fully Flat

The **HI-VIZ** accessibility themes (light and dark), designed for visually
impaired visitors, now render every surface as a **solid, flat color** with no
gradients — maximizing contrast and readability — while still honoring the new
color language.

## Display Board Layout

- The service card was split into two: **FOOD PANTRY SERVICE FOR** (the date) and
  a dedicated **CURRENT TIME** card, fully translated across all eight languages.
- Tightened the spacing on the top stat cards for a cleaner, denser header.
- Right-to-left languages (Persian, Arabic) now align the Current Time card
  correctly, with the clock digits kept in their natural left-to-right order.

## Admin & Inventory Polish

- **Admin (dark mode):** the "mark ticket as returned/unclaimed" inputs now match
  the other admin fields; the returned/unclaimed titles and number badges use the
  new high-contrast colors; and the **Next up** panel gained its gradient and a
  legible mint title.
- **Inventory:** the language and theme controls now stay in place (Language-left,
  Theme-right) in right-to-left languages, matching every other page.

## Versioning

- Bumped application version to **1.9.0**.

---

# William Temple House Digital Raffle System v1.7.0

**Release Date:** May 26, 2026

## Persistent Navigation Bar

Introduced a single, consistent navigation system across the three client-facing surfaces, replacing the previous ad-hoc button clusters.

- A persistent bottom tab bar with three destinations: **Your ticket** (`/new`), **What's in stock** (`/inventory`), and **Games** (`/arcade`).
- Two presentations from one model: a floating capsule dock on desktop and a full-width, blurred bar on mobile, with the active destination highlighted.
- Animated line-icons on the core bar (ticket "rip", cart hop, gamepad wiggle) with a `prefers-reduced-motion` guard; a separate **pixel-art arcade-styled variant** on the arcade index so the retro section keeps its own look.
- Removed the now-redundant controls: the `/inventory` and `/arcade` BACK buttons and the inventory/games links in the `/new` ticket-card cluster. Game pages keep their own Back control.

## Inventory Page Refinements

- Condensed the dietary filters into a single multi-select dropdown — each option shows its dietary icon, selections combine, and the trigger uses an animated `package-check` icon.
- Fixed poor contrast on the inventory count pills: the `secondary` palette token is now an adaptive neutral (light gray/dark text in light mode, dark gray/light text in dark mode), meeting WCAG AA in both themes.

## Friendlier Ticket Entry on `/new`

- Clients holding a physical ticket can now enter and save it **before the operator starts the drawing** — submission is no longer blocked; the personalized view shows a calm "not in the drawing yet — check back soon" holding state instead of an error.
- Added an explicit **"I don't have a ticket — just browsing"** option that opens the page directly.
- The **"Enter a new ticket number"** action now also appears in the "Pantry Has Closed For The Day" state, matching the active-drawing state.
- Simplified client-side ticket persistence to a flat 8-hour window from entry time, while still clearing tickets from a superseded drawing.

## Full Multilingual Support for the Ticket Modal

- The `/new` onboarding modal's title, ticket-format hint, pre-drawing reassurance, and "just browsing" action now render in the selected language across all eight supported languages.
- Fixed non-English navigation-bar labels (e.g. Russian "Что есть в наличии") rendering off-center — long labels now wrap centered with readable line spacing and keep their icons aligned.

## Display QR Code Fix

- The public display's QR code now follows the admin-configured display URL **live**: changing the URL in `/admin` updates the on-screen QR on the next refresh without a reload. Previously the display kept the default URL because it only read the URL once on load.

## Versioning

- Bumped application version to **1.7.0**.

---

# William Temple House Digital Raffle System v1.6.3

**Release Date:** April 16, 2026

## ASK-Compliant Session Expiry Toast

Replaced the cryptic one-word `Unauthorized` toast that appeared when a staff member's admin JWT expired mid-session with an Actionable, Specific, and Kind message that matches the error-copy standard documented in `docs/SECURITY.md`.

- Added `src/lib/session-expired.ts` exposing `SESSION_EXPIRED_MESSAGE`, `SessionExpiredError`, and `showSessionExpiredToast()`.
- New toast copy: **"Your sign-in expired. Sign back in to keep working."** with an inline `Sign in` action button that navigates to `/login?callbackUrl=<current-admin-path>` so staff land back on the same admin surface after re-auth.
- `/admin` action dispatchers (legacy + optimistic) and `/api/state/cleanup` handler now detect 401 responses and surface the new toast instead of echoing the raw HTTP status token.
- Added `tests/admin-session-expired.test.tsx` to guard the regression path.
- Documented the ASK violation and fix in `docs/ISSUES.md` as Issue 18; logged the change in `CHANGELOG.md`.

## Versioning

- Bumped application version to **1.6.3**.

---

# William Temple House Digital Raffle System v1.6.2

**Release Date:** March 5, 2026

## Haptic Feedback for Arcade

Added tactile haptic feedback via the `web-haptics` library across all arcade interactions. Haptics are scoped exclusively to arcade routes and do not affect any raffle or admin surfaces.

- **Ticket called:** A `buzz` pattern fires when a tracked ticket is called, complementing the existing confetti and visual overlay.
- **Brick Mayhem gameplay:** `error` on brick destruction (throttled for multiball), `light` on paddle bounce, `error` on ball lost and game over.
- **Snake gameplay:** `success` on pellet eaten, `error` on collision/game over.
- **Arcade buttons:** `heavy` pattern on every arcade button press (suppressed when disabled).

Platform support: Android Chrome/Firefox and iOS26 Safari. Graceful no-op on unsupported platforms.

## Engine Enhancement

Added `paddleBounced: boolean` to the Brick Mayhem `TickResult` type so page-level haptic hooks can observe paddle contact without coupling haptics into the pure-function engine.

## Versioning

- Bumped application version to **1.6.2**.

---

# William Temple House Digital Raffle System v1.5.0

**Release Date:** February 18, 2026

## Homepage and Route Preview

- Public board is now served from `/`, with `/display` kept live as a non-redirecting alias for operational continuity.
- Added `/new` as the preview personalized homepage experience; this route is the candidate to be promoted as the default homepage in a future release.

## Arcade Preview Scope

- v1.5.0 includes an Arcade preview with one playable game: **Snake** (`/arcade/snake`).
- Arcade remains intentionally scoped as a preview surface while broader v2.0 personalization work continues.

## Versioning

- Bumped application version to **1.5.0**.

---

# William Temple House Digital Raffle System v1.4.3

**Release Date:** February 13, 2026

## Theme Transition Effect (Animate UI Parity)

- Added a local Animate UI-style `ThemeToggler` primitive (`src/components/animate-ui/primitives/effects/theme-toggler.tsx`) that applies directional View Transition `clip-path` reveals for base theme changes (`light`, `dark`, `system`).
- Wired the existing theme dropdown (`src/components/theme-switcher.tsx`) to route base theme updates through the new transition primitive while preserving the existing `Hi-viz` contrast mode behavior.
- Added reduced-motion and no-View-Transition fallback handling so theme changes remain immediate and reliable when animation is unavailable or disabled.

## Validation

- Added a `ThemeSwitcher` test that verifies `document.startViewTransition` usage when available.
- Full test suite passing: **125 tests**.
- Production build completed successfully.

## Versioning

- Bumped application version to **1.4.3**.

---

# William Temple House Digital Raffle System v1.4.2

**Release Date:** February 13, 2026

## Batch Range Integrity

- Locked `startNumber` after the first successful draw so staff cannot silently drift the starting bound mid-process.
- Allowed `endNumber` to move only forward during active batching; shrink attempts are rejected with concrete ASK messaging that includes the current bound.
- Enforced atomic `generateBatch` expansion: expanded `endNumber` persists only when the draw succeeds.
- Restricted Append while undrawn tickets remain in the active range to preserve first-in fairness for pending tickets.

## Reliability Fixes

- Added typed user-input error handling in `/api/state` so actionable business-rule errors return HTTP 400 (instead of generic 500).
- Fixed login tab hydration mismatches by using deterministic tab trigger/content IDs and ARIA pairings.
- Fixed login tab edge artifacts from adjacent pane effects in animated tabs.
- Removed animated blur from morph text paths to improve frame consistency on low-power Chromium clients.

## Versioning

- Bumped application version to **1.4.2**.

---

# William Temple House Digital Raffle System v1.4.1

**Release Date:** February 11, 2026

## Motion Expansion (Animate UI)

- Expanded motion behavior across key controls and indicators: animated buttons, icon triggers, pending/live-state feedback, and staggered display card/queue entrances.
- Reworked animated tabs to demo-parity behavior (horizontal track + auto-height + trigger tap scale), including login flow integration.
- Added parity hardening across icon motion triggers and admin icon behavior to keep interaction feedback consistent.

## Display Readability and Localization Motion

- Migrated display "Now Serving" transitions to Animate UI primitives (`MorphingText` + numeric `RollingText`) with tuned timing/stagger for readability.
- Added `LanguageMorphText` across translated labels/messages and enabled word-aware wrapping to prevent orphan characters in localized strings.

## Versioning

- Bumped application version to **1.4.1**.

---

# William Temple House Digital Raffle System v1.4.0

**Release Date:** February 11, 2026

## High-Contrast Accessibility Theme

- Added persisted `Hi-viz` contrast mode alongside Light/Dark/System.
- Introduced contrast-aware theme architecture in `ThemeProvider` with root-class sync for token-based overrides.
- Added and refined high-contrast token sets in `globals.css` (including typography/token mapping updates).

## Motion Foundation

- Added motion primitives and animated icon integration foundation for the app UI.
- Added global `prefers-reduced-motion` support so motion is disabled/simplified when requested.
- Updated theme and header controls to use iconized, motion-capable interactions while preserving accessibility and clarity.

## Additional Core Improvements Included in v1.4.0

- Hardened local auth/dev reliability (trust-host handling, OTP fallback behavior, localhost bypass behavior in dev).
- Updated admin status card styling and token alignment for clearer returned/unclaimed/next-up state visibility.

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
