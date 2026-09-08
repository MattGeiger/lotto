# Changelog

## [Unreleased]

### Fixed

- **Let a freshly migrated database serve public state reads.** The additive
  realtime migration defaults `raffle_state.revision` to 0 on existing rows, and
  only a write allocates a positive revision, so a migrated deployment sits at 0
  from the moment the schema is applied until the first staff action. The read
  path rejected anything below 1, so every `/api/state` request returned 500 in
  exactly that window — which is what happened on the production v2.0.0-rc.3
  cutover, until the row was advanced to 1 by hand. Revision 0 is now accepted as
  the legitimate pre-write state; negative and unparseable values still throw.
  `readPolledStateRevision` already ignored 0, so realtime stays inert and
  clients keep polling until a write establishes revision authority. Beta never
  exposed this because its database was created fresh and written to immediately.

## [2.0.0-rc.3] - 2026-09-07

The first build intended to run on `williamtemple.app` itself, on the existing
personal Hobby account. The organization's Vercel Pro migration remains pending
approval and is unchanged as the eventual destination; this deployment is a
validation step toward it.

### Changed

- **Separated realtime eligibility from the beta sandbox marker.** Realtime
  previously activated only when `LOTTO_DEPLOYMENT_ENVIRONMENT=beta`, and that
  same value drives the "Beta test environment" banner, the blocking
  `robots.txt`, and the `X-Robots-Tag` header. Production therefore could not
  enable realtime without de-indexing the live site and telling every client
  their actions do not affect the real app. `isRealtimeEligibleDeployment` now
  accepts `beta` or `production`, while `isBetaDeployment` — and every sandbox
  behavior it drives — still requires exactly `beta`. The gate remains
  fail-closed: unset, empty, and near-miss values (`prod`, `Production`,
  `staging`) refuse realtime, so being merely "not beta" is never sufficient.
  New coverage asserts that production gets realtime and no sandbox behavior,
  and that near-miss values stay refused.
- **Added a production environment to the realtime Worker.** A named
  `production` environment deploys as `lotto-realtime-production` with its own
  Durable Object namespace, allowlisting only `https://williamtemple.app`. No
  beta namespace, secret, origin, or state is reused, per the v2.0 plan.
  `npm run realtime:check:production` and `npm run realtime:deploy:production`
  drive it; publish and control tokens must be generated fresh per environment.
- **Widened the three remaining beta-only realtime gates.** The client CSP in
  `next.config.ts` was the consequential one: with it gated on beta alone, a
  production build with realtime enabled threw at build time, and had it not
  thrown the `connect-src` would have omitted the hub origin and every browser
  would have refused the WebSocket. The Admin realtime diagnostics page and its
  API were also beta-only; both are administrator-authenticated, and they are
  what step 5 of the cutover uses to confirm a publication landed. The indexing
  headers in `next.config.ts` remain beta-only, alongside the banner and
  `robots.txt`. New coverage asserts the production CSP contains the hub origin,
  that an ineligible environment refuses to build a realtime CSP, and that the
  diagnostics API is reachable in production but still demands an administrator
  session.
- **Allowed the protocol verifier to target production explicitly.**
  `REALTIME_TEST_ALLOW_REMOTE=production` is a second deliberate opt-in
  alongside `beta`. Verification runs against the synthetic
  `william-temple-house-e2e` agency, so it never writes to the live agency's
  Durable Object.

- **Gave Help a persistent banner carrying Back, search, and the theme
  switcher.** Both Help pages now open with a sticky `HelpTopBar` that stays at
  the top of the screen while the guide scrolls behind it under a translucent
  blur, so navigation, search, and appearance stay reachable anywhere in a long
  guide instead of only at the top. This adopts the pattern FEED uses for its
  Analytics banner, and reuses the glass treatment LOTTO already ships on the
  desktop table of contents rather than introducing a second recipe. The theme
  switcher is new to Help; it matches the single-button Light → Dark → Hi-viz
  control on Home, Display, What's in Stock, and the Staff Dashboard. The
  banner wraps to two rows on a phone and one row from `sm` up. The desktop
  table of contents now sticks at `top-24` to clear it.
  `tests/help-page-navigation.test.tsx` covers the theme control on both page
  types.
- **Reordered the Brick Mayhem control dock.** The paddle slider now sits above
  the Start/Pause button rather than below it, putting the continuously used
  control within easy thumb reach and the occasional one furthest from the play
  area.
- **Gave Help screenshots a single sizing rule and the machinery to hold it.**
  A Help screenshot now renders at 1× its captured CSS size, capped by the guide
  column, instead of every image being stretched to fill that column. Phone
  captures were the visible casualty: a 375-point screen was displayed at 815 CSS
  pixels — 2.17× life size, nearly two viewport-heights of scroll per image —
  while desktop captures in the same guide appeared at 0.64× theirs, a 3.4×
  inconsistency between two images stacked in one article. Phone captures now
  render at 375 × 810, 81% less area, and the Arcade guide is 35% shorter. The
  four phone surfaces (client ticket, themes, Arcade menu, Arcade gameplay) were
  recaptured at 2× rather than 3×, which is a clean retina asset for a 375-point
  slot and cuts those eight files from roughly 460 KB to 300 KB.
- **Made the capture geometry a generated contract rather than a convention.**
  `npm run screenshots` now writes `src/lib/help-screenshot-manifest.ts` from the
  capture configuration plus the dimensions of the stored assets, on every run
  including a bounded `SCREENSHOT_NAMES` one, so a partial refresh cannot leave
  it half-stale. The markdown renderer reads it to size each image and to emit
  intrinsic `width`/`height`, which also removes the layout shift that lazily
  loaded screenshots previously caused across all 54 Help assets. The
  asset-integrity test now fails on an image missing from the manifest, on
  manifest-versus-asset dimension drift, and on a phone capture that is not a
  375-point surface at 2×. `docs/HELP_SYSTEM.md` documents the rule, the
  `w-full` requirement that keeps a capped image from overflowing a narrow
  column, and the fact that `SCREENSHOT_NAMES` also matches same-named README
  shots.

- **Completed the production-facing Help screenshot pass.** Getting Started now
  illustrates all three primary surfaces; Staff Controls adds ticket-status
  reversion, FEED pairing, and Advanced-section references; client and Arcade
  captures use an iPhone-sized portrait viewport; language themes, active
  gameplay, AI configuration, translation management, and every Appearance
  wizard step now have visual references. Announcement workflow and Markdown
  formatting are consolidated into one guide, and architecture-test language
  has been removed from public Help ahead of the v2.0 production release.
- **Reframed the GitHub project page around the complete v2.0 workflow.** The
  README now pairs the personalized client experience with the Staff Dashboard,
  retains the large-format Display, groups administrative and optional
  surfaces more efficiently, and identifies the Neon-authoritative Cloudflare
  realtime candidate without claiming that production cutover has occurred.
- **Added screenshot-led Help across 11 of 12 staff guides.** New deterministic
  light/dark WebP image pairs cover staff controls, Display, personalized tickets,
  Inventory, RTL language behavior, Arcade, Verification Code sign-in,
  Announcements, Translation, and Appearance. Redundant visual description was
  shortened while searchable procedures, warnings, and accessibility context
  remain in text. The Markdown syntax reference intentionally stays text-first.
- **Expanded screenshot automation and integrity checks.** `npm run screenshots`
  now produces README assets plus theme-aware Help assets, supports bounded
  `SCREENSHOT_NAMES` runs, and the test suite verifies that every referenced
  Help image and required dark-mode sibling exists.

### Added

- **Documented the production cutover.** `docs/PRODUCTION_RC3_CUTOVER.md`
  records the ordering that matters — `raffle_state.revision` is written on
  every mutation, so production Neon must be migrated *before* this build is
  deployed — plus staged realtime enablement, three rollback levers, and the
  known caveats: the Vercel application gate has never been live-toggled, there
  is no generated-hostname rehearsal when deploying into the project that
  already serves the apex, and the stable v2.0 gates remain open.

## [2.0.0-rc.2] - 2026-09-03

This beta release candidate activates the proven realtime/fallback controller
on the four ordinary beta public URLs. Production, `main`, and
`williamtemple.app` remain unchanged.

The deployed beta validation connected all four ordinary public surfaces at
revision `91`, passed the polling-only and observer controls, forced a live
Cloudflare drain into adaptive polling fallback, automatically recovered after
resume, and connected the parameter-free Display on the iOS 15.4 simulator.

### Added

- **Added complementary realtime emergency controls.** A server-only
  `LOTTO_REALTIME_APPLICATION_ENABLED=false` gate overrides all rendered
  realtime connections for newly loaded pages, including the diagnostic
  observer, while an independently authenticated Cloudflare
  control durably drains or resumes one agency's existing Durable Object
  sockets. Draining rejects new event connections but continues accepting
  publications and retaining the newest state. The operator-only
  `realtime:control` command requires an exact mode, agency, and hostname
  confirmation for remote use; its credential is separate from the Vercel-held
  publication token. Local end-to-end verification covers wrong-token refusal,
  connected-client drain, connection refusal, publication while drained,
  persisted status, resume, and latest-state delivery.

### Changed

- **Made realtime the ordinary beta default.** Home, Display, Inventory, and
  Arcade now select the source controller without requiring a query parameter
  when the beta deployment gates are enabled. `?realtime=poll` opens no
  realtime socket and retains the existing adaptive polling path;
  `?realtime=observe` remains the non-rendering diagnostic, and
  `?realtime=source` remains a compatibility alias. Unknown realtime values
  fail closed to polling.
- **Preserved the full adaptive schedule across realtime fallback.** Home,
  Display, Inventory, and Arcade now feed polled and pushed state through one
  activity clock. A later fallback retains the post-change burst when
  appropriate but respects long-idle and off-hours backoff when the latest
  pushed state has been quiet; WebSocket reconnects cannot reset that history.
- **Recorded the William Temple House v2.0 production migration decision.** A
  new project in the consulting business's existing Vercel Pro account will be
  validated before Cloudflare routes `williamtemple.app` to it. The earliest
  preferred attended cutover window is September 3, 2026 after 2:30 PM Pacific.
  The Hobby beta account/project and prior production deployment remain intact
  through the cutover and rollback checkpoint and are retired only after
  explicit acceptance.

## [2.0.0-rc.1] - 2026-09-02

This beta release-candidate marker identifies the completed opt-in realtime
source proof and the documented production-test plan. It does not yet activate
realtime on ordinary public URLs: those URLs retain adaptive polling unless the
exact `?realtime=source` cohort is selected. Production, `main`, and the apex
domain remain unchanged.

### Added

- **Implemented the isolated-beta Phase 5 realtime-source canary.** The exact
  `?realtime=source` cohort and independent
  `LOTTO_REALTIME_SOURCE_CANARY=true` beta flag allow Home, Display, Inventory,
  and Arcade to render the checksummed Durable Object public projection only
  after an exact Neon revision/checksum handshake. Each surface retains its
  existing adaptive poller, suppresses only scheduled reads while realtime is
  healthy, and immediately polls on close, timeout, invalid data, revision
  gap/conflict, network loss, or foreground resync. Reconnects are bounded with
  jitter, hidden tabs suspend work, and a beta badge reports live versus
  fallback state. New deterministic coverage verifies the independent gates,
  direct next-revision application, tamper/gap fallback, visibility recovery,
  zero healthy-state scheduled reads, and immediate fallback reads. The source
  is now deployed only to the exact beta cohort: all four public surfaces
  advanced directly from revision `83` to `84`; a 40-second healthy window made
  zero requests; and a tab-local outage made one immediate fallback read plus
  one recovery read. The iOS 15.4 simulator exposed a stale
  `navigator.onLine` hint, prompting an event-driven compatibility fix; it then
  reached `live · r84`, survived background/foreground, and received revision
  `85`. Ten representative service days, provider-level fault/cost drills, and
  physical-iPad validation remain Phase 5 gates.

- **Documented LOTTO's database usage costs and public-read architecture
  options.** `USAGE_COSTS.md` models Neon compute, storage, history, and network
  billing against the live polling strategy; inventories adjacent public-path
  database reads; evaluates tagged CDN responses, Vercel Blob, managed caches,
  realtime delivery, polling changes, and full migration; and records the
  provisional Neon-authoritative Cloudflare Durable Object hub direction while
  retaining CDN, Blob, and current polling as fallback decisions.
- **Added the gated v2.0 realtime architecture proof plan.**
  `docs/V2.0_REALTIME_ARCHITECTURE_PLAN.md` defines architectural invariants,
  public revision and publication semantics, security and rollback controls,
  measurable service objectives, a full testing matrix, eight pre-release
  phases from baseline through release hardening, and a post-release observation
  phase. The plan uses a separately provisioned `beta.williamtemple.app`
  Vercel/Neon/Blob/Cloudflare stack so production remains intact throughout the
  proof.
- **Started the isolated v2.0 realtime proof implementation.** A standalone
  `lotto-realtime-beta` Cloudflare Worker now provides one SQLite-backed Durable
  Object per agency, authenticated checksummed publication, monotonic revision
  enforcement, latest-state reads, and hibernatable subscribe-only WebSockets.
  The shared protocol strictly excludes internal queue-session evidence, and
  unit plus local end-to-end verification cover authentication, CORS,
  idempotency, conflicts, snapshots, and live delivery. No Neon or public-client
  path uses the Worker yet.
- **Deployed and remotely verified the standalone Cloudflare proof.** The
  isolated `lotto-realtime-beta` Worker is live on its dedicated `workers.dev`
  hostname with a SQLite-backed Durable Object migration, Cloudflare-stored
  publish secret, explicit beta-origin allowlist, observability, and hash-based
  preview URLs disabled. Remote synthetic checks pass health, bearer auth,
  snapshot, WebSocket, idempotency, monotonicity, and CORS behavior. This proves
  the basic transport path. A new bounded load harness then delivered every
  target revision across 1, 10, 100, and 200 simultaneous-client groups (311
  total connections); repeat/stress, hibernation/wake, fault, measurement, and
  legacy-device Phase 2 gates remain open.
- **Added a beta-only polling-versus-realtime benchmark.** Equal synthetic
  cohorts now observe the same checksummed Durable Object revisions while the
  runner measures p50/p95/p99 delivery latency, connection latency, convergence,
  and recurring snapshot reads. It enforces client, publication, timeout, and
  duration caps; requires both an explicit beta acknowledgement and exact beta
  hostname for remote use; writes timestamped gitignored JSON reports; and exits
  nonzero when correctness or latency gates fail. Focused tests cover the
  production-host refusal, workload limits, percentile reporting, and projected
  polling reads. The first local 10-client/five-publication run delivered all
  50 observations per cohort with realtime p95 5.63 ms versus polling p95
  997.18 ms at the synthetic one-second cadence; this is transport evidence,
  not yet a Neon-compute claim. The matching remote beta run delivered all 50
  observations with realtime p95 78.58 ms versus polling p95 996.95 ms. A
  separate five-client object survived a 60-second request-free idle window and
  delivered the next revision to every socket at 88.16 ms p95; Cloudflare
  metrics must still confirm actual Durable Object hibernation.
- **Provisioned the first production-shaped beta application boundary.** The
  separate `wth_apps/lotto-beta` Vercel project tracks only
  `codex/v2-realtime-beta` and successfully deployed without
  changing `main` or the live WTH project. Its isolated Portland Neon resource,
  `neon-copper-queen`, received all canonical `schema.sql` statements and all
  15 expected tables were verified. The generated beta URL and Neon-backed
  `/api/state` pass initial smoke tests. A separate public Portland Blob store,
  `lotto-beta-blob`, is connected only to the beta project. A new sending-only
  `LOTTO Beta` Resend key is restricted to `williamtemple.app`, stored only as
  a beta Vercel Production secret, and proven through a delivered Magic Link
  that established an authenticated beta Admin session. Resend domain/account
  migration remains deferred because the verified
  domain also serves live LOTTO and the separately hosted FEED application;
  `https://beta.williamtemple.app` is now a DNS-only Cloudflare CNAME assigned
  to the beta Vercel project with `AUTH_URL` and Auth.js callbacks on that
  origin. The custom-origin Magic Link completed successfully, and the prior
  generated-host session did not cross to the custom hostname. The apex,
  `www`, `feed`, live LOTTO project, and `main` remain unchanged.
- **Prepared Phase 3 atomic revision and shadow publication.** The canonical
  schema now adds a monotonic `raffle_state.revision` and a bounded
  `raffle_public_state_publications` outbox. When the beta-only flag is enabled,
  the central state transaction writes the strict checksummed public projection
  with the authoritative mutation, then makes at most one timeout-bounded
  post-commit request to the exact beta Worker host. Cloudflare or evidence
  update failures cannot reject a committed staff action. Internal diagnostics
  expose metadata only, while explicit recovery validates and retries just the
  newest pending/failed full state with its original idempotency identity.
  Network error details are redacted, public polling is unchanged, the flag
  defaults off. The additive schema is now applied and metadata-verified on the
  isolated beta Neon database. The integrating code is deployed only to beta:
  a flag-off authenticated write advanced the authoritative revision with an
  empty outbox, then a flag-on write produced matching Neon/outbox revision `3`,
  one accepted attempt with no error, and the identical checksum in the Durable
  Object snapshot. Public clients still use `/api/state`; the remaining action,
  failure/repair, WebSocket-canary, and legacy-device gates are open.
- **Automated the Phase 3 persisted-mutation contract matrix.** The new
  `realtime:shadow:check` command runs protocol, safety-configuration, timeout,
  redaction, repair, diagnostics, and database integration coverage. A
  parameterized matrix proves 22 generate/range/serving/status/history/config
  variants each create the atomic outbox intent, make exactly one post-commit
  request, record acceptance, exclude internal queue-session evidence, and
  recompute to the emitted checksum. The first run passed 100 focused tests;
  the full suite passed 874 tests with one expected fixture skipped.
- **Completed the first authenticated live beta mutation matrix.** Generation,
  serving next/next/previous, Returned, Unclaimed, status reversion, undo, redo,
  snapshot restore, and reset advanced isolated beta revisions `3` through
  `14`. All 11 publication rows were accepted on their first attempt with zero
  non-accepted rows, and every Durable Object revision/checksum matched Neon.
  The final reset returned beta `/api/state` to an empty HTTP-200 state, matched
  hub revision `14`, and created one immutable session closeout. Production and
  `main` remained unchanged; append/range/batch/config and injected
  failure/repair gates remain.
- **Added a beta-only realtime publication diagnostic and repair surface.**
  Authorized administrators can open `/admin/realtime` to inspect only the
  newest outbox metadata and issue one explicit newest-state retry. The route
  fails closed outside beta, rechecks the administrator allowlist at the data
  boundary, never returns the public payload or publish secret, and uses
  `no-store` responses. The client performs one initial read with no polling;
  status refresh and repair are user-driven and have request-count regression
  coverage. The Phase 3 shadow check now includes the endpoint and UI contract.
- **Proved production-shaped hub failure and repair on isolated beta.** A
  deliberate beta publish-token mismatch let an authenticated staff write
  commit Neon revision `15` while the outbox recorded a redacted HTTP 401 after
  one attempt and the Durable Object correctly remained at revision `14`.
  After synchronizing only the beta Cloudflare and Vercel secrets, the explicit
  newest-only repair preserved the original publication ID, reached accepted
  status at attempt `2`, and converged the hub to revision `15` with the
  matching checksum. Production, `main`, and live credentials were untouched.
- **Added the first Phase 4 dual-read browser canary.** Home and Display can now
  opt into one beta-only native WebSocket with `?realtime=observe` while their
  existing adaptive `/api/state` polling remains the sole rendered authority.
  The observer validates the strict public envelope, agency ID, and recomputed
  checksum, compares it with the already-polled projection without another
  fetch, pauses while hidden, and stops after five bounded reconnects. A small
  diagnostic badge and in-memory event expose payload agreement and latency to
  testers without recording identity or payload data. The server flag fails
  closed outside beta, and CSP admits only the exact configured Worker host.
  Focused tests cover gating, tamper rejection, zero observer fetches,
  single-socket lifecycle, visibility, retry limits, and configuration
  forwarding; the full suite, production build, legacy scan, and hydration
  smoke pass. The observer is now deployed only to the explicit beta cohort. A
  harmless authenticated configuration save produced live revision `16`: the
  WebSocket delivered it in `127 ms`, reported hub-ahead while polling still
  held revision `15`, and matched the refreshed authoritative projection in
  `1,221 ms` with zero reconnects. That first convergence value remained fixed
  through later refreshes, and the Admin diagnostic recorded accepted attempt
  `1`. The next additive slice extends the same observer to Inventory's existing
  ticket-celebration poll and Arcade's existing Now Serving poll without adding
  request loops. `/api/state` now returns the authoritative Neon revision in a
  response header from the same database query, allowing exact revision plus
  checksum comparison and an explicit polling-ahead diagnostic. Pushed state is
  not rendered and no polling has been removed.

### Changed

- **Planned the `v2.0.0-rc.1` beta-default realtime validation and production
  cutover.** The architecture plan now makes the realtime/fallback controller
  the intended default for ordinary Home, Display, Inventory, and Arcade beta
  URLs while preserving a polling-only control, automatic fallback, and a
  deployment kill switch. It records the exact production-resource isolation,
  generated-hostname verification, apex-domain cutover, rollback, and lean
  launch-monitoring sequence. The accompanying Vercel usage review finds that
  healthy direct-to-Cloudflare WebSockets should reduce Vercel Edge Requests,
  Function invocations, Function resource use, and origin transfer rather than
  move the former Neon polling load into Vercel; it also records Vercel Pro or
  written provider approval as a prerequisite for production use under the
  current Hobby fair-use terms. This is planning only: ordinary beta URLs still
  poll unless explicitly placed in the source cohort.
- **Added explicit beta-environment safety cues.** Deployments marked with
  `LOTTO_DEPLOYMENT_ENVIRONMENT=beta` now send a site-wide
  `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` header, disallow all
  crawling in `robots.txt`, and show a gold warning banner on staff sign-in,
  Magic Link confirmation, and Admin surfaces. Production omits all three
  behaviors unless it is deliberately given the beta marker. The Staff Controls
  guide now explains how testers distinguish beta from the live dashboard.
- **Reserved v2.0 for the provisional realtime public-state architecture.**
  `docs/V2.0_PLANNED_FEATURES.md` now makes the Durable Object proof—not Pantry
  Time—the major-version gate; `docs/POLLING.md` preserves adaptive polling as
  the current implementation and required fallback; and `docs/DEPLOYMENT.md`
  records the isolated beta-environment requirements without presenting them as
  already provisioned.

### Fixed

- **Public service dates now hydrate deterministically in the pantry
  timezone.** Phase 4 browser observation exposed a pre-existing UTC/Pacific
  text mismatch: Vercel could prerender the next calendar day while a West
  Coast display rendered the current day, causing React to regenerate the
  display tree. The clock now starts from one deterministic placeholder,
  resolves immediately after mount, and formats the date using the persisted
  pantry timezone. A UTC-boundary regression covers the reported case. Fresh
  canary and control pages on the repaired beta deployment logged no hydration
  error, and the iOS 15.4 simulator passed a second background/foreground
  cycle while remaining at an exact realtime/Neon revision match.

## [1.26.0] - 2026-08-30

This stable release promotes the Appearance and cross-device work developed in
1.26.0-beta.1 and beta.2. The detailed beta entries remain below as the
implementation record.

### Added

- **Admin now includes a live Appearance preview card.** Beside the saved
  configuration list, staff can see the active logo, Now Serving, Served, Next
  Up, primary action, ordinary card surface, and protected Unclaimed/Returned
  treatments. It consumes the live semantic tokens, so built-in and custom
  appearances and the current Light/Dark/Hi-viz mode stay in sync.
- **Added the v1.30 Arcade candidate plan.**
  `docs/V1.30_PLANNED_FEATURES.md` reviews public-domain and traditional game
  concepts, distinguishes unprotected mechanics from protected expression and
  branding, defines candidate and exclusion lists, and sets architecture,
  accessibility, localization, legacy-device, and release gates.

### Changed

- **Hi-viz now uses the regular application typesetting.** Both high-visibility
  scopes inherit their corresponding light/dark font family, size, weight,
  spacing, line-height, and hierarchy instead of switching to a separate Open
  Sans/Bodoni Moda SC/IBM Plex Mono stack. The unused font payloads were removed;
  Hi-viz contrast colors and flat-material behavior are unchanged.
- **Admin Live State metrics now share the Draw position gradient.** Range,
  Tickets issued, Current mode, Now serving, Max wait time, Tickets called, and
  People waiting consume the same semantic `--gradient-card-info` surface as
  Draw position. A shared class linkage and regression keep all eight cards in
  sync across the built-in WTH appearance and runtime custom appearances.
- **Release documentation and project presentation now describe the current
  application.** README feature language covers the 59-language-ready catalog,
  Tailwind v4 Appearance workflow, current Arcade availability, and v1.30
  roadmap. Project and Help screenshots were regenerated from the final WTH
  appearance.
- **Arcade planning documents now match the code.** Snake is documented as a
  shipped page-local engine with extraction/testing debt rather than an
  incomplete game, and the old Pantry Time "clone" wording now requires an
  original implementation plus the v1.30 prototype/IP-expression review.

### Fixed

- **Custom light appearances now render Next up as a true gradient.** The
  configured `--ticket-serving` value previously repeated one color at both
  stops, producing a visually solid card. It now uses the compiled WTH
  bottom-to-top serving ramp, validates text against both stops, and preserves
  intentionally flat Hi-viz plus canonical red/gold status treatments.
- **All blocking modal overlays now blur the page behind them.** AlertDialog
  joins Dialog and Sheet on the shared frosted overlay treatment, fixing Admin
  confirmations such as Clear draw position and Confirm Lottery Reset.

### Tests

- Added focused regressions for the AlertDialog blur contract and the live
  Appearance preview's identity, queue, primary-action, and protected-status
  samples.
- Release verification passes: lint is clean; 121 test files run 821 passing
  tests with the expected production-only bundle fixture skipped; the Next.js
  production build succeeds; all 42 production chunks pass the legacy syntax
  scan; and `/` plus `/login` pass the production hydration/interactivity
  smoke. The build tree and local server were removed afterward.

## [1.26.0-beta.2] - 2026-08-30

### Added

- **FEED's development-only palette calibration tool is now available in
  LOTTO.** The right-side sheet keeps the live page visible while developers
  adjust compiled light/dark CSS roles against Tailwind v4 candidates, filter
  and sort by drift, preserve a browser session, reset, and export the changed
  picks as JSON. It also updates Arcade chrome live. The tool is loaded only in
  local development and emits an iOS-15-safe sRGB baseline before its gated
  OKLCH enhancement.

### Fixed

- **Queue color configuration now stops at the intended semantic boundary.**
  Live State values and the complete **Next up** treatment follow the active
  Primary color alongside **Now Serving** and **Served**. **Returned** remains
  canonical red and **Unclaimed** remains canonical gold; protected operational
  tokens and actions are unchanged.
- **Issue 51 follow-up: Arcade now refreshes its ready-language catalog when the
  visitor opens the language menu.** The former once-per-provider preload could
  become stale after staff activated another language in a long-lived session.
  The new request is bounded and action-driven, with no visitor polling.
- **Issue 51 visibility follow-up: long Arcade language lists now advertise
  their hidden choices.** A native touch-scrolling list masks its bottom fifth
  with a blur/fade until the final enabled language is visible.
- **Issue 57: the iOS 15 iPhone selected-navigation highlight is translucent
  again.** A pre-alpha four-scope brand token replaces the runtime slash-opacity
  utility that old WebKit rendered as an opaque Primary block over the icon and
  label.
- **Installed Arcade controls now clear gesture-navigation hardware.** Snake,
  Brick Mayhem, and Day of the Dead reserve 32 additional pixels below their
  control docks in standalone display mode so controls do not crowd the iPhone
  home indicator.
- **Issues 46 and 45: built-in card gradients and branded shadows now render
  consistently across the iPadOS 15 floor and modern WebKit.** WTH card washes
  use FEED's explicit opaque stops instead of a runtime OKLCH/transparent mix;
  shadow recipes consume pre-alpha identity tokens directly.
- **Issues 49–52: corrected four cross-surface UX defects.** Help's **Back**
  control returns authenticated staff to `/admin`; animated navigation SVGs no
  longer crop during playback; Arcade preloads all ready activated languages;
  and shared text inputs use FEED's solid field fill, covering range, append,
  reset-confirmation, and language-search fields.
- **Issue 53: the single-tap theme control now hydrates deterministically.** A
  dark system preference could make the client select a different next-mode
  icon and accessible label than the server. The disabled pre-mount render now
  always offers Dark, then resolves the real cycle after mount.
- **Issue 45: branded dark-mode shadows now keep their intended hue and
  opacity on both modern and legacy engines.** FEED's `oklab` fix identified
  the polar-space interpolation defect, but LOTTO's iPadOS 15 floor exposed a
  second failure: Lightning CSS cannot downlevel
  `color-mix(... var(--base-shadow-color) ..., transparent)` and emitted an
  opaque fallback. Brand themes now provide soft/base/strong shadow colors
  with alpha already applied, and shared shadow recipes no longer perform
  runtime color interpolation.
- **Every configurable color role now has the consumer its label promises.**
  Ambient drives the page wash and card atmosphere, with Primary only as its
  fallback; Accent reaches dark and both high-visibility scopes while remaining
  structurally excluded from the page backdrop.

### Changed

- **Installed LOTTO now supports pull-to-refresh.** In iOS/Android home-screen
  mode, a downward drag may begin anywhere while the document is already at the
  top, reloads after the branded indicator crosses its threshold, and yields to
  inputs and nested scrollers. Ordinary browser tabs retain native behavior.
- **Next up now matches LOTTO's queue-card gradient language and requested
  order.** It consumes the configurable Now Serving treatment, followed by
  canonical-gold Unclaimed and canonical-red Returned cards.
- **Issue 58: active appearances now extend into Arcade.** Identity roles style
  page chrome, panels, controls, text, and Now Serving while pixel-art gameplay
  colors remain stable and protected queue statuses remain outside the bridge.
- **Issue 47: simplified theme selection to FEED's single-tap control.** Each
  tap advances Light → Dark → Hi-viz → Light; the icon, tooltip, and accessible
  label describe the next mode, and the dropdown has been removed.
- **Issue 48: LOTTO now compiles one WTH default appearance.** Removed the
  retired secondary profile, selectors, Arcade palette, assets, environment
  switch, and template. Existing custom appearances remain intact, obsolete
  template rows are pruned, and FEED's current WTH colors and SVG assets are
  now the shared identity baseline.
- **Replaced LOTTO's improvised Colors step with FEED's interaction model.** A
  new appearance begins with one fixed Main-color slot; **Add color** reveals
  Accent, Background tint, Dark anchor, and Light anchor in order, and only the
  final optional slot can be cleared. The picker offers closest logo families,
  palette search, a native family selector, and the 11 Tailwind weights inside
  a viewport-safe popover. **Extract from light logo** fills the slots; the
  obsolete canvas/EyeDropper surface has been removed.
- Preserved documented LOTTO adapters: four-mode preview, protected queue
  status colors, translation-before-activation, Vercel Blob assets, and the
  runtime sRGB/OKLCH emission layers. FEED's separate Accent-family override is
  intentionally unnecessary because LOTTO stores the exact family and weight
  directly in the Accent slot.

### Tests

- Added regression coverage for the Primary/canonical queue-color boundary,
  queue-card order and gradient, action-driven Arcade language refresh and its
  scroll cue, anywhere-on-top standalone refresh gesture, the legacy-safe nav
  token, the Arcade appearance boundary, palette calibration serialization,
  and the 32 px safe control lane for all three Arcade games.
- Added Colors-step interaction coverage for the fixed add/clear flow, five-role
  logo extraction, nearby-family suggestions, palette search, and the native
  family/weight control. Added derivation guards for role reach, Accent-free
  shell gradients, Ambient-owned atmosphere, and alpha-bearing shadow tokens
  in all four scopes.
- Verified the live custom dark theme on iOS 15.4 and iPadOS 26.5 simulators;
  both hydrate to **Persistence confirmed** without the former shadow artifact.
  At a 768×1024 tablet viewport the wizard scrolls, its four previews remain
  distinct, the complete picker stays reachable, and the browser console is
  clean.
- Full suite: 120 files and 816 tests pass; the one skipped test is the
  production-only legacy-bundle fixture. Lint and TypeScript pass. The
  production build succeeds, all 42 chunks pass the legacy syntax scan, and
  `/` plus `/login` pass the production hydration/interactivity smoke. The
  compiled WTH fallback was visually checked on iPadOS 15.4 and 26.5 with the
  same card atmosphere and ready-language catalog. `.next` was removed and no
  server remains on port 3000. Promotion still requires the Vercel preview and
  real-device gate.

### Documentation

- **Recorded a change of approach for the white-label work.**
  `docs/FEED_BRANDING_PARITY_PLAN.md` was written as a controlled parity port,
  and what shipped in beta.1 followed its structure while re-implementing its
  behaviour — which is why the wizard collects five colour roles, stores them,
  previews them, and then mostly ignores them. Measured: Accent changes no
  tokens in dark or either high-visibility mode, and setting Ambient to a
  different family produces a byte-identical page backdrop.

  The revised rule is that LOTTO adopts FEED's implementation rather than its
  appearance — the same experience, because staff move between the two
  applications — with deviations only where LOTTO is genuinely different, each
  written down at the point of deviation. Localization of custom UI copy,
  protected operational semiotics, the token vocabulary, the runtime boundaries,
  and the legacy CSS emission are all recorded as legitimate exceptions; "our
  version is simpler" is recorded as not one.

- **Issue 45: dark-mode shadows lose their assigned hue.** `derive.ts` emits a
  deliberately saturated dark-mode shadow tint at chroma 0.161, and the rendered
  halo measures neutral grey. All 26 consumers mix toward `transparent` in
  `oklch`, a polar space — the same construction that broke FEED, where the
  symptom appeared inverted. Documented with the engine scope explicitly left
  open; no code changed.

- **Recorded and completed the decision to retire secondary compiled themes.**
  WTH is the single compiled fallback; new agency identities are created in
  the Appearance workflow.

## [1.26.0-beta.1] - 2026-08-29

### Fixed

- **The Appearance preview was blank on the iPadOS 15 support floor.** Issue 42
  made the injected brand stylesheet legacy-safe, but the wizard paints its
  four-mode preview and its logo swatches with React `style` props fed straight
  from the derived tokens, and an inline style has no `@supports` to hide
  behind. On that engine `oklch()` with a bare-number lightness is invalid, so
  the declaration was dropped outright: the panels had no background and
  inherited the dialog's dark surface, making the light and dark previews
  identical, and "Found in logo" rendered as empty circles. Operators on the
  shipped hardware could not see what they were choosing.

  `toLegacyValue` is now exported from the serializer and applied to inline
  styles through `useLegacySafeColor`, which reads engine support with
  `useSyncExternalStore` — the server snapshot is the floor, so the first client
  paint matches and modern engines keep the wide-gamut original. `ThemePreview`
  converts its token map once at the component boundary rather than at each
  style prop, because a missed call site there is an invisible panel rather than
  a slightly-off colour. Verified on the iOS 15.4 simulator. See
  `docs/ISSUES.md` Issue 44.

### Added

- Ported FEED 1.7.5-beta.4's white-label Appearance patterns to LOTTO. The
  color step now has five fixed semantic roles and a family/weight picker that
  can save only exact Tailwind v4 stops; logo extraction, canvas picks, and the
  EyeDropper snap to the same palette. The preview now covers light, dark, and
  both high-visibility modes, and a session-only **Preview in app** action can
  be stopped without changing the saved or active configuration.
- Added `docs/FEED_BRANDING_PARITY_PLAN.md` as the implementation and rollout
  contract, plus a generated 286-stop palette and drift/234-combination
  contrast proof.
- Logo uploads now retain filename/type metadata, report raster quality
  guidance, suggest a dark plate from measured transparency/lightness, and
  structurally sanitize SVGs while retaining safe vector geometry and class
  styles. Install marks must be approximately square and SVG derivatives use
  target-sized raster density.

### Changed

- Pinned `tailwindcss` and `@tailwindcss/postcss` exactly to 4.3.3 and added the
  server-only `@xmldom/xmldom` structural SVG parser.
- Brand configuration schema v2 stores fixed Tailwind palette role names.
  Schema-v1 payloads remain readable through the legacy OKLCH engine until an
  operator deliberately edits and saves the Colors step.
- Appearance activation now saves the candidate as a draft, runs the existing
  bounded translation workflow only for its candidate `brand_string`, and
  activates only after every enabled non-English language has a completed row.
  Failure leaves the previous live appearance active; visitors never poll.

### Security

- Runtime-generated custom themes still emit an sRGB baseline followed by an
  OKLCH `@supports` layer; the Tailwind migration does not weaken iPadOS 15
  support or the protected operational-status token boundary.

### Developer experience

- Corrected `smoke:legacy` for the scanner-safe login order: Magic Link is now
  the default tab, so the harness explicitly selects Verification Code before
  typing into its animated off-canvas panel. The stale sequence falsely
  reported failed hydration even though the tab controls were interactive.

## [1.25.1] - 2026-08-26

### Security

- The SMTP transport in `src/lib/auth-email-service.ts` now refuses to run in
  production instead of falling through to it. Every branch that reached
  `smtpTransport()` already checked `isProduction` except the one where
  `RESEND_API_KEY` is absent or malformed, which fell through unguarded.
- That gap was reachable in principle. `src/lib/auth.ts` refuses to start in
  production without a valid key, but `/api/auth/otp/request` imports
  `auth-email-service` directly and never loads that config, so the OTP path
  was not covered by it. Delivery in production therefore depended on the
  environment being correct rather than on the code refusing to do otherwise.
- This makes the remaining nodemailer advisory's dev-only reachability a
  property of the code. That advisory needs nodemailer 9.0.1 or later, which
  falls outside the Auth.js peer range of `^7.0.7 || ^8.0.5`, so it cannot be
  resolved by upgrading while Auth.js is on its current line. Production now
  cannot construct an SMTP transport at all, which closes the question by
  construction rather than by configuration.
- Practical impact of the old behaviour was low: an SMTP attempt on Vercel
  would have dialled `localhost:1025`, been refused, and failed the request
  closed without sending mail. The advisory itself needs attacker-controlled
  message options, and LOTTO builds the message itself.

### Added

- `tests/auth-email-transport.test.ts` covers the delivery-transport contract,
  which previously had no tests at all. Both exported senders are exercised
  because they are reached by different routes with different guards in front
  of them: production refuses SMTP on the OTP path, the magic-link path, and
  when the key is present but malformed; Resend still delivers when the key is
  valid; and development keeps the local SMTP/MailDev path on both senders.
  The three guard assertions were confirmed to fail with the guard removed, so
  they are regression guards rather than descriptions.

## [1.25.0] - 2026-08-26

### Changed

- Upgraded Next.js 16.0.10 to 16.3.2. The client bundle shrinks from 48 chunks
  and 3,394,148 bytes to 41 chunks and 3,218,514 bytes, a reduction of about
  176 KB. Every chunk is rebuilt, so this was verified on device rather than by
  static scan alone.
- Raised `sharp` from `^0.34.5` to `^0.35.4`. Next 16.3 bundles its own `sharp`
  0.35.4, which reintroduced the libvips duplicate-class collision seen during
  v1.24.1 but mirrored: the root copy stayed on 0.34.5 with libvips 8.17.3
  while Next resolved 8.18.6, loading two dylibs into one process. Raising the
  root copy deduplicates to a single `sharp` and one libvips.
- Raised `nodemailer` from `^7.0.10` to `^8.0.11`. This was blocked in v1.24.1,
  when `@auth/core` still required `^6.8.0`; the beta.32 upgrade in v1.24.3
  widened both Auth.js peer ranges to `^7.0.7 || ^8.0.5`, making the 8.x line
  available. It resolves six of the seven nodemailer advisories, including the
  CVSS 7.5 `addressparser` denial of service.
- Refreshed the `markdown-it` resolution. The lockfile had pinned 14.2.0, which
  held `linkify-it` at 5.0.1 and left the quadratic-complexity `mailto:`
  advisory open. Ordinary resolution moves to `markdown-it` 14.3.0 and
  `linkify-it` 5.0.2, which is patched. No override is required; an earlier
  attempt to force `markdown-it` 15.x was reverted once the simpler resolution
  proved sufficient, since `tiptap-markdown` declares `^14.1.0` and that
  pairing is not one upstream tests.

### Security

- Production advisories: `next`, `nanoid`, `postcss`, `sharp` and `linkify-it`
  all clear. What remains is a single unfixed issue — nodemailer's message-level
  `raw` option bypassing `disableFileAccess`/`disableUrlAccess`, which requires
  9.0.1 or later and therefore falls outside the Auth.js peer range.
- `npm audit` reports that one issue as four entries, because nodemailer 8 now
  satisfies the Auth.js peer range and npm can traverse the dependency edge to
  `@auth/core`, `@auth/pg-adapter` and `next-auth`. At 7.0.10 the peer mismatch
  hid that edge. The entry count therefore rises from 2 to 4 while the number
  of real vulnerabilities falls from 8 to 1; the count is the misleading figure.
- Neither the nodemailer nor the `linkify-it` issue is reachable by a visitor.
  Production requires Resend and never constructs an SMTP transport, and
  `linkify-it` ships only in the authenticated `admin` chunk, since visitor
  markdown renders through `remarkGfmSafe` instead.

### Fixed

- Corrected 18 pre-existing TypeScript errors across 13 test files. These are
  not introduced by the upgrade: the same 18 are present on 16.0.10, confirmed
  by running `tsc` against both dependency sets and diffing the normalized
  error lists. Next 16.0.10's build silently skipped typechecking test files,
  while 16.3.2 honours `tsconfig`'s `include`, so `npm run build` fails until
  they are fixed. Every fix is a type annotation; no assertion was weakened and
  no `src/` file changed.
- One of those was a genuine defect: `tests/appearance-logo-upload.test.tsx`
  omitted the required `templates` prop, so `AppearanceStepProps` had gained a
  member without its test being updated.
- `npx tsc --noEmit` is clean for the first time.

### Developer experience

- `npm run dev` works again on the iPadOS 15 support floor. Next 16.3 ships a
  React development build that calls `eval()` to reconstruct callstacks across
  the server/client boundary; modern engines take another path, but older
  WebKit falls back to eval and LOTTO's CSP carried no `'unsafe-eval'`.
  Separately, Safari 15 does not treat `ws:`/`wss:` as covered by
  `connect-src 'self'`, so the hot-reload socket was refused. Both relaxations
  are gated on `NODE_ENV !== "production"`, and the production headers are
  byte-identical to before: `script-src` carries no `'unsafe-eval'` and
  `connect-src` carries no `ws:` source.
- The failure was silent — no error, rejection, `console.error`, or CSP
  violation — and presented as the page rendering but never hydrating, the same
  outward signature as Issues 5 and 43 from unrelated causes.

### Added

- Rendered Markdown links now carry the conventional affordance: link-blue and
  underlined, with hover and visited states. Previously the renderer underlined
  only when the source carried `title="underline"`, so ordinary links inherited
  body colour with no underline and gave no sign they were interactive. This
  covers Announcements, Help articles and Release Notes, which all render
  through `MarkdownGuideContent`, and the announcement editor's own surface.
- Colour comes from a new brand-independent `--link` token set in
  `src/app/styles/shared/links.css`. Link colour is deliberately not derived
  per brand: a link is a universal affordance, and a green link inside Lift Up's
  green body copy would carry no signal. The reasoning mirrors
  `shared/operational-status.css`, though these are ordinary tokens a brand may
  override rather than protected ones. Authored CSS passes through the build,
  so Lightning CSS downlevels the values for the iPadOS 15 floor — the built
  stylesheet carries `--link: #0b58bb` alongside the wide-gamut form.
- `tests/markdown-link-affordance.test.tsx` covers the affordance on external,
  internal, and angle-bracket autolink forms. The last is the shape that
  matters in practice: typing a bare URL in the editor produces a link mark
  that tiptap-markdown serializes as CommonMark `<url>`, which renders as a
  real anchor. That is distinct from GFM autolink-literal, which
  `remarkGfmSafe` intentionally drops.
- `tests/markdown-editor-parser.test.tsx` covers the announcement editor's
  Markdown pipeline (tiptap-markdown to markdown-it to linkify-it), which had
  no tests: `admin-range-locking.test.tsx` mocks the editor out entirely, and
  `markdown-guide-legacy-safe.test.tsx` exercises the separate render pipeline.
  The suite is 108 files and 784 tests.

### Verification

- 784 tests, `tsc`, lint, a production build and the legacy-bundle scan pass.
- `nodemailer` 8.0.11 was exercised against a local SMTP listener using the
  exact transport options and `sendMail` shape from `auth-email-service.ts`.
  The message was accepted and delivered as multipart alternative with both
  text and HTML parts intact. The 7 to 8 upgrade needs no source change.
- Verified on a simulated iPad mini 4 running iPadOS 15.4 with a custom
  appearance applied. The device fetched `/api/auth/session` and two RSC
  prefetch requests, which only a hydrated client router issues, proving
  hydration completed rather than merely that the page painted. Observed
  through a logging proxy in front of the production server so the application
  under test was unmodified.

## [1.24.3] - 2026-08-26

### Security

- Upgraded `next-auth` 5.0.0-beta.30 to 5.0.0-beta.32 and `@auth/pg-adapter`
  to 1.11.3, bringing `@auth/core` to 0.41.3. This clears the last three
  critical advisories: production now reports 6 advisories, none critical,
  down from 16 (3 critical) before v1.24.1.
- The upgrade fixes upstream the two weaknesses v1.24.1 mitigated in LOTTO's
  own code. `@auth/core` 0.41.3 makes a non-OK session response yield no
  session rather than an error object, so existence checks fail closed
  (GHSA-8fpg-xm3f-6cx3), and applies NFKC email normalization
  (GHSA-7rqj-j65f-68wh). Both LOTTO mitigations are retained: the `proxy.ts`
  check for a populated `session.user` is stricter than the upstream fix, and
  the admin allowlist screens non-ASCII on the raw address before any
  normalization. They now serve as defense in depth.
- `next-auth` remains pinned exactly, without a caret, as
  `tests/security-nextauth-pin.test.ts` requires. The v5 line has been in beta
  for roughly 1,000 days across 33 releases with no committed stable date, so
  an unpinned range on that channel is not acceptable.

### Fixed

- Resolved the `nodemailer` peer-dependency drift reported during v1.24.1.
  `@auth/core` previously required `^6.8.0` while the project used 7.0.10,
  producing an `ERESOLVE` warning on every Vercel build. Both `@auth/core` and
  `next-auth` now declare `^7.0.7 || ^8.0.5`, which 7.0.10 satisfies.

### Verification

- No client-code change. 47 of 48 built chunks are byte-identical to v1.24.2
  and total chunk bytes are unchanged; the single differing chunk is the
  inlined `package.json` metadata reflecting the two new version strings.
  `next-auth`'s client surface (`SessionProvider`, `signIn`) is untouched,
  consistent with beta.31 changing no next-auth source and every `@auth/core`
  fix being server-side.
- The stricter upstream email validation introduced in beta.31 was exercised
  against the live OTP request route: well-formed and plus-addressed staff
  addresses pass validation and the allowlist, unauthorized domains are
  refused, and malformed forms (quoted local parts, doubled `@`, empty domain)
  are rejected. A U+3000 ideographic space is still refused by LOTTO's own
  ASCII screen.
- 780 tests, lint, `tsc`, a production build and the legacy-bundle scan pass.
  Sign-in confirmed rendering and hydrating on a simulated iPad mini 4 running
  iPadOS 15.4 with a custom appearance applied.

### Deferred

- `next` 16.0.10 to 16.3.2 remains held for a separate release. It spans three
  minor versions and is a far larger surface than this upgrade; keeping it
  apart preserves the ability to attribute any regression.
- `nodemailer` 7 to 9 remains held. Every advisory is in the SMTP transport
  path, which production does not use, and 9.x still falls outside the newly
  declared peer range.

## [1.24.2] - 2026-08-25

### Fixed

- Custom appearances now render on the iPadOS 15 support floor. `oklch()`
  requires Safari 16.4, and runtime brand themes are derived per request and
  injected as an inline `<style>`, so unlike hand-authored brand stylesheets
  they never pass through the build's Lightning CSS downleveling. Every OKLCH
  value was therefore invalid on the deployed iPad mini 4: card, popover, and
  modal surfaces rendered transparent, `--border` fell back to `currentColor`
  producing dark outlines around every card, toggle switches disappeared, and
  modals became unreadable as page content showed through both the surface and
  the missing backdrop. Only the two hand-authored built-in brands were exempt.
  `serializeBrandThemeCss` now emits an sRGB baseline first and restores the
  OKLCH values inside `@supports (color: oklch(0 0 0))`; colours inside
  gradients and shadows are converted in place with alpha preserved.
- Verified by measurement rather than inference: on iPadOS 15.4,
  `CSS.supports("color", "oklch(0.7 0.15 145)")` returns `false` and the value
  computes to `rgba(0, 0, 0, 0)`. After the fix, `--card`, `--popover`,
  `--primary`, and `--border` all resolve to real colours on-device.
  (`color-mix()` **is** supported on that engine and was not implicated.)
  See `docs/ISSUES.md` Issue 42.

- `npm run dev` is now usable on the iPadOS 15 support floor. iOS 15 Safari
  refuses the Next.js hot-reload WebSocket with a `SecurityError`, and because
  Next constructs that socket inside its async `appBootstrap`, the throw became
  an unhandled rejection that aborted bootstrap before `hydrateRoot`. The app
  server-rendered but never hydrated, presenting as a permanent
  `Loading state from datastore…` spinner with dead theme and language
  switches — indistinguishable from the Issue 5 outage, but a completely
  different cause. `src/app/layout.tsx` now emits a development-only inline
  script wrapping `window.WebSocket` so its constructor cannot throw. Hot reload
  does not work on that engine; everything else does.
- The shim is gated on `process.env.NODE_ENV === "development"`. A controlled
  comparison (build at HEAD, build with the shim, diff chunk hashes) confirmed
  all 48 production client chunks byte-identical with and without it, and the
  shim appears in zero shipped chunks.
- Investigated and ruled out as fixes: `next dev --experimental-https` with a
  trusted mkcert certificate (same error over HTTPS with a valid padlock, so the
  page's secure context is not the cause), and Safari's `NSURLSession WebSocket`
  experimental toggle (no effect). See `docs/ISSUES.md` Issue 43.

### Documentation

- `docs/BROWSER_SUPPORT.md` gains a section on the dev-server HMR WebSocket
  failure: the stack, what was ruled out, the shim and its verified production
  neutrality, and how to diagnose this class of "renders but is not
  interactive" bug without chasing false positives from bundle greps.
- `AGENTS.md` gains a Legacy Device Testing section: how to create the iOS 15.4
  iPad mini 4 simulator, the three testing tiers (dev-server iteration,
  production-build legacy verification, Vercel preview), why a modern iPad
  simulator proves nothing about the floor, and why the WebSocket shim must not
  be removed.

## [1.24.1] - 2026-08-24

### Security

- Hardened the authorization gate in `src/proxy.ts` to test for a populated
  `session.user` rather than mere session truthiness. Auth.js can resolve
  `auth()` to an _error-carrying_ object instead of `null` when the config
  factory throws, and the previous `!session` test would have treated that
  object as authenticated. This proxy is the only authorization check in front
  of the gated API prefixes, so the weaker form was exploitable rather than
  cosmetic (GHSA-8fpg-xm3f-6cx3).
- Admin email authorization now screens for non-ASCII characters on the raw
  address before any normalization, and normalizes with NFKC before validating
  rather than after. Unicode confusables such as U+FF20 FULLWIDTH COMMERCIAL AT
  collapse into a plain `@`, so a post-normalization check cannot see the very
  characters it exists to reject, and an address could otherwise change which
  domain it belongs to after passing the structural test (GHSA-7rqj-j65f-68wh).
- Moved `react-email` from `dependencies` to `devDependencies`. It is a
  preview/CLI tool that no source file or npm script imports; the shipped
  runtime library is `@react-email/components`. This removed `socket.io`,
  `engine.io`, `ws`, `glob`/`minimatch`, `conf`/`ajv`, and `fast-uri` from the
  production dependency tree, clearing 7 advisories with no runtime change.
- Production advisories reduced from 16 (3 critical, 11 high, 2 moderate) to
  9 (3 critical, 6 high). The remaining criticals are the Auth.js chain, whose
  exploit paths are mitigated in the two code changes above pending the
  `next-auth` upgrade.

### Deferred

- `next` 16.0.10 to 16.3.2 and `next-auth` 5.0.0-beta.30 to beta.32 are held
  for a separate change. Both ship code into the client bundle, `next-auth`
  onto `/login` specifically, and the declared support floor is iPadOS 15.8 on
  2015 hardware where a dependency bump has previously broken hydration. They
  require a preview deployment verified on the real device, per the new
  Dependency Security section in `AGENTS.md`.
- `nodemailer` 7 to 9 is held because `next-auth` declares a `^7.0.7` peer
  range and every nodemailer advisory is in the SMTP transport path, which
  production does not use (Resend is required in production). It should move
  together with the `next-auth` upgrade.
- `sharp` 0.35.3 was applied and then reverted to 0.34.5. Next.js 16.0.10
  resolves its own `sharp` for the image optimizer, so raising only the root
  copy stopped npm deduplicating them and loaded two different libvips dylibs
  (8.18.3 and 8.17.3) into one process, which the Objective-C runtime reports
  as a duplicate-class collision that "may cause spurious casting failures and
  mysterious crashes". That risk lands on the brand-asset and `next/image`
  paths. The libvips CVEs affect an admin-authenticated upload path, so the
  correct fix is to raise both copies together with the Next.js upgrade rather
  than to force one via an npm override.

### Documentation

- Added a Dependency Security section to `AGENTS.md` directing agents to run
  `npm audit --omit=dev` at session start and to triage advisories by whether
  a fix reaches the client bundle, since that is what carries risk against the
  iPadOS 15 support floor.

### Known issues

- The full `package.json` (45.7 KB, including `devDependencies`, `scripts`, and
  every pinned version) is inlined into a client chunk that loads on `/login`,
  because four route files import `{ version }` from it. This discloses exact
  dependency versions to any visitor and wastes bandwidth on legacy devices.
  Fixing it changes the client bundle, so it is queued with the Next.js work.

## [1.24.0] - 2026-08-24

### Changed

- AI translation now sends up to 100 same-language, same-content-type strings
  in one provider-neutral structured request instead of making one request per
  string. Stable row identifiers and strict response validation prevent a
  provider from silently omitting, duplicating, inventing, or misaligning
  translations.
- AI Configuration now distinguishes a model's advertised output-token limit
  from LOTTO's translation output budget. New and legacy configurations use an
  8,192-token operating budget by default, requests adapt downward for small
  batches, and LOTTO enforces a 16,384-token application ceiling.
- Successful batches are committed to the translation store in one bulk write.
  Token usage and estimated cost remain allocated to individual rows for the
  existing management and reporting surfaces.

### Resilience

- Malformed structured output receives one bounded split-and-retry attempt so
  a single difficult batch can be isolated. Provider, authentication, quota,
  and network failures do not trigger recursive request storms; affected rows
  are recorded as failed for staff review.

### Documentation

- Documented LOTTO's translation batch, output-budget, validation, retry, and
  request-count contracts in the AI guide, FEED parity notes, roadmap,
  `AGENTS.md`, and Issue 41.

## [1.22.3] - 2026-08-24

### Changed

- The active custom public service label is now discovered as visitor-facing
  brand copy, translated for every enabled non-English language, included in
  client language packs, and rendered on the public board with English
  fallback. Admin and sign-in Appearance copy remain intentionally outside the
  localization boundary.
- Arcade language menus now consume the shared enabled-language catalog used
  by Home and Display instead of maintaining a private eight-language list.
  Persisted dynamic languages resolve their native label on direct Arcade
  loads, and long menus use the established bounded scroll treatment.
- Enabling a dynamic language now owns the full staged **Find Missing** sweep in
  Admin. The language remains absent from every client menu until its required
  UI and active public-brand translations complete; failures keep it hidden and
  direct staff to Translation Management.

### Fixed

- **Find Missing** no longer reports that localization is complete while an
  active custom public service label remains untranslated.
- Arcade no longer hides enabled dynamic languages such as Bosnian or renders
  an empty label for a persisted non-core selection.
- Removed the homepage's fixed four-second language-readiness polling loop. It
  could issue 21,600 Vercel Function/Edge requests per day from one stuck tab
  while repeatedly querying Neon for translation work that had never started.
  Visitors now receive only ready language options, and stale persisted dynamic
  selections safely return to English after the catalog resolves.
- Bounded Admin translation jobs now stop when the pending count fails to shrink
  and cap follow-up chunk requests, preventing a provider or queue fault from
  turning legitimate preparation work into another runaway request loop.

### Documentation

- Clarified which configurable brand copy is visitor-localized and recorded
  the shared language-catalog requirement for every client-facing picker.
- Added serverless polling guardrails to `AGENTS.md` and documented the request
  amplification root cause and prevention contract in Issue 40.

## [1.22.2] - 2026-08-24

### Fixed

- Appearance configurations can now save the durable public Vercel Blob URLs
  returned for uploaded logos and generated install icons. Validation remains
  fail-closed: only root-relative assets or HTTPS URLs in LOTTO's managed
  `brand-assets/` namespace on a public Vercel Blob host are accepted.
- Logo and app-icon upload controls now use real buttons that explicitly open
  the native file picker, preventing the first selection from being lost by
  the former label-based trigger.

### Documentation

- Extended the hosted-asset deployment acceptance check to require a complete
  upload, save, reload, and redeploy cycle for every agency project.

## [1.22.1] - 2026-08-24

### Added

- Durable public Vercel Blob storage for uploaded Appearance logos and generated
  install icons, with the existing filesystem store retained for local and
  self-hosted deployments.
- Structured, ASK-compliant brand-upload errors that distinguish empty or
  oversized files, unreadable images, unsafe SVG content, missing hosted
  storage, storage outages, and unexpected service failures.

### Changed

- Hosted uploads now accept an image based on its inspected bytes instead of
  rejecting a valid image because a browser supplied an incomplete MIME type.
- The secure server-upload limit is now 4 MB, safely below Vercel Functions'
  4.5 MB request-body limit, and is enforced before upload in the Appearance
  wizard.

### Fixed

- Authentication emails now honor the active Appearance configuration's
  **Dark plate** logo treatment. St. Johns' light-lettered mark renders on its
  configured dark surface in both Magic Link and Verification Code messages;
  transparent-treatment brands remain unchanged.
- Valid self-contained SVGs containing internal class styles (including the
  reported NVIDIA logo) no longer appear to fail as unsupported when the real
  cause is Vercel's read-only deployment filesystem.
- Palette extraction opts into anonymous CORS before loading public Blob logos,
  keeping automatic color-story recommendations available for hosted uploads.

### Documentation

- Added the Vercel Blob provisioning and deployment contract, updated the
  Appearance guide's format/size/error guidance, and recorded the root cause
  and prevention rules in Issue 37.

## [1.22.0] - 2026-08-24

### Added

- **Scanner-safe Magic Links.** Email callback GETs now land on a branded
  confirmation page without consuming the one-time token. Only the staff
  member's explicit **Sign in** POST reaches Auth.js, so Microsoft Defender and
  similar inbound-mail scanners can inspect the link harmlessly.
- Shared, runtime-branded React Email templates for Magic Links and six-digit
  Verification Codes, including HTML and plain-text bodies, live-text agency
  identity, email-safe brand colors, expiry/security guidance, and the active
  app name as the sender display name.
- An additive `verification_token.type` discriminator and lookup index isolate
  `otp` credentials from Auth.js `magic_link` credentials.

### Changed

- **Magic Link** is now the default staff sign-in method, with **Verification
  Code** as a first-class fallback. Both methods explicitly expire after ten
  minutes and share the same authorization policy and email delivery service.
- Verification Code entry appears only after LOTTO accepts the delivery
  request. Authorization and delivery failures remain on the email step with
  actionable inline feedback.

### Fixed

- Requesting a Verification Code no longer deletes a pending Magic Link for the
  same email address.
- Magic Link expiry now matches the ten-minute duration shown in the interface
  and message copy instead of inheriting Auth.js's longer default.

### Documentation

- Replaced the former “Magic Links are not viable” guidance with the v1.22.0
  scanner-safe contract, migration/runbook, security invariants, user guidance,
  and deployment acceptance checks. See `docs/AUTHENTICATION.md`,
  `docs/V1.22_AUTHENTICATION_PLAN.md`, and Issue 36 in `docs/ISSUES.md`.

## [1.21.1] - 2026-08-24

### Fixed

- Stabilized the public-display RTL regression test against the intentional
  language-change scramble animation after the full-suite-only timing failure
  recurred during v1.21.0 production validation. User-facing RTL behavior is
  unchanged.

### Added

- The Admin **Sync With FEED** section now shows a configuration-status tag and
  the local date and time when the active in-app token was generated.
- **Administrators can pair LOTTO with FEED from the History card.** The modal
  shows the LOTTO URL, generates one high-entropy token, displays it once, and
  stores only its SHA-256 hash in Neon (or the local file fallback). Generating
  another token immediately invalidates the previous value.

### Changed

- The History card now separates snapshot controls from a dedicated **Sync With
  FEED** section, with a concise **Setup** action beneath older-snapshot controls.
- The read-only FEED endpoint now authenticates against the singleton token
  store and returns stable credential-free error codes. A legacy
  `LOTTO_FEED_INTEGRATION_TOKEN` is accepted only until the first database token
  is generated.

### Documentation

- The LOTTO → FEED runbook, deployment guide, Admin architecture, and in-app
  Staff Controls guide now document the one-token pairing workflow.

## [1.21.0] - 2026-08-22

### Added

- Durable, privacy-minimized queue-session timing. LOTTO now records the atomic
  transition that first issues each ticket, its write-once first call, batch
  boundaries, append activity, and Random-to-Sequential transitions.
- **Reset for New Day** now closes meaningful active state into immutable,
  revisioned history before clearing the queue. Postgres performs the closeout,
  reset snapshot, and singleton replacement in one transaction; the local file
  fallback writes the closeout first and retries idempotently.
- `GET /api/integrations/feed/v1/daily-summaries`, protected by a dedicated
  bearer token, exposes cursor-ordered closeout revisions for FEED. The contract
  contains anonymous observation sequences and never exposes physical ticket
  numbers, staff identity, or client identity.

### Documentation

- Added `docs/LOTTO_FEED_INTEGRATION.md`, deployment configuration, and staff
  guidance explaining that Reset preserves the completed queue for Analytics.

## [1.20.1] - 2026-07-20

### Fixed

- **Severe input lag when editing Announcement copy on older devices
  (iPad mini 4).** The announcement draft was held in root `AdminPageClient`
  state, so every keystroke re-rendered the entire `/admin` tree — including
  `TranslationCard` (which mounts all three of its tabs, not just the visible
  one), `AppearanceCard`, the operating-hours and language-rotation editors,
  the QR card, and one Radix dialog per returned/unclaimed ticket. On A8-class
  hardware this produced multi-second latency between a keypress and the
  character appearing; the development machine is fast enough that the fan-out
  is invisible. This is a recurrence of the Issue 14 defect class in a surface
  added after the v1.5 input-isolation work. See `docs/ISSUES.md` Issue 35.
  - Added `src/components/announcement-section.tsx`, a memoized component that
    owns the draft locally and only notifies the root on Save — the same
    pattern as `RangeGenerationControls` / `ResetActionControls`.
  - Removed `pendingAnnouncement` state and its two per-keystroke effects from
    `AdminPageClient`; `handleSaveAnnouncement` now receives the draft as an
    argument so its identity is stable across renders.
  - Draft persistence to `localStorage` is now debounced (500 ms) with a flush
    on `pagehide`/unmount, taking the synchronous storage write off the
    keystroke path. Draft-recovery and server-reconciliation behavior is
    unchanged.
  - Measured effect: sibling re-renders per keystroke went from 1-per-character
    to 0. Covered by `tests/announcement-input-isolation.test.tsx`, which
    asserts the isolation property rather than a wall-clock timing (a timing
    assertion cannot catch this class of bug on modern development hardware).

### Documentation

- `docs/ISSUES.md`: added Issue 35 with root-cause analysis, the render-count
  measurement, and prevention guidance for future `/admin` inputs.
- `docs/V1.5_OPTIMIZATIONS.md`: recorded the Announcement editor under the
  Phase 4 input-isolation follow-up and noted the `TabsContents` all-tabs
  render-cost characteristic.
- `docs/ADMIN_PAGE.md`: documented the keystroke-isolation requirement for
  admin inputs.

## [1.20.0] - 2026-07-20

### Added

- **Configurable branding, Phases 0–1 (derivation core + runtime delivery).**
  Implements the first two phases of `docs/CONFIGURABLE_BRANDING_PLAN.md`:
  - `src/lib/brand-theme/`: zod-validated brand-configuration schema
    (`schemaVersion` 1, sparse Advanced-tier `overrides` map), a pure OKLCH
    derivation module that produces the complete light/dark/Hi-viz token sets
    from 3–6 compact color inputs (rules reverse-engineered from the
    hand-authored St. Johns identity; verified against it within documented
    tolerance), post-merge contrast validation (4.5:1 text pairs; 2.5:1 floor
    for color-on-color emphasis pairs, calibrated so both shipped identities
    pass — see the Issue 33 analysis in `src/lib/brand-theme/validate.ts`),
    and OKLCH-only CSS serialization behind double-specificity
    `[data-brand="custom"]` selectors. Protected operational status tokens are
    structurally absent from the schema, generator output, and override
    allowlist.
  - `src/lib/brand-config/`: `brand_configurations` JSONB store (Neon + local
    file fallback, `BRAND_CONFIG_FILE` test isolation), a read-only WTH
    template generated from the compiled default, and a fail-closed per-request
    resolver implementing the resolution order (active configuration → WTH
    default).
  - Runtime delivery: the root layout, metadata, viewport, manifest, admin/
    display/inventory pages, OTP email identity, CSP-independent FEED gating,
    and all client brand consumers (logo, login, About, nav bars, translation
    surfaces) now read the resolved runtime brand; a custom theme ships as a
    server-rendered inline style block with no flash of the default brand.
  - Staff-gated `/api/brand-config` CRUD (save/activate/deactivate/delete)
    that refuses to persist or activate any configuration failing schema,
    override-allowlist, or contrast validation.
  - Weak-form brand-swap acceptance verified: activating the St. Johns
    template on a WTH deployment (and vice versa) fully displaces the
    compiled identity at runtime, confirmed by unit tests and in-browser
    light/dark review on localhost.
- **Configurable branding, Phase 2 (Appearance wizard) + capstone.** A
  seven-step Appearance wizard in the Admin Advanced section (Start from
  template or scratch / Identity / Logos & icons / Colors / Staff copy /
  Capabilities / Review), mirroring the Translation AI wizard's step-dialog
  mechanics. Uploads are staff-gated, re-encoded, and measured server-side
  (`sharp`), with the full 32–512 px browser/Apple/maskable install-icon set
  generated from one square mark; logos preview at the real capped header
  height (Issue 32 lesson). Colors edit as OKLCH (picker + text) with the
  full derived theme previewed live and contrast issues explained inline;
  operational status colors are shown in the preview specifically because
  they cannot change. The Appearance card lists saved configurations with
  Edit / Activate / Delete / revert-to-built-in, and is the prominent
  no-configuration call to action (no auto-open). New
  `docs/user-guides/12-appearance.md` Help guide. **Capstone brand-swap test
  passed in both directions on localhost**: starting from scratch in the
  wizard only, a WTH dev deployment was made on-brand for St. Johns
  (dark-plate logo treatment, teal derivation, queue-only nav) and a
  St. Johns-profile deployment was made on-brand for WTH (blue/gold six-color
  identity, transparent logos, inventory tab restored), each verified in
  light, dark, and Hi-viz against the hand-authored references.

### Added

- **Color-story configurator with logo eye-dropper.** The Appearance
  wizard's Colors step is rebuilt around the semiotic model in
  `docs/COLOR_SEMIOTICS.md`: operators list their brand's colors in
  hierarchy order (1–5) and the system classifies each (chromatic vs.
  neutral anchor) and assigns roles in plain language under the two-hue
  signal ceiling — main (state + identity), accent, ambient texture, and
  surface anchors — with warnings when a signaling color enters the hue
  bands reserved for the universal Returned-red/Unclaimed-gold status
  colors. Colors can be typed as OKLCH/hex, tapped from an auto-extracted
  logo palette (median-cut over the uploaded logo's opaque pixels), picked
  off the logo canvas directly, or eyedropped from anywhere on screen via
  the native EyeDropper API where available. Derivation changes shipping
  with it: every mode's Now Serving and Called variant now derives from the
  serving color's own hue (closing the documented continuity gap — the
  original WTH blue-by-day/gold-by-night class of bug — with a regression
  test enforcing ≤8° cross-mode hue drift), and new optional
  `colors.ambient` inputs (backward-compatible schema-v1 extension) feed
  their hues to card tints only, making four-color brands like WTH's
  blue/gold/teal/teal fully expressible; the WTH template now authors its
  two teals. St. Johns fidelity tests confirm hand-authored output is
  unchanged.

### Added

- **Automatic appearance recommendation from the uploaded logo.** Reaching
  the color step with an untouched palette and a real logo now builds the
  entire color story automatically — palette extracted from the logo
  (median-cut, population-ranked), roles assigned under the signal ceiling,
  anchors from the logo's neutrals — so staff only correct what they
  dislike; a "Recommend from logo" button re-runs it on demand. The
  recommender is semiotics-aware (docs/COLOR_SEMIOTICS.md, "Automatic
  recommendation"): colors in the reserved Returned-red/Unclaimed-gold hue
  bands are never auto-placed in signaling roles, with a three-step
  workaround ladder (safe chromatics first; a tonal two-rung identity from
  the logo's dark neutral when every chromatic collides; hue demoted to a
  sub-signal-chroma tone when there is nothing else) and plain-language
  notes explaining each workaround. Manual choices still get warnings, not
  vetoes.
- **Configurable service heading.** The board's "Food Pantry Service For"
  heading is now an Appearance setting (`identity.serviceLabel`) — LOTTO is
  queue management generally, so clinics, libraries, or equipment counters
  can define their own line ("Clinic Hours For"). Blank keeps the standard
  translated heading; a configured heading renders verbatim.

### Fixed

- **Public-board service clock no longer triggers hydration warnings.** The
  clock initialized from `Date.now()` and rendered `Intl.DateTimeFormat`
  text that can legitimately differ between server render and hydration
  (minute boundary; Node vs. browser ICU spacing before AM/PM) — exactly the
  class React's hydration-error message names. The clock text now carries
  `suppressHydrationWarning`; the mounted interval corrects it immediately.
  A separately reported page-wide Radix-id hydration mismatch on `/admin`
  could not be reproduced on a consistent build and is documented with its
  full analysis and reopening criteria as `docs/ISSUES.md` Issue 34.
- **SVG logo uploads stay vector.** Uploaded logos were universally
  re-encoded to PNG, which rasterized SVGs and threw away crisp edges and
  hi-DPI scalability. Logo storage is now format-aware, sniffing the real
  format from the bytes (never the claimed MIME type): SVGs are validated as
  self-contained and inert — no scripts, event handlers, external or `data:`
  references, or embedded documents; violations are rejected with actionable
  messages — then stored **verbatim**; PNGs re-encode as PNG and JPEGs as
  JPEG (the sanitizing re-encode remains, in each format's own container).
  The asset route now serves extension-correct content types with `nosniff`,
  and brand assets get a dedicated `default-src 'none'; sandbox` CSP (via a
  more-specific header rule, since route-set headers are overridden by the
  site-wide policy) so a directly-navigated SVG document can never execute
  anything even if upload validation were bypassed. `next/image` is
  configured with `dangerouslyAllowSVG` plus the same sandboxing CSP so
  vector logos render through the existing `BrandLogo` slot. Install-icon
  generation still (correctly) rasterizes SVG marks to PNG, but now renders
  the vector at target density first — a 512 px icon from a small-viewBox
  SVG is truly 512 px, not upscaled. Covered by `tests/brand-assets.test.ts`
  (verbatim vector round-trip, viewBox measurement, format preservation,
  seven hostile-SVG rejections, crisp icon output).
- **The Appearance wizard no longer blocks on contrast errors the operator
  cannot act on.** Starting a theme from scratch (and several other primary
  colors, e.g. very dark or very light ones) surfaced blocking errors like
  "In Hi-viz light mode, text on filled primary buttons measures 2.28:1" —
  but the Hi-viz layers are fully derived and expose no direct inputs, so
  there was nothing the operator could change. The derivation now
  auto-corrects every contrast pair whose two sides are both derived: it
  nudges only lightness, in small steps, away from the opposing color (with a
  direction-flip fallback when one direction can't reach the floor, e.g. a
  near-black fill against near-black text), keeping hue and chroma in the
  brand family. Correction is a no-op for pairs that already pass — the
  St. Johns/WTH fidelity tests pin that down — and pairs built from
  operator-typed colors (page surface vs. text, etc.) still surface as
  actionable errors rather than being silently overridden. Regression tests
  cover the scratch defaults and a sweep of extreme primaries.
- **Advanced-accordion cards no longer have their shadows clipped.** The
  accordion's animating wrapper requires `overflow-hidden` for its height
  animation, which cut off the drop shadows of cards inside the panel at the
  panel edges. The wrapper now extends 16px past the content on the sides and
  bottom via symmetric negative margin + padding, so shadows render inside
  the clip region — correct both while animating and at rest (a state-driven
  overflow toggle was rejected because AnimatePresence snapshots the exiting
  element's props during the close animation). The host page must provide
  ≥16px horizontal padding; `/admin` uses 24px. Also moved the Appearance
  card beneath the Translation card in the Advanced grid.
- **St. Johns personalized-homepage header logo could overlap "NOW SERVING" on
  mobile.** The header logo was sized by a fixed width, so a brand whose logo
  lockup is taller relative to its width than William Temple House's wide
  horizontal wordmark could exceed the fixed vertical clearance reserved below
  it. The header logo is now capped to a fixed height instead, guaranteeing
  clearance for any brand's aspect ratio. See `docs/ISSUES.md` Issue 32.
- **St. Johns light-mode primary-button text had poor contrast.** Filled
  primary buttons (e.g. "Enter a new ticket number") showed near-black text on
  a mid-green fill. `--primary-foreground` for St. Johns light mode is now a
  crisp near-white; dark mode is unchanged. See `docs/ISSUES.md` Issue 33.
- **The retired secondary profile's PWA home-screen label used a service name
  instead of the organization's proper name.** The profile metadata was
  corrected before that compiled profile was later removed.

### Documentation

- **Added `docs/COLOR_SEMIOTICS.md` — the design rationale for LOTTO's
  systematic use of color.** Documents the three axioms (hue signifies role,
  value signifies mode, saturation signifies loudness; a two-hue signal
  ceiling; tiers expand outward from the semiotic center), the layer model
  from the untouchable operational layer to ambient texture, the value-ladder
  concept behind the derivation offsets, color-story tiers from monochrome to
  five colors with strategies for each, reserved hue bands around the
  operational red/gold, and how the three real deployments (WTH, St. Johns,
  Lift Up) map onto the model. Also records two model violations found by
  auditing the current derivation against the axioms — the serving-hue
  cross-mode continuity gap and unreachable ambient hues — scoped into the
  next-iteration color-story configurator in
  `docs/CONFIGURABLE_BRANDING_PLAN.md` Phase 3.
- **Added and completed `docs/CONFIGURABLE_BRANDING_PLAN.md` for self-service
  brand theming.** The document now records the shipped derivation,
  persistence, runtime-delivery, Appearance-wizard, color-story, and capstone
  brand-swap work, while keeping the Advanced semantic-slot tier and Arcade
  palette derivation explicitly deferred. WTH remains the compiled
  no-configuration default throughout.
- **Rewrote `docs/DEPLOYMENT.md`'s production section into a full new-agency
  deployment runbook**, replacing a stale two-table Postgres schema snippet
  that predated the NextAuth/OTP/AI-translation tables in `schema.sql` — an
  older version of that snippet directly caused a production incident during
  the St. Johns launch (schema never applied to the new database; see
  `docs/ISSUES.md` Issue 29). The runbook is written from what actually
  happened launching St. Johns Food Share into production on 2026-07-18,
  including several non-obvious Vercel/Neon/Resend/Namecheap failure modes:
  Vercel's Framework Preset silently defaulting to "Other" (full 404 despite a
  successful build; Issue 31), Vercel's "Sensitive" environment variables
  being unrecoverable after creation and the resulting workflow for applying a
  schema without ever seeing the connection string (Issue 30), and DNS/mail
  setup gotchas at Namecheap. Also documents a known, deferred, non-blocking
  issue where WTH's own PR preview builds fail due to Preview-scoped database
  env vars (production is unaffected).
- Updated the original branding plan: marked the first secondary-agency launch
  complete (2026-07-18) with a pointer to the new runbook, and added two new
  brand-authoring guardrails for future agencies — logo header sizing (fixed
  height, not fixed width) and a manual primary/foreground contrast check,
  since neither is caught by the existing automated brand tests.
- Appended `docs/ISSUES.md` Issues 29–33 covering the above with root cause,
  fix, and prevention for each.

## [1.19.0] - 2026-07-18

### Documentation

- Added `docs/CSS_THEME_ARCHITECTURE.md` with the implementation plan, cascade
  contract, OKLCH-only CSS authoring standard, brand source boundaries, and
  deployment-aware Arcade theme architecture.

### Changed

- **CSS colors now use an enforced OKLCH-only authoring standard.** Converted
  every authored core and Arcade CSS color literal from hex/RGB/HSL or named
  black/white to precise `oklch()` values while retaining alpha, gradients,
  selector order, and visual output. Added a reusable conversion script and a
  repository-wide CSS regression test that rejects legacy color notation.
- **Core and Arcade brand palettes now have explicit source boundaries.**
  Reduced `globals.css` to an ordered import manifest; extracted shared
  foundations, protected operational status semantics, Hi-viz behavior, and
  component rules from the WTH default and St. Johns identity layers. Arcade
  remains isolated in its own stylesheet while loading separate WTH and St.
  Johns `--arcade-*` palette files. Updated brand tests to enforce import order,
  WTH's no-configuration default, operational-token isolation, and both Arcade
  palettes.

### Fixed

- **Admin status actions no longer inherit agency branding.** The Returned and
  Unclaimed “Mark ticket” triggers and confirmation actions now use protected
  red/gold operational variants across light, dark, and Hi-viz themes. Their
  disabled state uses explicit neutral fill, text, and border tokens at full
  opacity instead of blending a translucent brand-primary button into its
  status card. Added component, Admin integration, and brand-boundary
  regression coverage plus staff/design documentation.
- **Public display logo no longer touches the mobile search toolbar.** The
  shared public-board container now reserves additional mobile-only top
  clearance for the absolutely positioned language/search/theme row, while
  retaining the existing desktop offset. The fix applies equally to surfaced
  white-label logos and the transparent William Temple House mark without
  changing reusable logo padding or sizing.
- **White-label branding no longer changes universal Returned/Unclaimed status
  colors.** Removed warning/danger fills, borders, gradients, and ticket-text
  overrides from the St. Johns light/dark profile. The light profile selector
  had higher specificity than the base `.dark` theme, causing pale light-mode
  Admin badges to combine with near-white dark-mode text while also replacing
  the standard red/gold alert gradients. Returned/danger and
  Unclaimed/warning now inherit LOTTO's standard per-theme semiotics across
  Admin, display cells, legends, badges, and alerts. Added agent/design
  guardrails and a selector-level regression test to prevent brand profiles
  from overriding protected operational tokens.

### Added

- **Exact-address staff authorization.** Added server-only
  `ADMIN_EMAIL_ALLOWLIST` support for agencies using public email providers.
  The comma-separated allowlist may be combined with `ADMIN_EMAIL_DOMAIN`; an
  address is accepted when it matches either restriction. Both are enforced
  consistently for OTP issuance, OTP verification, and Magic Link sign-in.
  Production fails closed when neither is configured; focused security tests
  and deployment guidance cover the policy.
- **One-repository configurable branding.** Added typed compiled deployment
  profiles, a shared brand-logo component, profile-aware page
  metadata, PWA identity, login/OTP/About copy, and semantic light/dark theme
  tokens. William Temple House remains the no-variable default, so its current
  Vercel production identity and FEED integration do not change. Added the
  detailed architecture and validation plan plus multi-project deployment guidance.
- **Secondary queue-only profile.** Added an authorized agency logo,
  protected dark logo plate in light mode, transparent white-outline logo
  treatment in dark mode, agency copy, a rounded-corner scalable SVG browser
  icon, and a dedicated padded 32–512 px PNG fallback/install set for browser
  tabs, Apple touch metadata, and installed web apps. Its deliberately compact
  color system is built from brand teal (`#33A478`),
  off-white (`#F7F7F7`), and charcoal (`#2D2D2D`). Neutral surfaces now carry
  the layout while teal is reserved for emphasis. The operational **Now
  Serving** state uses `#319A72` in light mode and luminous mint in dark mode;
  called tickets use quieter teal-derived tints/shades so the active ticket is
  unmistakable.
  Dedicated Vercel, Neon, Resend, DNS, and staff-email values remain deployment-specific.
- **Secondary-profile Hi-viz themes.** Added flat, contrast-first light
  and dark Hi-viz identity layers based on the approved mockups: off-white or
  charcoal foundations, teal/mint focus and queue-progression treatments,
  high-contrast neutral cards, and profile-aware navigation accents. The new
  selectors intentionally omit protected operational status tokens, so
  Returned/Unclaimed and other universal semiotics remain standard.
- **Secondary-profile Arcade themes.** Added Arcade-scoped light and dark
  deployment palettes based on the approved mockups: pale neutral or deep
  green-charcoal foundations, teal/mint pixel borders and headings, vivid teal
  light-mode actions, off-white dark-mode actions, and matching banner, grid,
  navigation, game chrome, control, and leaderboard treatments. Decorative
  colors that were previously embedded in Arcade selectors are now semantic
  `--arcade-*` tokens. William Temple House retains the original
  blue/pink/cyan/yellow defaults when no profile is configured.
- **Inventory is now an optional deployment capability.** Profiles without a
  FEED endpoint omit Inventory from public/authenticated core and Arcade nav,
  return not found from `/inventory`, skip inventory translation auditing, and
  omit FEED from CSP. A configured endpoint failure no longer falls back to
  William Temple House's feed, preventing cross-agency inventory leakage.
- **Help content for the Announcement builder and AI translation stack.** These
  shipped in v1.18.0 with no guide coverage. Added
  `docs/user-guides/10-announcements.md` and `11-ai-translation.md` (Language
  Settings, AI Configuration, Translation Management); corrected stale
  pre-login copy in `01-getting-started.md` and `02-staff-controls.md` to
  describe the `/staff` sign-in gate; cross-linked `06-languages-themes.md` to
  the new AI-translation guide. See `docs/V2.0_PLANNED_FEATURES.md` Feature 7.
- **`AGENTS.md` now requires help-guide updates alongside UX changes.** Any
  feature/change that alters a user-facing interaction or workflow must also
  update `docs/user-guides/`, not just `CHANGELOG.md`/`docs/ISSUES.md` — closes
  the gap that let the above content fall behind.

## [1.18.0] - 2026-06-30

### Added

- **Home-screen / PWA app icon (WTH emblem) for iOS and Android.** Adding the
  site to a phone home screen previously showed a generic glyph on black, because
  the only icon was a 48×48 transparent `favicon.ico` and iOS fills transparency
  with black. Added a dedicated, opaque WTH emblem icon (layered faces + sun on
  white), cropped at full resolution from `public/wth-logo-horizontal.png`:
  `src/app/apple-icon.png` (180×180, iOS apple-touch-icon), `src/app/icon.png`
  (512×512, browsers), and a Web App Manifest (`src/app/manifest.ts` →
  `/manifest.webmanifest`) with 192/512/maskable icons in `public/icons/` for
  Android "Add to Home Screen" / installable PWA (`display: standalone`,
  `theme_color: #2762a2`). `favicon.ico` is retained for legacy desktop tabs.
  See `docs/ISSUES.md` Issue 26.

### Fixed

- **Browser tab and search-result title are now static (no stale pantry date).**
  `ReadOnlyDisplay` set `document.title` to the live pantry date on the client.
  Because it renders on the indexed home page (`/`), Googlebot crawled and froze
  that date into the search result (e.g. "Food Pantry Service For Thursday, June
  25th, 2026" while the tab read June 30th). Removed the client-side
  `document.title` override so the tab and search title fall back to the static,
  server-rendered `metadata.title` ("William Temple House App"); the meta
  `description` was already static. The live service date is still shown in-page
  (`service-date`). See `docs/ISSUES.md` Issue 25.
- **Bottom tab bar no longer blocks clicks across its row on wide screens.** The
  fixed `<nav>` wrapper spans the full viewport width so the pill can center, but
  on desktop/iPad the pill is only `sm:w-auto` — leaving large transparent flanks
  that intercepted pointer events, so any control sharing the bottom row was
  unclickable until scrolled out of that band. The wrapper is now
  `pointer-events-none` with the `<ul>` pill `pointer-events-auto`, so only the
  visible capsule is interactive (mobile `w-full` is unaffected). Applied to both
  the core (`bottom-tab-bar.tsx`) and arcade (`arcade-bottom-tab-bar.tsx`) bars.
  See `docs/NAVIGATION.md`.
- **Inventory page fetches from FEED again (CORS preflight regression).** A
  `User-Agent` header that had been added to the shared FEED-inventory fetch
  (intended for the server) was also being sent from the browser, where it is not
  a CORS-safelisted header. That promoted the cross-origin GET to a preflighted
  request, and FEED's preflight only allows `Content-Type`, so the browser blocked
  the request — breaking both the public `/inventory` page and the admin
  inventory-name bridge. `User-Agent` is now sent **server-side only**; the browser
  fetch is back to a CORS "simple request." See `docs/ISSUES.md` Issue 23 and
  `docs/FEED_PUBLIC_INVENTORY.md`.
- **iPadOS 15.8 login/home no longer inert (legacy WebKit).** `remark-gfm`'s
  autolink regex used lookbehind, which JavaScriptCore only supports from Safari
  16.4, so the chunk parse-failed on iPadOS 15.8 (Safari and Chrome) and aborted
  React hydration — the login and home pages rendered but were not interactive.
  Replaced with a legacy-safe GFM plugin (no autolink-literal), added a
  `browserslist` floor and a build-time bundle guard. See `docs/BROWSER_SUPPORT.md`
  and `docs/ISSUES.md` Issue 22.
- **Inventory translations now work for languages FEED doesn't cover.** The FEED
  public inventory feed is intentionally public (CORS `*`, no auth), but LOTTO's
  server-side egress to it can be blocked, so the auditor saw zero inventory and
  newly enabled languages rendered item names in English. Find Missing now reads
  the feed in the **admin's browser** (the path that reaches it) and bridges the
  English category/item names to the server, which translates them through
  LOTTO's own AI pipeline and stores them — FEED supplies English names, LOTTO
  supplies the dynamic-language translations FEED's feed never carried. The
  server-side fetch remains a best-effort fallback for non-browser callers.

### Added

- **Find Missing surfaces inventory-source health.** The auditor now reports how
  many source strings it scanned per content type (`sourceCounts`), and the Find
  Missing dialog shows a clear warning when the inventory feed yielded **zero**
  items — i.e. the server couldn't read the FEED inventory — instead of silently
  reporting "everything is translated." Turns a silent failure into a visible one.

### Changed

- **"Getting ready" screen polish.** The "choose another language" escape button
  is now a primary button and is **localized** per language (hardcoded in all 52
  non-core catalog languages, like the waiting message) so it reads in the
  visitor's chosen language.
- **Faster visitor language list.** `listClientLanguages` computes readiness for
  every enabled language from a single query (grouped in memory) instead of one
  query per language, cutting the homepage "Choose your language" load time.

### Added — earlier this release

- **Inventory translation domain (v2.0).** The "What's in stock" inventory feed
  is now a translatable content type. The auditor extracts English category and
  item names from the FEED public inventory and queues them for AI translation
  (lowest priority, after announcements and UI strings) for newly enabled
  (non-core) languages — core languages keep FEED's own translations. Inventory
  translations ride in the language pack, and the inventory page resolves each
  name FEED translation → LOTTO DB translation → English, so non-English visitors
  see localized item names even for languages FEED doesn't cover.

### Fixed

- **Animated icons replay on first hover after mount/view animation.** Fixed the
  FEED-documented `AnimateIcon` stuck-state bug where icons that animated on
  page load or viewport entry stayed internally active, causing the first hover
  to no-op until mouse leave reset the state. `AnimateIcon` now replays an
  already-active zero-delay trigger through a `false -> true` transition, and
  the motion documentation records the root cause and correct pattern.
- **AI Configuration type-picker icon animations are consistent.** The Add AI
  Configuration modal now drives the Bot hero, AI Model CPU card, and System
  Prompt card icons from the same modal-open animation cycle with an explicit
  reset, so all three animate on initial render and replay from the first hover.
  The System Prompt multi-step modal now uses the same step-open intro/reset
  trigger for the prompt-category hero and UI/Inventory/Announcement category
  icons.
- **Translation card mobile responsiveness.** Ported FEED's responsive table
  patterns for the Translation and AI Configuration tabs: lower-priority
  columns hide on mobile, long text truncates with a view-full dialog, and
  per-row actions now live in a stable dropdown instead of colliding inline
  buttons. The remaining mobile columns use a fixed 100%-width table layout so
  the Actions column stays visible instead of being clipped by a desktop
  min-width.
- **Translation Management sticky table header.** Removed the extra table
  overflow wrapper from the FEED-derived data table so the capped row viewport
  scrolls rows while the header remains pinned.
- **Translation card tab transitions.** Switched the Translation card to the
  FEED-style animate-ui radix tabs wrapper so tab highlights and panel
  transitions follow the production FEED pattern. The tab panel transition is
  now a simple fade/blur instead of the older side-to-side sliding animation.
- **Translation section animated icons now use FEED implementations.** Replaced
  local/improvised Translation card section icons with FEED's imperative
  `ui/globe`, `ui/bot`, and `ui/languages` icons, switched Language Settings
  search to FEED's `ui/search`, and replaced the AI Configuration key-test icon
  with FEED's native `ClipboardCheckIcon`.
- **Translation card visual clipping.** Added the same inner-spacing pattern used
  for scrollable inventory results so Translation tab shadows and focus/highlight
  rings have room to render instead of being cropped by animated tab/scroll
  boundaries.
- **Translation tabs no longer collide on mobile.** The Translation card's
  animate-ui tabs now stack on narrow screens with shortened labels and animated
  trigger icons, then return to the three-column segmented control on larger
  screens.
- **Shared select/dropdown indicators no longer leak animation props.** Removed
  direct `animateOnHover` props from state-indicator icons so shared primitives
  follow the documented parent-wrapper animation pattern without React DOM
  warnings.
- **Ticket detail dialog icon triggers follow the animation rules.** The close
  button now wraps its animated icon at the interactive parent, while static
  metric icons no longer advertise hover animation.

### Changed

- **Admin configuration tools moved behind Advanced accordion.** Added the
  local animate-ui radix Accordion wrapper and grouped Set operating hours,
  Rotate display languages, Announcement, and Translation inside a collapsed
  `Advanced` section so the daily admin view focuses on operational controls.
- **System reset card layout clarified.** Moved the reset confirmation input and
  Reset for New Day action directly under the card description, with snapshot
  cleanup controls anchored lower in the card so the destructive daily reset
  flow is visually distinct from maintenance cleanup.
- **Announcement and Translation cards now marked Beta.** Added `Beta` pills to
  both card headers so staff understand these staged authoring/localization
  sections are still under active development and refinement.
- **AI Configuration now ports FEED's model/prompt setup workflow.** The Add
  Configuration action now opens the FEED-style type picker so staff can create
  either an encrypted AI model configuration or a reusable System Prompt. System
  prompts and AI models now use a FEED-derived `BaseAIConfigDialog`,
  `StepWrapper`, step-definition factory, and per-step component structure
  instead of LOTTO-local monolithic wizard panels. Saved prompts feed translation
  requests while the hard-coded LOTTO translation prompt remains the fallback
  when no active prompt exists. The System Prompt modal now offers LOTTO's three
  intended prompt categories — UI Translations, Inventory, and Announcements —
  instead of FEED's Custom Translation / document classification taxonomy. The
  type-picker Prompt card and System Prompt flow use FEED's animated
  `MessageSquareQuote`, `SlidersVertical`, and imperative `FileText` icon
  patterns instead of LOTTO-local substitutes; the AI Parameters step now uses
  FEED-style sliders, the unused Endpoint URL field was removed, and the AI
  Model type-picker card now uses FEED's imperative `CpuIcon`.
- **Translation AI FEED parity rule documented.** Added
  `docs/TRANSLATION_AI_FEED_PARITY.md` and updated `AGENTS.md` to require a
  FEED-first porting approach for Translation AI UI: port FEED component
  structure and missing icons/utilities first, then adapt only app-boundary or
  documented LOTTO design differences.
- **Translation Management Add Translation now matches FEED fan-out behavior.**
  The Add Translation dialog now collects one English custom string, validates
  a 3–1,800 character range with a visible counter, and submits it for
  every enabled non-English language instead of requiring staff to pick one
  language at a time.
- **Translation Management table now uses a FEED-derived table foundation.** The
  table is a single TanStack instance with responsive column visibility,
  sorting/filtering, bulk actions, dropdown row actions, truncation dialogs, and
  a fixed-height scroll shell whose header stays sticky while rows scroll. It
  now uses the FEED pagination controls with a 25-row default, keeping the scroll
  viewport capped while limiting very large result sets.
- **AI Configuration list now uses the FEED row-action pattern.** The inline
  validate/edit/delete buttons were replaced by `TableActionMenu`, keeping
  mobile rows compact and action menus stable. It shares the same FEED
  pagination controls and 25-row default as Translation Management.
- **AI Configuration wizard default.** New AI configurations now default to
  Google `gemini-2.5-flash-lite`, with the existing cost/token template applied,
  and wizard step hero icons animate on reveal/hover to better match the FEED
  modal pattern.

### Added

- **Expanded localization — visitors see dynamic languages (v2.0, Feature 4).**
  The client bridge that completes the AI translation stack: `t()` now resolves
  hand-authored translation → DB-translated pack → English → key, so a newly
  enabled language (e.g. Bosnian) localizes the entire visitor UI once its pack
  is complete. New public endpoints: `GET /api/translations/pack?code=<bcp47>`
  (completed UI-string translations + the translated active announcement for one
  language) and `GET /api/languages?client` (the eight core languages plus
  enabled catalog languages whose packs are complete — "active when complete").
  The language switcher and onboarding language step list dynamic languages with
  native labels (loaded lazily when the picker is used) and gain a scroll bound
  past 10 options; the onboarding announcement renders in the visitor's language
  with English fallback. Dynamic languages use their BCP-47 code with Intl for
  dates, English fallback for wait-time phrasing, and FEED's public inventory
  translations by catalog name — so inventory already translated in FEED appears
  for newly enabled languages. Urdu added to the RTL set.
- **FEED-derived table UI primitives for Translation surfaces.** Added
  `EnhancedDataTable`, `TableActionMenu`, `ResponsiveTruncatedText`, table
  truncation utilities, FEED-style pagination controls, `useIsMobile`, and the
  native animate-ui icons needed for translation tabs/toolbars/action menus.
  Covered by `tests/enhanced-data-table.test.tsx`.
- **Translation admin card — Translation Management (v2.0, Feature 3 increment 3).**
  The third tab ports FEED's Translation Management on LOTTO's primitives: a
  filterable table (language / type / status) of translations with per-row
  edit/retry/delete, bulk retry/delete, **Find missing** (audits UI strings +
  the active announcement across enabled languages and queues the gaps), and
  **Recover stuck** (re-runs translations stuck in pending). A dependency-free
  translation engine calls the active AI provider over REST (OpenAI / Anthropic /
  Google); results are stored with a pending/completed/failed status in the new
  `translations` table behind a file/Postgres-selectable store. The auditor only
  flags UI strings for _newly enabled_ languages (the eight core languages keep
  their hand-authored translations) while announcements are translated for every
  enabled language. New `/api/translations` routes (list, add, correct, delete,
  retry, bulk-retry, bulk-delete, find-missing, recover-stuck, metrics). English
  UI strings moved to a shared `src/lib/ui-strings.ts` module. The **Find Missing
  Translations** modal is a faithful port of FEED's enhanced dialog: a pre-scan
  "what this will do" card with an animated progress bar, then Overview / Details
  / Languages tabs with per-content-type counts, per-type selection, and a
  queue-and-translate action (the API accepts a `types` filter).
- **Translation admin card — AI Configuration (v2.0, Feature 3 increment 2).**
  The AI Configuration tab lets staff add, edit, validate, and delete AI provider
  configurations (OpenAI, Anthropic, Google) via a **multi-step wizard** and a
  table list, reproducing FEED's layout on LOTTO's primitives — name, model, API
  key, cost, and token limits. Model selection uses **pre-baked templates**
  (ported from FEED's model-specs) in a dropdown that auto-fills cost and token
  limits per model, plus a "Custom" option for any model id. API keys are
  **encrypted at rest** (AES-256-GCM with a per-record
  salt; master key from the `ENCRYPTION_MASTER_KEY` env var) and never returned
  to the client. A "Test"/validate action checks a key against the provider's
  models endpoint. New `/api/ai-config` routes (list/create/update/delete +
  `/validate`), an encryption module, and a file/Postgres-selectable config store
  (mirroring the state manager, so local file-mode dev works without a database).
- **Schema migration runner.** `scripts/apply-schema.mjs` (+ `npm run db:migrate`)
  applies the idempotent `schema.sql` (and optionally `schema.arcade.sql` via
  `--arcade`) to any Postgres target using the standard wire protocol — works
  for both local Docker Postgres and Neon. Each file applies inside a single
  transaction (atomic, all-or-nothing) and supports `--dry-run` to verify a clean
  apply against production (Neon) without writing. See `docs/DEPLOYMENT_MIGRATION.md`.
- **Translation admin card — Language Settings (v2.0, Feature 3 increment 1).**
  A new **Translation** card on the Admin page with a three-tab control
  (Language Settings · AI Configuration · Translation Management; the latter two
  arrive in upcoming increments). The Language Settings tab lists the full
  60-language catalog (ported from FEED) with native labels, search, and
  select-all/reset; the eight core languages are always on. Enabled languages
  persist via a new `languages` table behind a file/Postgres-selectable store
  (mirroring the state manager) and a session-gated `/api/languages` route.
  Newly enabled languages stay hidden from visitors until their translations
  exist (added in a later increment). New `schema.sql` tables for the AI
  translation stack (`languages`, `ai_configurations`, `system_prompts`,
  `translations`, `usage_records`).
- **Announcement builder (v2.0).** Staff can compose an announcement from the
  Admin page using a small editor with formatting buttons (Title toggle, Bold,
  Italic, bulleted/numbered lists). The editor defaults to a **Live Preview** that
  is editable while showing formatting (WYSIWYG via Tiptap), with an **Edit Code**
  view for direct Markdown — toggled by an animated `animate-ui` tabs control — so
  no Markdown knowledge is required. Announcements are capped at **1,800
  characters** (spaces included) with a live `n/1,800` count, and long drafts
  scroll within the editor. Unsaved drafts persist in browser storage, so they
  survive switching to another app or tab (a focus-driven state refresh no
  longer wipes the editor). An optional show-from / hide-after schedule is
  supported. One announcement is stored at a time (`RaffleState.announcement`,
  new `setAnnouncement` action). When active, it appears as a third onboarding
  step on the homepage (after language, before ticket), shown once per browser
  session and rendered with the shared Markdown renderer. New
  `src/components/{markdown-editor,announcement-editor}.tsx`,
  `src/lib/announcement.ts`, a `docs/user-guides/09-markdown-formatting.md` help
  guide, and an in-editor link to it. (Underline was deferred — Markdown has no
  native underline and it needs an extra dependency.)

### Fixed

- **Homepage announcement modal scrolls long content.** Long announcements no
  longer overflow the dialog or cover the Continue button — the message area is
  a bounded, scrollable region with the action pinned below it.
- **Help table-of-contents contrast in dark mode.** The active/hover TOC entry
  used the yellow accent background with white text; it now uses the accent
  foreground color, and help search results use a neutral hover background.
- **Admin "Next up" no longer lists returned tickets.** Returned numbers are
  skipped during queue advancement, so they're now excluded from the Next up
  card (the next five genuinely upcoming numbers are shown).

### Changed

- **Admin: replaced the vestigial "Back" button with a "Help" button** (animated
  `CircleHelp` icon, links to `/help`) now that the login/nav flow is in place.
  The bottom navigation (public or authenticated variant) now also appears on the
  Help pages (`/help`, `/help/[slug]`).

### Added

- **Staff login + authenticated navigation (v2.0):** the `/staff` route is now a
  sign-in screen (the former marketing landing was retired); already-authenticated
  visitors are redirected to `/admin`. `/login` and `/staff` share one login
  experience (`src/components/login-experience.tsx`) with a version/About/Help
  footer. Signed-in staff get an enhanced bottom navigation variant —
  **Admin** (`/admin`), **Dashboard** (`/display`), **What's in stock**
  (`/inventory`), **Games** (`/arcade`) — using the same component, animation
  rules, and (for Admin) a new animated `LayoutPanelTop` icon. The variant is
  driven by a lightweight `StaffAuthContext` bridged from NextAuth via a new
  `AuthSessionProvider`; unauthenticated visitors keep the existing public nav.
  The bottom nav now also persists on `/admin`, and the arcade-styled bar gains a
  matching pixel Admin glyph.
- **Ticket-status revert (v2.0):** Returned and Unclaimed ticket numbers in the
  admin Live State lists are now tappable. Tapping one opens a confirm dialog
  ("Revert Returned/Unclaimed Ticket") that clears the status, returning the
  ticket to its normal state without rewinding the current "now serving"
  position. Adds a `revertTicketStatus` API action + state-manager support
  (file + Neon), optimistic UI, and tests.
- **Polished, promotion-ready README** with app screenshots
  (`docs/screenshots/`) — including **dark mode** and **localized** boards
  (Chinese, Russian, Arabic/RTL) — a feature/audience overview, quickstart, tech
  stack, and license summary, modeled on the FEED project. The previous
  operational runbook (env vars, Vercel + Neon production setup, standalone
  read-only board, persistence) moved to [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
  GitHub repo description and topics were also set.
- **`npm run screenshots`** — a reproducible screenshot generator
  (`scripts/screenshots.mjs`) that drives the installed Chrome via `puppeteer-core`
  (dev dependency, no bundled browser) to capture each surface at a pinned theme
  and language.

### Changed

- **Help detail layout:** aligned the desktop "On this page" sidebar with the
  guide article card on initial page load while preserving its sticky scroll
  behavior.
- **License: relicensed from MIT to AGPL-3.0-or-later**, matching the FEED
  project. The `LICENSE` file now contains the GNU AGPL v3 text, `package.json`
  declares `"license": "AGPL-3.0-or-later"`, and every `.ts`/`.tsx` source file
  carries an SPDX header. A new `TRADEMARKS.md` carves the William Temple House
  name, logos, visual identity, and production domain out of the code license
  (they are not open source), and the About modal now shows the AGPL license plus
  a short open-source/branding notice. Third-party and WTH-branding assets are
  unaffected by the code license.

### Added

- **Staff page: Release Notes modal, About modal, and searchable Help.** Adapted
  from the FEED project. The version number on `/staff` is now a button that
  opens a plain-language **release notes** modal (content in
  `docs/release-notes.md`); the old static credits line is replaced by an
  **About** modal (`src/components/about-dialog.tsx`) matching FEED's format —
  theme-aware Temple Consulting logo (`public/temple-logo-{light,dark}.svg`),
  a GitHub source link, a transparent dialog whose inner card is the surface, and
  an explicit close button (also added to the release-notes modal); and a new
  **Help** link
  opens a searchable, indexed help section at `/help` (index) and
  `/help/[slug]` (per-topic detail) with table of contents, scroll-spy,
  deep-linkable sections (`?q=…#section`), and search-term highlighting. Help
  content is authored as markdown in `docs/user-guides/NN-*.md`; the parser and
  section-level search index live in `src/lib/user-guides.ts` (pure, tested) with
  a server-only filesystem loader in `src/lib/user-guides.server.ts`. Markdown is
  rendered with `react-markdown` + `remark-gfm`. Help/release/about content is
  English-only, matching the Staff page. See `docs/HELP_SYSTEM.md`.
- **Ticket-called celebration on every public route:** the confetti + "Ticket
  Called!" overlay now fires wherever a client with a saved ticket happens to be
  — homepage, the `/display` board, and the inventory page — not just the
  homepage. It is extracted into a shared `TicketCalledCelebration` component
  (`src/components/ticket-called-celebration.tsx`): the homepage and display
  board feed it their already-polled state, while inventory self-polls
  `/api/state`. A wall-mounted board stays silent because it has no session
  ticket. The celebration dedups per call across navigation via `sessionStorage`
  (`src/lib/ticket-celebration.ts`), so a single call celebrates exactly once no
  matter how many pages the client visits while it is active. `ReadOnlyDisplay`
  no longer owns the overlay/confetti (it still renders the persistent
  "called at HH:MM" message); Arcade keeps its own separate celebration per the
  Arcade guardrails. The overlay copy is localized in all eight supported
  languages (`ticketCalledTitle` / `ticketCalledCheckIn`).
- **Dashboard bottom-nav tab:** added a new **Dashboard** destination between
  **Your ticket** and **What's in stock** in the public bottom navigation,
  linking to `/display`. The core bar uses a native imperative `grip` icon so
  nav hover/tap animations replay without remount stutter, the Arcade bar gets
  a matching pixel-art dashboard glyph, and `/display` now renders the bottom
  nav with scroll clearance.

### Changed

- **Homepage onboarding step selection:** the personalized homepage (`/`) no
  longer re-prompts for a language once one has been chosen this browser session.
  The onboarding modal now decides its initial step after language hydration: a
  saved ticket keeps it closed, an existing session language opens it directly at
  the ticket step, and only a first-time visitor sees the language gate.
- **Display nav auto-hide:** the bottom navigation on `/display` now hides after
  a period of inactivity and reappears on any pointer/keyboard/touch activity.
  The inactivity window matches the Admin display-language rotation interval when
  rotation is enabled, otherwise falls back to 5 minutes. Auto-hide is scoped to
  `/display` only — the homepage, inventory, and Arcade keep a persistent bar —
  and honors `prefers-reduced-motion` by toggling visibility without the slide
  transition.
- **Homepage RTL layout scope:** constrained Arabic/Farsi directionality so the
  homepage top chrome, public bottom-nav item order, and personalized display
  structural card grids remain in the same physical order while localized text
  containers still render RTL where appropriate.
- **Display RTL layout scope:** constrained the display ticket/drawing card
  chrome so the `DRAWING ORDER`/ticket heading and `Updated: HH:MM` badge keep
  their physical left-to-right layout, and ticket number cells keep stable grid
  order with a matching left-to-right status key while the card body can still
  localize.
- **Bottom nav dock offset:** standardized the desktop/tablet bottom-nav offset
  across home, Dashboard, inventory, and Arcade so the dock no longer jumps
  vertically between public routes.
- **Admin "Rotate display languages" interval:** replaced the freeform minutes
  input with a dropdown from 1 to 10 minutes per language, with the interval
  label folded into each option.
- **Display language switcher during rotation:** the `/display` language
  switcher now stays visible while Admin rotation is enabled. A manual language
  choice pauses automatic rotation for that browser session without changing the
  saved Admin setting.
- **Session language continuity:** manual language choices now persist for the
  browser session when navigating between public routes. If a client chooses a
  language on the homepage and then opens Dashboard (`/display`), that choice
  takes precedence over Admin language rotation; explicitly choosing English also
  counts as a session override.
- **Display language rotation validation:** direct API writes now reject
  duplicate languages and intervals outside 1-10 minutes, and normalize language
  order before persistence.

### Fixed

- **Display language rotation disable behavior:** an already-open `/display`
  board now returns to English when rotation is disabled or cleared.

## [1.17.2] - 2026-06-04

### Changed

- **Admin "Rotate display languages" card:** bottom-left aligned the "Save
  language rotation" button so it lines up with the "Save operating hours" button
  in the adjacent card.

## [1.17.1] - 2026-06-04

### Fixed

- **Display QR default target:** the QR code on the `/display` board now falls
  back to the site homepage (`/`, the personalized onboarding) instead of the
  board's own URL, so scanning sends clients somewhere useful rather than back to
  the screen they are already looking at. A custom Admin display URL still
  overrides the default.

### Changed

- **Admin "Rotate display languages" card** now follows the established admin UX
  patterns: the enable toggle reuses the bordered control treatment from "Order
  mode" with a non-redundant label (no longer repeating the card title and
  description), the language picker uses plain checkboxes (not bordered chips),
  and the card sits in the settings grid beside "Set operating hours" instead of
  a standalone full-width row.

## [1.17.0] - 2026-06-04

### Added

- **Rotating language mode for the Display board:** the Admin page gains a
  "Rotate display languages" control (enable toggle, language multi-select, and a
  minutes-per-language interval). When enabled, the large-format `/display` board
  automatically cycles its UI through the selected languages on the configured
  timer so non-English-speaking clients can read it without interacting — an
  inclusive, equity-minded default. Languages rotate in canonical order; each
  switch reuses the board's existing scramble transition and flips RTL for
  Arabic/Farsi.
  - **State:** new nullable `displayLanguageRotation` (`{ enabled, languages,
intervalSeconds }`) on `RaffleState` with a `setDisplayLanguageRotation`
    action (Zod-validated language enum + bounded interval), persisted by both
    state managers and preserved across draw reset/generate. Back-compatible via
    the existing `{ ...defaultState, ...payload }` merge (no migration).
  - **Display scope:** `/display` is now wrapped in a non-persisting
    `LanguageProvider` (`persist={false}`) so rotation drives the board language
    without writing the shared `display-language` preference or affecting the `/`
    homepage. New `useDisplayLanguageRotation` hook (mounted only by
    `PublicDisplayPage`) runs the timer; the manual language switcher is hidden
    while rotation is active.
  - **Shared list:** added `src/lib/languages.ts` (`LANGUAGE_CODES` /
    `LANGUAGE_OPTIONS`), reused by the onboarding modal, the Admin editor, and the
    rotation Zod schema.
- **Docs/tests:** added `docs/DISPLAY_LANGUAGE_ROTATION.md`; coverage for the
  rotation hook (timer cycling), the Admin editor, the API action validation, and
  state-manager persistence/preservation.

## [1.16.0] - 2026-06-03

### Changed

- **Personalized homepage promoted to `/`:** the language + ticket onboarding
  experience (formerly the `/new` preview) is now the default homepage,
  fulfilling the long-planned promotion tracked in
  `docs/V2.0_PLANNED_FEATURES.md`. The searchable public board now lives solely
  at `/display`, and the **Your ticket** bottom-nav tab (core and arcade bars)
  points to `/`. The view moved into a reusable
  `src/components/personalized-home-page.tsx` (`PersonalizedHomePage`) wrapped by
  the server route `src/app/page.tsx`, mirroring how `/display` wraps
  `PublicDisplayPage`.
- **Friendlier "just looking" escape hatch:** the onboarding modal's dismiss
  action is now the concise **"I'm just looking"** rendered as a prominent
  secondary button (was a long, muted ghost link), shortened across all eight
  languages. The ticket step now adds a close (X) and supports Escape /
  tap-outside dismissal, while the language step stays a focused gate (no
  dismissal until a language is chosen).
- **Tests:** repointed the homepage suites to
  `@/components/personalized-home-page` and added coverage for the ticket-step
  close/Escape dismissal and the language-step gate.

### Removed

- **`/new` route:** retired now that its experience is the homepage —
  `src/app/new/page.tsx` and `src/app/new/layout.tsx` are deleted and `/new` no
  longer resolves. Operators should confirm the board's configured display/QR
  URL no longer targets `/new`, and repoint any kiosk that showed the board at
  `/` to `/display`.

## [1.15.4] - 2026-06-01

### Added

- **Pride-month leaderboard seed:** `seed.arcade-high-scores.sql` preloads the
  arcade Top 10 with a tribute roster of civil rights icons and LGBTQ+, queer,
  trans, Two-Spirit, and nonbinary activists across every game and difficulty.
  Idempotent: it clears and re-seeds only its own marked rows and never touches
  live player scores.

### Changed

- **Brick Mayhem cabinet polish:** the on-board Top 10 now shows only on the
  pristine first serve and at game over. Between lives and levels (which also
  return to READY) the playfield stays clear so players can aim the next serve.
- **CSS cleanup:** removed the now-unused per-game `.arcade-{snake,brick,zombie}-overlay`
  game-over overlay styles, superseded by the shared cabinet screen.

## [1.15.3] - 2026-06-01

### Changed

- **Arcade cabinet leaderboard:** the Top 10 now renders directly on the play
  area as an arcade-cabinet screen — an attract-mode high-score table at READY
  and a unified GAME OVER screen (score + initials entry + Top 10 + replay) at
  game over — instead of a separate panel beneath the board. Applied
  consistently to Snake, Brick Mayhem, and Day of the Dead.
- **Restart safety / a11y:** replaced tap-anywhere-to-restart with an explicit
  "TAP HERE TO PLAY AGAIN" button so the initials input is usable without
  accidentally restarting the run (keyboard restart unchanged), and removed
  `role="img"` from the boards so the entry field stays reachable to assistive
  tech.

## [1.15.2] - 2026-06-01

### Changed

- **Arcade leaderboard prominence:** enlarged the shared Top 10 Scores panel,
  featured the #1 score as a cabinet-style champion row, and highlighted newly
  saved scores at game over so high scores read as bragging rights rather than
  small status text.
- **Lint cleanup:** removed the remaining ESLint warnings by clearing stale
  imports/mock parameters and tightening admin/display hook dependencies.

## [1.15.1] - 2026-06-01

### Changed

- **Arcade production visibility:** Day of the Dead is preserved in the codebase
  but hidden from the Arcade menu and redirected from `/arcade/zombie-attack` in
  production. Snake and Brick Mayhem remain publicly linked.
- **Docs and tests:** updated Arcade current-state docs and added coverage for
  the hidden production route and public game menu.

## [1.15.0] - 2026-06-01

### Added

- **Arcade Top 10 Scores:** Snake, Brick Mayhem, and Day of the Dead now show per-game/per-difficulty leaderboards before start and at game over.
- **High-score entry:** qualifying game-over scores get a 30-second, 3-initial entry flow with multilingual letter support and no profanity denylist.
- **Isolated Arcade database:** added `schema.arcade.sql`, `ARCADE_DATABASE_URL`, an Arcade-only high-score store, and public `/api/arcade/high-scores` GET/POST routes. The leaderboard database is separate from the core LOTTO queue/auth `DATABASE_URL`.
- **Docs and tests:** added `docs/ARCADE_HIGH_SCORES.md`, deployment notes for the separate Neon project, and unit/API/component/page coverage for leaderboard validation and UI integration.

### Fixed

- Cleaned up the existing `tests/state-manager-db.test.ts` `prefer-const` lint blocker so full lint can pass.

## [1.14.5] - 2026-05-31

### Changed

- **Day of the Dead HUD color follow-up:** `ROUND`, `LIVES`, and `SCORE` now match the `SETTING: ...` / instruction-list text color instead of the green pellet color.
- **Docs:** updated the Day of the Dead design doc and Arcade current-state notes for the HUD color behavior.

## [1.14.4] - 2026-05-31

### Changed

- **Day of the Dead visual polish:** player bullets now render `#FFAA00`; the extraction victory overlay text (`EXTRACTION COMPLETE!`) now renders `#00FF00`; and the "DIFFICULTY SETTING" / `SETTING: ...` text now matches the instruction-list color.
- **Docs:** updated the Day of the Dead design doc and Arcade current-state notes to capture the bullet, victory-text, and settings-text color behavior.

## [1.14.3] - 2026-05-31

### Changed

- **Day of the Dead instructions** refreshed (all eight languages): "HOLD A TO FIRE", "STOP ZOMBIES AT THE FENCE" (was the stale "bunker line"), and "SHOOT ROGUE AMBULANCES AND BUB'S GRENADES FOR A BLAST".
- **Page metadata audit.** Unified the app brand to **"William Temple House App"** via a root title template (replacing the old `WTH Digital Raffle` / `LOTTO:` strings), and gave the main routes tailored, friendlier titles + descriptions: Home, **Arcade** ("Retro arcade games while you wait"), **Display**, **What's in Stock** (`/inventory`), **Your Ticket** (`/new`), and **Admin**. So tabs now read e.g. "Arcade | William Temple House App".

## [1.14.2] - 2026-05-31

### Changed

- Renamed the game's display title from _Zombie Attack!_ to **"Day of the Dead"** — a tribute to George A. Romero's 1985 film (the namesake of the Bub soldier zombie). Updated the title across all eight languages (localized for Chinese / Persian / Arabic) and the play-area labels. The internal slug (route `/arcade/zombie-attack`, modules, CSS, and translation keys) is unchanged.

## [1.14.1] - 2026-05-31

### Added

- **Zombie Attack! evacuation reward:** completing an extraction now grants bonus lives, scaled by difficulty — Very Easy / Easy / Normal **+1**, Hard / Very Hard **+2**, Nightmare **+3**.

## [1.14.0] - 2026-05-31

### Changed

- **Zombie Attack! render order:** the living zombies now draw newest-first, so freshly-spawned zombies sit **behind** older ones (matching the top-down depth).

### Added

- **Per-difficulty parameters** (defined relative to the Normal baseline):
  - **Very Easy:** ½ spawn rate, civilians never revive, ×0.5 score.
  - **Easy:** ½ spawn rate, ×0.75 score.
  - **Normal:** the baseline.
  - **Hard:** 2× zombie speed (the walk animation now tracks speed, so they animate 2× faster too), ×2 score.
  - **Very Hard:** 2× speed, 4× Bub spawns, ×3 score.
  - **Nightmare:** 2× speed, 4× Bub spawns, Bub never drops a grenade, **no protective fence**, ×4 score.
  - The zombie walk/idle animation cadence is now derived from the actual move speed (per-difficulty and per-cycle), so faster zombies always animate faster.

## [1.13.1] - 2026-05-31

### Changed

- Slowed the zombie walk/idle animation cadence (220ms → 440ms) so their stride matches the halved movement speed from 1.13.0. The hero's animation cadence is unchanged.

## [1.13.0] - 2026-05-31

### Changed

- **Zombie Attack! — fence siege.** The fence is now a solid sprite barrier with
  **10 HP** instead of a sandbag count. Zombies that reach it go **idle and besiege
  it**, each with a `(zombies-at-the-fence × 10%)` chance per turn to land a hit —
  so the odds **stack with the crowd**. Once breached, the fence sprite tears open
  from the centre (`fence-breach-*` tiles) and zombies **pour through toward the
  helo**. The helicopter now correctly draws **over** the fence (layer fix), and
  the **hero is repositioned up by the fence** for a tighter last stand.
- **Probabilistic kills.** A civilian hit is now 50% kill / 50% wound (hurt
  animation), and a killed civilian has a **10% chance to get back up** (death
  animation in reverse). **Bub** takes his first two hits as wounds, then each
  further hit has a 50% kill chance, a **25% revive** chance, and a 25% grenade
  drop.
- **Baseline (Normal) tuning:** doubled the zombie spawn rate and halved their
  move speed across all difficulty presets (other settings scale from Normal;
  per-difficulty tuning comes next).

### Added

- **Melee siege threats:** breached zombies **maul the hero at close range** (a
  life per turn, with invulnerability between hits) and **wreck the helo** if they
  reach it (10%/turn → game over — the helo has no health). The ambulance now
  **explodes on impact with the fence** (clearing nearby zombies) and is an
  instant **game over if it reaches the helo** through a breach.
- Idle / attack / hurt zombie sprites and the six fence sprites wired in; engine
  test rewritten for the siege (`tests/arcade-zombie-attack-engine.test.ts`, 11
  deterministic cases via the RNG seam).

## [1.12.1] - 2026-05-31

### Changed

- **Zombie Attack! polish.** Gave the helicopter a full per-phase animation: an
  in-flight rotor (takeoff-1/2) on the inbound approach, a touchdown sequence
  (takeoff-5 → 4 → 3 → spin-up → idle) on landing, a spin-up alternation
  (spin-up / takeoff-2) while boarding, and a takeoff sequence (in-flight →
  lift-off 3/4 → ascent 6/5 → in-flight, climbing away) that the chopper flies
  out on. Lift-off now holds on the pad briefly before the climb.
- Made the play area **much larger on desktop** (board cap raised, bound by the
  vertical budget so the tall board fills the screen).
- **Light mode** now draws a **light dirt lot** (and lighter sandbags/terrain) so
  the action reads clearly; the board repaints on theme change.
- **Bub** now mostly **shambles like the other zombies** and only fires
  occasionally — and he's **provoked by line of sight**: standing directly below
  him draws a straight shot, standing at ~45° draws an angled shot, and he rarely
  fires when you're not lined up. He only shows the firing pose right after a shot.

## [1.12.0] - 2026-05-31

### Changed

- Overhauled **Zombie Attack!** from a side-to-side shooter into a **top-down survival** game on a taller 240×360 board (`aspect-ratio: 240/360`). The renderer now blits preloaded **NES-era PNG sprites** (`drawImage`, nearest-neighbour) instead of string-bitmaps; sprite assets live in `src/arcade/game/zombie-attack/assets/` and are statically imported + preloaded (`assets.ts`). The old `sprites.ts` was removed.
- Zombies now **spawn at the top and shamble downward**, each picking a **stochastic per-step direction** (50% straight down, 25% each 45° diagonal). Most zombies no longer shoot — the threat is sheer numbers reaching the bunker line.
- The player is now a **top-down hero with an Uzi** (rapid fire, up to 3 tracers on screen). Civilian zombies are four varied **street-clothes sprites** (NES-era, not Atari-flat).

### Added

- **Bub** — a zombie soldier (Day of the Dead homage) in fatigues + helmet: takes **2 shots**, fires a 1911 in a stochastic down/down-left/down-right spread (Bub bullets cost the hero a life), and has a **50% chance to drop a live grenade** on death. Shoot the dropped grenade to detonate an **AoE blast** that clears nearby zombies. Bub spawns occasionally (more often on Nightmare).
- **Helicopter + helipad** at bottom-centre, driving a **time-based 4-round cycle**: (1) clear the pad / chopper inbound, (2) refueling, (3) boarding, (4) takeoff. Survive each round's clock to advance; completing round 4 **extracts the chopper** (a rescue), clears the lot, and loops the cycle at higher difficulty. The helicopter animates per round (idle → refuel → spinup → takeoff frames, climbing away on lift-off).
- **Ambulance** hazard that drives down a lane; shoot it (3–6 hits by difficulty) to blow it up, clearing nearby zombies.
- A **bunker-integrity** buffer: each zombie that reaches the bunker line is absorbed; once the line is overrun the pad falls (game over). Integrity is repaired on each extraction. Lives are still lost to Bub's bullets; 0 lives also ends the run.
- HUD for the new loop: a **round-objective banner**, a 2×2 ROUND / TIME / LIVES / SCORE readout, and a slim **round-timer bar**. Difficulty presets now tune spawn rate, descent speed, Bub frequency, bunkers, and ambulance toughness (Nightmare keeps the bunker death-line but draws no sandbags). Localized across all eight languages; engine test rewritten as `tests/arcade-zombie-attack-engine.test.ts` (9 cases). Docs updated in `docs/ZOMBIE_ATTACK.md`.

## [1.11.0] - 2026-05-30

### Changed

- Re-themed the Arcade's third game from _Star Swarm_ into **Zombie Attack!** — a last-stand against a shambling horde — and renamed its route, modules, CSS, and translation keys (`/arcade/star-swarm` → `/arcade/zombie-attack`, `src/arcade/game/star-swarm/*` → `zombie-attack/*`, `arcade-swarm-*` → `arcade-zombie-*`, `starSwarm*` → `zombieAttack*`). Design doc renamed `docs/STAR_SWARM.md` → `docs/ZOMBIE_ATTACK.md`.
- Replaced the alien sprites with three **zombie builds** (skinny, ribs-exposed, fat), each with a two-frame shamble, and swapped the starfield for a **dirt-lot** background (deterministic pebbles, clods, dead grass, and rocks). The gun, shots, and bursts still follow the theme via CSS custom properties; the dirt/undead/fire/wood/sandbag tones are intentional constants.
- Made the **play area 25% taller** (board `224 × 224` → `224 × 280`, `aspect-ratio: 224/280`) and re-tuned the responsive board sizing to fill the available height, reducing wasted space above the game on small phones.
- Simplified the fire control to a compact **"A"** button (hold to autofire), widening the movement slider; masked text selection (`user-select: none` + `touch-action: none`) on the Play/Fire/dock surfaces so a held or dragged press never highlights a label mid-game.

### Added

- **Fence** — a wooden barrier in front of the bunkers that the horde presses on. Its health drains faster the more zombies are pressing (`alive × 2` per step); when it collapses the horde breaks through toward the bunkers. Reaching the bunker line is game over. The fence is rebuilt each wave.
- **Flaming vehicle** — a burning truck periodically barrels straight down toward the fence. It takes 3–5 shots to destroy (by difficulty, 250 pts); if it reaches the fence it crashes through and collapses it instantly.
- **Bomb-carrier zombies** — a few zombies each wave carry a bomb (red marker + fuse). Shooting a carrier drops its bomb in place; shooting the dropped bomb detonates a blast (~25% of the board area) that wipes out every zombie inside it.
- **Difficulty rules:** Nightmare now has **no bunkers** (the fence remains; the bunker location is still the game-over line); Very Easy makes bunkers **bomb-proof** (eroded only by the player's own shots, never by enemy bombs).
- Rewrote the engine unit test as `tests/arcade-zombie-attack-engine.test.ts` (11 cases): zombie scoring, carrier bomb-drop, blast AoE (with a distant zombie spared), vehicle HP, thrown-bomb life loss, horde-reaches-bunkers game over, wave-clear + fence rebuild, bomb-proof vs. eroding bunkers, no-bunker difficulty, and the shot cooldown/cap.

## [1.10.0] - 2026-05-29

### Added

- Added **Star Swarm**, the Arcade's third game — a fixed-shooter in the Space Invaders lineage. Pilot a ship along the bottom of a square pixel-art board, hold FIRE to shoot, and clear a descending formation of 40 invaders (five color-tiered rows) before they reach you. Includes destructible bunkers, invader bombs (which can be shot down mid-air), a periodic bonus saucer worth 50–300 points, post-hit invulnerability blink, escalating formation speed as the swarm thins, and endless waves that ramp difficulty. Six difficulty presets (Very Easy → Nightmare) tune the march cadence and bomb frequency.
  - Built on the same pure-engine + `requestAnimationFrame` fixed-timestep architecture as Brick Mayhem (`src/arcade/game/star-swarm/`: `constants`, `types`, `sprites`, `engine`, `renderer`), with the canvas palette driven by the active arcade theme's CSS custom properties so it follows light / dark / hi-viz automatically.
  - Mobile-first controls: a sticky bottom control dock with a thumb slider to move the ship and a large hold-to-autofire FIRE button (keyboard ←/→ + Space/↑ also supported). Pauses automatically when a raffle ticket is called, matching Snake and Brick Mayhem.
  - Localized across all eight languages (title, five instructions, difficulty labels, FIRE, and the WAVE readout). Added to the `/arcade` game menu and documented in `docs/STAR_SWARM.md`.
  - Covered by a deterministic engine unit test (`tests/arcade-star-swarm-engine.test.ts`): shot/invader scoring, wave-clear and next-wave progression, bomb-vs-ship life loss + invulnerability, game-over on last life and on formation breach, and the shot cooldown / on-screen shot cap.

## [1.9.0] - 2026-05-29

### Added

- Added a frosted-glass treatment to the ticket-detail modal (shown when tapping a ticket cell on `/` or `/display`), matching the `/new` onboarding dialog so all dialogs share one material.
- Split a dedicated **Current Time** card out of the service card on the display board, with a new `currentTime` translation key across all eight languages.
- Added a `--gradient-status-success` token and `.bg-gradient-status-success` utility, plus dedicated high-contrast cell-number text tokens (`--ticket-unclaimed-text` vibrant yellow `#ffffaa`, `--ticket-returned-text` soft pink `#ffeeee`) reused by both the display cells and the `/admin` Live State boxes.

### Changed

- Reoriented the display-board "Now Serving" (`--ticket-serving`) and "Called" (`--ticket-served`) ticket-cell gradients from diagonal to bottom→top, so the whole board (including returned/unclaimed) shares one gradient direction.
- Reworked the **dark-mode display board** color system: Now Serving is a deep→medium blue cell with white numerals; Called is green/teal with mint numerals; Unclaimed is gold with vibrant-yellow numerals; Returned is red with soft-pink numerals. The large "NOW SERVING" page numeral is light powder blue. The light-mode Called cell gained a deep-teal numeral and a more pronounced gradient.
- Made the `hi-viz` accessibility themes **fully flat** — every fill gradient (card, feature, status, ticket-cell, and serving-text) is overridden to a solid color for high-contrast legibility, in both the light and dark hi-viz variants.
- Reduced the title→content vertical spacing on the top display stat cards.
- `/admin` dark mode: the mark-ticket-as-returned/unclaimed number inputs now use a solid neutral fill matching the other admin inputs (no gradient bleed-through); the Returned/Unclaimed alert-box titles and ticket-number badges use the high-contrast cell colors; the **Next up** card gained its bottom→top gradient (both modes) and a mint-green title in dark.
- Inventory's top control bar no longer swaps the language/theme switcher placement in RTL — it now stays Language-left / Theme-right, consistent with `/`, `/display`, `/new`, and `/arcade`.
- Unified all surface fill gradients to a bottom→top orientation (deeper/lower-lightness shade at the base, lighter at the top), matching the card gradient. Reoriented the `/admin` colorful gradients (`--gradient-card-info`, `-accent`, `-warning`, `-danger`, `-blue`, `-emerald`) from `135deg` to `to top` across light, dark, and both hi-viz themes.
- Gave the previously-solid colorful status fills a matching bottom→top gradient that preserves their saturated intensity: added `--gradient-status-warning` / `--gradient-status-danger` tokens (theme-aware, deepened at the base with the status border color) and applied them to the `/admin` Live State returned/unclaimed alert boxes and the "Mark ticket as returned/unclaimed" sections. Via the shared `.ticket-returned` / `.ticket-unclaimed` classes this also gives the returned/unclaimed ticket cells and legend dots on `/` and `/display` the same gradient.
- Documented the surface-gradient-orientation preference and the flat-hi-viz rule in `docs/UI_DESIGN.md`.

### Fixed

- Fixed the hi-viz "NOW SERVING" numeral disappearing: the flattened `--serving-text-gradient` had been set to a solid color, which is invalid for the `background-clip: text` technique (it needs a `background-image`). It is now a degenerate two-stop gradient that renders flat correctly.
- Fixed the Current Time card's RTL alignment — the title and time now both right-align in Persian/Arabic, while the time digits stay left-to-right via an isolated inner span (which also carries the `service-time` test hook).

## [1.8.0] - 2026-05-28

### Added

- Applied a frosted-glass material treatment (translucent fill + backdrop blur) to floating/overlay surfaces — bottom nav bar, the inventory dietary-filter dropdown and icon popovers, the language and theme switcher menus, and the `/new` onboarding dialog (with a lit edge highlight and dark-mode blue-teal glow shadow). Interim hand-tuned values; tokenization deferred to v2.0. Documented in `docs/UI_DESIGN.md` and `docs/V2.0_PLANNED_FEATURES.md`.
- Added a universal, theme-aware "Prism" card gradient (FEED-aligned) on every `data-slot="card"` surface for cross-app brand consistency. Implemented as a translucent `--card-gradient` overlay (`color-mix` brand tint at the base lifting to a light/dark highlight at the top) so it augments each card's existing fill rather than replacing it — opaque and translucent (`bg-card/80`) cards both keep their fill. Disabled in the `hi-viz` themes to preserve high-contrast legibility; arcade cards are unaffected (separate component, no `data-slot="card"`).

### Changed

- Restyled the `/inventory` category tables to sit cleanly on the new card gradient: removed the alternating row-fill zebra striping and the `CardHeader` (`bg-muted/45`) and column-header (`bg-background/70`) band fills, so the card gradient flows uninterrupted with only hairline `border-b` dividers for structure.

### Fixed

- Fixed the `/` and `/display` ticket-detail modal: the top control bar (language switch, search, theme switch) was `z-50` — above the dialog's `z-40` blur overlay — so it stayed sharp in the foreground when a ticket was tapped. Lowered it to `z-30` (matching `/new` and `/inventory`) so those controls blur out with the rest of the background, keeping focus on the ticket info.

## [1.7.4] - 2026-05-28

### Changed

- Removed the "X categories" / "X items" totals pills from the `/inventory` page's upper section (title/freshness area). The per-category header "X items" badge is unchanged. Pruned the now-unused `inventoryCategoriesLabel` translation key from all eight languages.

## [1.7.3] - 2026-05-26

### Changed

- Migrated `readonly-display.tsx` (used by `/new` and `/display`) onto the shared `ScrambleOnLanguageChange` provider and `<T>` consumer, removing its duplicate local scramble-trigger logic (`PlainText`, `ScrambleText`, the local `T`, the trigger state, and the language-change effect). Behavior is unchanged — the `languageTextAnimation` prop still toggles the effect via the provider's `enabled` flag, with the same 0.35s/0.02 timing — but the scramble-on-language-change logic now lives in one place shared with `/inventory`.

## [1.7.2] - 2026-05-26

### Added

- Added a reusable `ScrambleOnLanguageChange` provider and `<T>` consumer (`src/components/core/scramble-text.tsx`) that play the TextScramble transition on an explicit language change (static on mount, rerenders, and no-op updates), generalizing the effect previously local to the personalized display.

### Changed

- The `/inventory` page now plays the TextScramble transition across the whole page when the language changes — page chrome (title, "Updated:", totals, dropdown, legend, column headers) as well as FEED-translated category/item names and limit strings — matching the motion language of `/new`.
- Renamed the `/inventory` "Limited" status label to **"Limited Supply"** (with equivalents across all eight languages) to distinguish a limited _amount of stock_ from the per-household / per-person _request limit_ that already lives in the Limit column. Affects both the legend chip and the icon-badge popup; the translation key (`inventoryStatusLimited`) is unchanged.
- Collapsed the dedicated **Status** column on the `/inventory` table: the Limited and Clearance status icons now render inline to the left of each item's name (desktop table cell and mobile list row), and the desktop column widths rebalance to Item 40% / Limit 20% / Dietary (remainder). The legend still explains what each icon means; the `inventoryColumnStatus` translation key is retained for potential reuse.

## [1.7.1] - 2026-05-26

### Changed

- Localized the remaining English strings on the `/inventory` page so they render in the selected language: the freshness "Updated:" prefix, the totals badges ("X categories" / "X items"), the per-category items badge, the table column headers (Item / Limit / Status / Dietary), and the per-item / per-category limit text ("Limit N per household" / "Limit N per person"). Adds nine translation keys across all eight supported languages; the page now uses a local localized formatter with the same null/non-finite/≤0/≥100 sentinel-hiding logic as the lib's `formatFeedLimit` (which stays unchanged for its unit tests).

## [1.7.0] - 2026-05-26

### Added

- Localized the `/new` onboarding modal: added `chooseLanguage`, `ticketFormatHint`, `drawingNotStartedHint`, and `justBrowsing` keys across all eight languages so the modal title, the ticket-format hint, the pre-drawing reassurance copy, and the "I don't have a ticket — just browsing" dismiss render in the selected language.
- Added the "Enter a new ticket number" action to the `/new` "Pantry Has Closed For The Day" personalized state, matching the generated-numbers state (personalized view only; the public display is unaffected).

### Changed

- Reworked the `secondary` color token into an adaptive neutral (light: near-white gray + near-black text; dark: dark gray + near-white text), fixing white-on-light-teal `secondary` badges and buttons that failed WCAG AA in both light and dark mode (most visibly the dark-mode `/inventory` count pills). Aligns with the FEED app's adaptive-neutral secondary; the `hi-viz` themes were left as-is.
- Switched the `/inventory` informational count pills (category/item totals and per-category counts) to the quieter `outline` badge treatment.
- Reworked the `/new` ticket onboarding so a client holding a physical ticket is never blocked before the operator starts the drawing: a valid-format number is always accepted and saved (the existing "not in the drawing yet — check back soon" holding state then shows), the red gate error became calm copy, and an "I don't have a ticket — just browsing" action dismisses the modal onto the page + nav bar.
- Simplified `home-ticket-storage.ts` to a flat 8-hour client-side TTL from entry time (dropping the operating-hours/pantry-day expiry), while keeping the drawing-range clearing that protects both `/new` and the Arcade now-serving banner from tracking stale tickets. The onboarding modal no longer auto-reopens on a stale/cleared ticket, removing the prior reset-loop path.
- Removed the obsolete `/arcade` Back button now that the persistent bottom navigation handles switching between Your ticket, What's in stock, and Games.
- Fixed bottom navigation label rendering in non-English languages — long translated labels (e.g. Russian "Что есть в наличии") now wrap centered with readable line spacing and keep tab icons aligned (top-aligned, matching the arcade variant) instead of rendering off-center.

### Fixed

- Fixed the display-page QR code continuing to show the default URL after an admin configured a custom display URL. The QR target now derives from the live polled state (`state.displayUrl`) instead of a one-time fetch on mount, so an admin change propagates to the QR on the next poll without a page reload (and a redundant network round-trip is removed).

## [1.6.99] - 2026-05-26

### Added

- Added an arcade-styled bottom navigation bar (`src/arcade/components/arcade-bottom-tab-bar.tsx`) for the `/arcade` index, reusing the same three destinations and `nav*` labels but rendered with pixel-art icons (`src/arcade/components/icons/{receipt,shopping-cart,gaming}-icon.tsx`) and arcade styling (arcade CSS variables, the control-dock border/neon-shadow pattern), inheriting the arcade font and theme from `.arcade-scope`. Kept separate from the core `BottomTabBar` per the Arcade guardrails.
- Added an animated `package-check` icon (`src/components/animate-ui/icons/package-check.tsx`) built on the native animate-ui `path` draw-on primitive — the box, seam, top, stem, and finally the check stroke draw themselves in — used as the `/inventory` dietary-filter dropdown trigger.
- Added `inventoryDietaryFilterLabel` and `inventoryClearFilters` translation keys across all eight supported languages.
- Added the persistent bottom tab navigation bar (`src/components/navigation/bottom-tab-bar.tsx`) with three destinations (Your ticket → `/new`, What's in stock → `/inventory`, Games → `/arcade`): a desktop floating capsule dock and a mobile full-width blurred bar, route-aware active state via `usePathname()`, localized labels with RTL support, and a `prefers-reduced-motion` guard. Per-page placement (Option 1) with a module-level guard so the active-tab mount animation plays once per page load, not on client-side navigation.
- Added three imperative-ref animated nav icons in `src/components/lucide-animated/` following the existing `archive.tsx` pattern: `ticket.tsx` (clipped halves rip apart and spring back), `cart.tsx` (scale pop + hop), and `gamepad-2.tsx` (controller wiggle while the d-pad and face buttons fade out and back), plus the `src/components/navigation/nav-items.ts` config (label key, route, icon, active matcher).
- Added `navTicket`, `navInventory`, `navGames`, and `navPrimaryLabel` translation keys across all eight supported languages, grounded in the existing reviewed vocabulary.
- Added `docs/NAVIGATION.md` documenting the approved persistent bottom-tab navigation direction: three destinations (`/new`, `/inventory`, `/arcade`), desktop floating-dock vs mobile tab-bar presentations, active/inactive states, the imperative-ref animated-icon plan (ticket-rip, cart-hop, gamepad wiggle), the active-tab-only-on-mount motion decision, arcade-boundary considerations, and an implementation checklist.
- Added `docs/FEED_PUBLIC_INVENTORY.md` documenting the FEED public inventory data contract, translation mapping, intended LOTTO usage, fetch rules, UI boundaries, and first-implementation acceptance criteria.
- Added `/inventory`, a client-facing FEED public inventory lookup that fetches the read-only endpoint without credentials and renders in-stock items as category tables with freshness, limits, status tags, dietary flags, and FEED-provided translations where available.
- Added a `See what's in stock` entry point from `/new` to `/inventory`.
- Added `src/lib/feed-public-inventory.ts` plus tests covering FEED fetch options, language fallback, limit formatting, category-table rendering, filtering, and the `/new` inventory link.
- Documented `/new` inventory rollout blockers in `docs/ISSUES.md`: aggressive text morph animation and ticket-selection reversal/pantry-day expiration semantics.
- Added a shared semantic haptics layer (`src/lib/haptics.ts`, `HapticsProvider`, `useAppHaptics()`) with app-owned intent names for browser-safe button-style interactions on `/new` and Arcade.
- Added regression coverage for the simplified provider, `/new` button haptics, Arcade direct button haptics, Arcade ticket-called visual-only behavior, and theme/language integration (`tests/haptics-provider.test.tsx`, `tests/new-page-haptics.test.tsx`, `tests/arcade-direct-input-haptics.test.tsx`, plus updated Arcade banner and theme tests).
- Added a raw-library `/haptics` diagnostic page that renders one shadcn button per `web-haptics` built-in preset and triggers each preset directly, so device/browser support can be validated without the app's semantic mapping layer.

### Changed

- Rendered the arcade-styled navigation bar on the `/arcade` index only (not on the game routes `/arcade/snake` and `/arcade/brick-mayhem`, which keep their own Back control) and increased the index's bottom padding so the fixed bar does not cover the game cards.
- Applied the bottom tab navigation bar to `/new` and removed the now-duplicate "See what's in stock" (→`/inventory`) and "PLAY GAMES" (→`/arcade`) buttons from the personalized ticket-card cluster, along with the orphaned arcade pixel-frame and arcade display font from `readonly-display.tsx`. The "Enter a new ticket number" action stays as a standalone button (page action, not navigation). Added bottom clearance on the personalized display so the fixed bar does not cover the ticket card; the public `/display` is unaffected.
- Updated the inventory test's `/new` entry-point cases to assert the bar's inventory/games links instead of the removed cluster buttons.
- Condensed the `/inventory` dietary filters from a wrapping row of toggle buttons into a single multi-select dropdown (shadcn `DropdownMenuCheckboxItem`), where each option shows its dietary icon and selecting one keeps the menu open for combining flags. The trigger uses the animated `package-check` icon, shows a selected-count badge, and a Clear action appears once any flag is active. The status legend (Limited / Clearance) is retained alongside it.
- Removed the `/inventory` BACK button now that the persistent bottom tab bar's "Your ticket" tab is the return path (the docs/NAVIGATION.md follow-up); the `next/link`, `ChevronLeft`, and `Check` imports it relied on were dropped.
- Rendered the bottom tab navigation bar on `/inventory` as the first integration (per the Option 1 per-page placement), and added bottom scroll-area clearance so the floating dock does not cover the last inventory rows. The `/new` + `/arcade` integrations remain tracked as follow-ups in `docs/NAVIGATION.md`.
- Updated `/new` and Arcade personalized-ticket persistence to validate stored tickets against pantry operating-hours timezone, next pantry-day opening, and active LOTTO range instead of only browser-local midnight.
- Replaced translated UI text morphing with TextScramble (`duration=3.0`, `speed=0.5`), kept `/new` language onboarding static, and removed morph/rolling animation from the large public-board serving value.
- Moved the `/new` inventory entry point into the existing personalized-card action stack between `Enter a new ticket number` and `PLAY GAMES`, and added production FEED fallback behavior when a configured inventory endpoint fails.
- Standardized `/inventory` top controls with `/new` by anchoring the language switcher top-left and theme switcher top-right, with Back navigation moved into the inventory content header.
- Localized the `/new` `See what's in stock` inventory CTA through the shared language map for all supported display languages.
- Localized `/inventory` title/search copy, removed the FEED-oriented explainer and `Pantry inventory` eyebrow, and restyled inventory search to match the public-board ticket search control treatment.
- Removed the visible `/inventory` Refresh button so the client page stays focused on browsing and searching available items.
- Constrained `/inventory` to a fixed-height shell with a shadcn/Radix `ScrollArea` for inventory results so the top controls and status/dietary legend remain visible while browsing item sections.
- Added inner padding to the `/inventory` results `ScrollArea` so inventory table card shadows are not clipped by the scroll viewport.
- Changed the `/inventory` Back button to the primary button treatment and localized its label through the shared `back` translation key.
- Moved `/inventory` search into the centered top-control slot used by the homepage and center-aligned the inventory title, freshness timestamp, and totals.
- Simplified the `/inventory` legend by removing its card frame and section headings, enlarging the pills/icons/text, and showing `=` between each icon and term.
- Increased `/inventory` legend label text and icon sizes with explicit badge icon overrides so the enlarged pills read proportionally.
- Made `/inventory` dietary legend pills interactive filters with checkmark indicators, while leaving status tags as static legend entries.
- Reworked the `/inventory` legend so dietary filters occupy the primary pill row, status keys render below as plain `icon = label` entries, and dietary icons are larger inside item lists.
- Moved the `/inventory` Back control into the inventory title row and simplified it to an icon-only chevron button matching the language/theme trigger style, with the localized label preserved for assistive technology.
- Updated FEED inventory documentation, README, project overview, and env examples to reflect the runtime `/inventory` integration and optional FEED endpoint override.
- Extended optional client-device haptics from Arcade-only to `/new` and kept `/`, `/display`, admin, staff, and login haptic-free.
- Narrowed browser haptics to direct button-style interactions only: `/new` and Arcade buttons, menu selections, theme/language choices, explicit submit/back/change-ticket actions, and Snake D-pad button presses.
- Removed the dedicated haptics toggles and persisted `haptics-enabled` preference because browser haptics are intentionally scoped to narrow tactile feedback and the toggle consumed higher-value top-bar space.
- Removed Snake and Brick Mayhem difficulty slider haptics so non-button controls remain silent in line with the narrowed browser scope.
- Removed unreliable web haptics from async and game-loop-driven events: tracked ticket-called celebrations, Snake pellet/collision feedback, and Brick impact/contact/level-clear/life-loss feedback are now visual-only on the web path.

### Fixed

- Fixed a `/new` reset-edge loop where a tab left open across staff reset could accept a ticket while no active range existed, immediately invalidate the stored ticket, and reopen the ticket modal repeatedly; ticket submit now waits until today's ticket range is ready.
- Lowered the `/new` floating header stacking level so the William Temple House logo stays behind the shared language onboarding modal backdrop while “Choose your language” has focus.
- Fixed production inventory loading by allowing `https://feed.williamtemple.app` in the app Content Security Policy `connect-src` directive.
- Hid FEED inventory limit values of `100` or higher so no-limit categories/items no longer display misleading copy such as `Limit 100 per household`.
- Removed the `None listed` filler from empty inventory tag cells so items without status/dietary tags leave that field blank.
- Split FEED inventory status tags and dietary flags into separate table columns, using FEED-aligned icons for Limited, Clearance, and dietary flags.
- Added an inventory legend/key for status and dietary icons, and changed category-table status/dietary cells to icon-only values with accessible labels.
- Added tap/click popovers for inventory status and dietary icons with localized labels across LOTTO's supported languages.
- Changed inventory freshness to display the latest included item `updatedAt` timestamp instead of FEED response `generatedAt`.
- Aligned the haptics implementation with browser activation constraints by concluding the feature as tactile input feedback rather than broad event-driven vibration.

## [1.6.3] - 2026-04-16

### Fixed

- Replaced the one-word `Unauthorized` Sonner toast shown when a staff member's admin sign-in expires mid-session with an ASK-compliant message (`Your sign-in expired. Sign back in to keep working.`) and an inline `Sign in` action button that routes to `/login?callbackUrl=<current-path>` so staff return to the same admin surface after re-auth (Issue 18).
- Mapped 401 responses from `/api/state` and `/api/state/cleanup` to the new session-expired toast inside both the legacy and optimistic admin action dispatchers, so draw, mark, reset, and cleanup taps all surface the same ASK copy on auth expiry instead of echoing the raw HTTP token.

### Added

- Added `src/lib/session-expired.ts` with `SESSION_EXPIRED_MESSAGE`, `SessionExpiredError`, and `showSessionExpiredToast()` so future callers can classify 401s without re-implementing the toast + callback URL plumbing.
- Added `tests/admin-session-expired.test.tsx` verifying that `/admin` swallows the raw `Unauthorized` token on a 401 action response and surfaces the ASK copy + `Sign in` action instead.

### Changed

- Logged the error-message violation and fix in `docs/ISSUES.md` as Issue 18 with the ASK rubric breakdown and Option 5 implementation notes.

## [1.6.2] - 2026-03-05

### Added

- Added haptic feedback via `web-haptics` library across all arcade interactions. Scoped exclusively to arcade routes per project separation rules.
  - **Ticket called:** `buzz` pattern fires once when a tracked ticket is called (`NowServingBanner`), timed with the confetti burst for multi-modal confirmation.
  - **Brick Mayhem — brick destruction:** `error` pattern on brick hit, throttled to one trigger per 50ms to prevent buzz fatigue on multiball runs.
  - **Brick Mayhem — paddle bounce:** `light` pattern on ball-paddle collision, throttled to 50ms.
  - **Brick Mayhem — ball lost / game over:** `error` pattern on ball drop.
  - **Snake — pellet eaten:** `success` pattern on each pellet collection.
  - **Snake — game over:** `error` pattern on wall or self-collision.
  - **Arcade buttons:** `heavy` pattern on all arcade button presses via the shared `Button` component (`src/arcade/ui/8bit/button.tsx`); disabled buttons suppress haptics.
- Exposed `paddleBounced: boolean` in `TickResult` from the Brick Mayhem engine so page-level haptic hooks can detect paddle contact without modifying pure engine logic.
- Platform support: Android Chrome/Firefox and iOS26 Safari. Graceful no-op on unsupported platforms via `WebHaptics.isSupported`.

## [1.6.1] - 2026-03-01

### Fixed

- Resolved `/new` page-load animation issue (Issue 17) where morph text animated on initial render instead of appearing statically. Root cause: hydration-safe motion tiering starts as `"simple"`, then upgrades to `"full"` post-mount, causing a render-branch switch that Motion treats as new entering elements. Fixed by pinning the cycling language title to `motionMode="simple"`, which prevents the branch switch entirely. The title still animates smoothly between language cycles using whole-text transitions.
- Removed unnecessary `LanguageMorphText` from the `/new` ticket-entry modal step (step 2), replacing with plain `<span>` elements. This step only appears after language selection, so the text never changes while visible.

### Changed

- Updated `docs/ISSUES.md` Issue 17 with full root cause analysis covering the motion-tier branch-switch mechanism, why `AnimatePresence initial={false}` and `layoutId` interact to prevent suppression, and why previous approaches (fast-phase workaround, delay-mount pattern) failed.
- Updated `docs/V1.5_OPTIMIZATIONS.md` with a known limitation note on the motion-tier system's interaction with `AnimatePresence` on immediate-mount components.
- Updated `docs/V2.0_PLANNED_FEATURES.md` to reflect the `/new` cycling title compromise.

## [1.5.9] - 2026-02-28

### Added

- Added personalized-ticket called celebration to `/new` (via `ReadOnlyDisplay` personalized mode): when the tracked ticket is called, the page now shows a centered overlay (`Ticket Called!` / `Please Check-in`) and runs a timed confetti effect.
- Added regression coverage in `tests/readonly-display-personalized.test.tsx` to verify called-ticket overlay rendering and confetti trigger behavior.

### Changed

- Updated the `/new` called-ticket overlay backdrop to match shared modal treatment (`bg-black/40` + `backdrop-blur-sm`) for stronger text readability during the alert.

## [1.5.8] - 2026-02-28

### Fixed

- Stabilized hydration for top-bar dropdown controls by assigning deterministic trigger IDs to `LanguageSwitcher` and `ThemeSwitcher`, eliminating Radix auto-generated trigger-id drift between SSR and client hydration.

### Added

- Added regression coverage in `tests/language-switcher.test.tsx` and expanded `tests/theme-switcher.test.tsx` to enforce deterministic dropdown trigger IDs.

## [1.5.7] - 2026-02-28

### Fixed

- Fixed `/new` hydration mismatch tied to animated text tiering by making `useMotionTier` deterministic on first render (`simple`) across SSR and client hydration, then applying stored/runtime motion preferences after mount.

### Added

- Added hydration-regression coverage in `tests/morphing-hydration.test.tsx` to guard against server/client DOM-shape divergence when a stored motion tier (for example `full`) is present before hydration.

## [1.5.6] - 2026-02-28

### Changed

- Restored Brick Mayhem gameplay readout to the minimal 3-metric banner (`SCORE`, `LIVES`, `LEVEL`) by removing the additional active-effects HUD row.
- Removed Brick Mayhem effect-HUD specific styling from Arcade CSS while keeping all gameplay effects (speed, multiball, clone paddle, timed buffs) active in the engine.
- Updated `docs/GAME.md`, `docs/BRICK_MAYHEM.md`, and `docs/V2.0_PLANNED_FEATURES.md` to reflect the readout rollback.
- Updated Brick Mayhem ball color to a neutral theme-aware mapping: dark mode `#ffffff`, light mode `#000000`.

## [1.5.5] - 2026-02-28

### Added

- Added Brick Mayhem row-hit effect architecture in `src/arcade/game/brick-mayhem/`: shared row metadata (`effects.ts`), multiball-capable world state (`balls[]`), timed effect state (`pink` paddle width and `gold` points multiplier), and clone paddle state (`green`).
- Added Brick Mayhem engine safety/behavior rules: baseline-based non-compounding speed effects (`red`/`cyan`/`purple`), runtime ball-speed clamps (`0.6..4.0 px/tick`), orange split-ball spawn handling, timed effect extension with hard cap (`30s` add, `120s` max), and level-clear effect reset semantics.
- Added Brick Mayhem effect HUD in the game page (active balls count + active effect tags with timers) and localized the new Brick Mayhem HUD/effect labels across all 8 languages.
- Added `tests/arcade-brick-mayhem-engine.test.ts` covering non-compounding speed effects, multiball life-loss behavior, timed effect cap behavior, clone paddle behavior, and effect reset on next-level world creation.

### Fixed

- Fixed Brick Mayhem live score/readout synchronization so score updates immediately when bricks are destroyed during active play (not only on life loss/level transitions).
- Removed duplicated Brick Mayhem row palette definitions by centralizing row color/effect data and reusing it from renderer + particle systems.

### Changed

- Updated `docs/BRICK_MAYHEM.md`, `docs/GAME.md`, and `docs/V2.0_PLANNED_FEATURES.md` to reflect the shipped Brick Mayhem effect system, lifecycle rules, HUD changes, and new engine test coverage.

## [1.5.4] - 2026-02-27

### Changed

- Updated root app metadata (`title` and `description`) to the new LOTTO branding/copy so homepage search snippets align with current staff-facing product messaging.
- Updated `/staff` hero descriptive paragraph copy to exactly match the LOTTO branding description used in homepage metadata.
- Removed the duplicate short `/staff` hero subtitle so only the LOTTO title and full descriptive paragraph are shown.
- Added a `/staff` Arcade CTA button linking to `/arcade`, reusing the same pixel-style button appearance used on `/new`.
- Adjusted the `/staff` Arcade CTA so the 👾 icon renders after the button label instead of before it.
- Fixed `/staff` Arcade CTA hydration mismatch by forcing its animated label to render in deterministic `simple` motion mode across SSR and client hydration.
- Updated `/staff` CTA layout so `PLAY GAMES` is positioned directly underneath `View Public Board`.
- Added a second playable-style game card on `/arcade` with title `BRICK MAYHEM` and button label `PLAY`, while keeping the existing `More Games Coming Soon` card unchanged.
- Updated `/arcade` game-menu CTAs so the Snake card button now reads `PLAY`, and centered the `More Games Coming Soon` card in the two-column desktop layout.

## [1.5.3] - 2026-02-20

### Added

- Expanded automated test coverage from ~25-30% to ~60-65% with 226 new test cases across 13 new test files covering pure utilities (RTL, date, time, class merging), all 15 API route action handlers, the Postgres state manager (full CRUD + snapshots), admin page interactions and v1.5.1 memoized computations, and key UI components (public display page, confirmation dialog, operating hours editor, public board variant).
- Updated `docs/V2.0_PLANNED_FEATURES.md` with cross-cutting test coverage expansion section.
- Refreshed `docs/V1.5_OPTIMIZATIONS.md` with a source-backed compatibility baseline check for iPad mini 4 (best-effort support), updated unresolved `/admin` latency risks, and revised optimization priorities.
- Documented `docs/ISSUES.md` Issue 16 covering the reset-state admin regression where "Tickets issued" displays `1` with no active range, including proposed guard-based fix and validation checklist.
- Added optimistic-admin regression coverage (`tests/admin-optimistic-ui.test.tsx`) for immediate draw updates, queue-one tap behavior, and rollback on failed actions.
- Updated `docs/ISSUES.md` Issue 14 and `docs/V1.5_OPTIMIZATIONS.md` to log the post-input-optimization finding that button latency remains the primary iPad mini 4 pain point and to document optimistic-action rollout criteria.
- Updated `docs/ISSUES.md` and `docs/V1.5_OPTIMIZATIONS.md` to track the new draw-path pending/render isolation pass (split draw vs non-draw pending channels and memoized Draw Position controls).
- Updated `docs/ISSUES.md` and `docs/V1.5_OPTIMIZATIONS.md` to track the new history-cost optimization pass (deferred draw snapshot refresh and capped progressive snapshot option rendering).
- Added motion-tier classification test coverage (`tests/motion-tier.test.ts`) for automatic morph animation fallback behavior.

### Fixed

- Corrected `/admin` Live State `Tickets issued` so reset sentinel state (`startNumber=0`, `endNumber=0`) now renders `—` instead of `1`, and added a regression test in `tests/admin-page-actions.test.tsx`.
- Prevented unhandled promise rejections in `/admin` draw-navigation handlers (`next`, `prev`, and direct serving updates) by catching `sendAction` failures after toast reporting.
- Isolated `/admin` Start/End range inputs and reset phrase input into local-state memoized sections so keystrokes no longer trigger root-page re-renders, and optimized range preview undrawn math to an O(1) end-extension path.
- Decoupled `/admin` snapshot refresh from action completion and initial interactive load (`sendAction`, `fetchState`, undo/redo) so slow snapshot listing no longer blocks visible state updates.
- Added regression coverage for slow snapshot listing to verify load/action UI is not blocked (`tests/admin-page-actions.test.tsx`).
- Updated `docs/V1.5_OPTIMIZATIONS.md` and `docs/ISSUES.md` to reflect the shipped keystroke-isolation and range-preview optimizations.
- Updated docs to note on-device iPad mini 4 validation: responsiveness improved, but input lag remains a known issue.
- Implemented feature-flagged optimistic `/admin` action dispatch (`NEXT_PUBLIC_ADMIN_OPTIMISTIC_UI`) with deterministic local patches, queue-one draw navigation intents, rollback-safe failure handling, and background snapshot refresh reconciliation.
- Routed display URL writes through the unified `/admin` action dispatcher (`setDisplayUrl`) so optimistic and non-optimistic paths share consistent error handling and state reconciliation.
- Split `/admin` pending state into `pendingDrawAction` and `pendingNonDrawAction` so draw-position taps no longer mute unrelated controls like mode/settings/history sections.
- Isolated draw-position controls into memoized `DrawPositionControls`, reducing draw-path render fan-out on older devices.
- Deferred draw-triggered snapshot refresh (`DRAW_SNAPSHOT_REFRESH_DELAY_MS`) and capped History snapshot option rendering (`SNAPSHOT_RENDER_PAGE_SIZE`) with a clearer "Show older snapshots" checkbox affordance (including animated archive icon that now triggers on checkbox toggle) to reduce iPad layout/reflow pressure during draw taps.
- Added regression coverage for History option capping/progressive expansion and non-draw control availability during pending draw actions (`tests/admin-page-actions.test.tsx`, `tests/admin-optimistic-ui.test.tsx`).
- Added automatic morph-text motion tiering (`full/simple/off`) using reduced-motion preference + runtime frame probe + capability hints with local persistence, so older devices degrade animation without introducing manual controls.

## [1.5.1] - 2026-02-19

### Changed

- Memoized all admin page derived computations (`returnedTickets`, `unclaimedTickets`, `currentIndex`, `nextFive`, `nextServingIndex`, `prevServingIndex`, `ticketsCalled`, `peopleWaiting`, `drawnSet`, `serverUndrawnCount`, `previewUndrawnCount`) with `React.useMemo` to eliminate redundant recomputation on every keystroke.
- Removed duplicate snapshot fetch (`useEffect([state])` calling `listSnapshots`) from admin page; `canUndo` is now derived from the already-loaded `snapshots` array.
- Changed DB `listSnapshots` query to fetch metadata only (`id`, `created_at`), omitting full `payload` column; reduces snapshot listing response size by ~95%.
- Added `touch-action: manipulation` to all interactive elements (`a`, `button`, `input`, `select`, `textarea`, `[role="button"]`) in `globals.css` to eliminate ~300ms iOS Safari double-tap delay.
- Updated `docs/V1.5_OPTIMIZATIONS.md` with implementation status for Phases 1, 2, and 4a.
- Updated `docs/ISSUES.md` Issue 14 status to reflect partial resolution.

## [1.5.0] - 2026-02-18

### Changed

- Promoted the public board routes for production testing: `/` is now the default public display and `/display` remains a live alias with the same behavior.
- Added `/new` as the preview personalized homepage surface (language + ticket onboarding, personalized ticket card), intended for future promotion to the default homepage.
- Added a shared public-display page implementation used by both `/` and `/display` to keep behavior parity while maintaining separate URLs.
- Marked Arcade as a v1.5.0 preview feature with one playable game (`Snake`) available under `/arcade` and `/arcade/snake`.
- Updated the `FOOD PANTRY SERVICE FOR` card to show device-local, locale-aware service time once drawing starts, including clearer RTL clock rendering.
- Documented a new admin performance issue in `docs/ISSUES.md` capturing significant input/tap lag on slower devices (for example iPad mini 4), including root-cause references for render-time queue computations and repeated snapshot-history fetches.

## [1.4.4] - 2026-02-14

### Changed

- Added explicit Arcade guardrails to `AGENTS.md` requiring clean route/code/style separation from raffle features.
- Documented the Arcade architecture boundary (`src/app/(arcade)/arcade/*` and `src/arcade/*`) and clarified that Arcade must not be integrated into the public display page.
- Replaced `docs/GAME.md` strategy with a separation-first Snake plan using standalone Arcade routes and simple pixel-art UI direction instead of raffle UI element reuse.
- Added `docs/V2.0_PLANNED_FEATURES.md` with v2.0 scope: standalone Arcade page, persistent top "NOW SERVING" banner, game menu, and Snake as launch game.
- Added a dedicated Arcade route group with `/arcade` and `/arcade/snake`, including a persistent top `NOW SERVING` banner and an 8-bit launch menu focused on Snake.
- Added `/display` as a first-party alias of the public homepage display so `williamtemple.app/display` serves the same read-only board content as `/`.
- Updated `/staff` “View Public Board” CTA target to `/display` so staff navigation uses the stable display URL.
- Decoupled `/display` from `/` page re-export and removed the homepage (`/`) QR panel while keeping `/display` QR-enabled and operationally unchanged.
- Removed homepage (`/`) top-bar ticket search controls and replaced the center slot with WTH logo branding, keeping `/display` as the unchanged search-enabled board route.
- Removed the redundant board-row logo on homepage (`/`) so `NOW SERVING` is centered beneath the top-bar logo, while `/display` keeps its original board-row logo.
- Swapped public routes for production testing: `/` now serves the searchable public board, `/new` now serves the personalized homepage onboarding flow, and `/display` remains a live non-redirecting alias of the public board.
- Updated the `FOOD PANTRY SERVICE FOR` info card to also show device-local service time once drawing has started (batch or full), with locale-aware formatting based on the selected display language and LTR-isolated left justification for clearer RTL clock rendering.
- Added a homepage (`/`) load-time language-picker modal (“Choose your language”) with buttons for all supported languages, wired to the existing language context/localStorage selection flow.
- Updated the homepage language-picker modal title to auto-cycle through supported-language variants every 5 seconds using the same morph-text animation pattern used elsewhere for language transitions.
- Extended homepage (`/`) onboarding to a second modal step that prompts for a ticket number after language selection and submits directly into the existing display ticket lookup flow.
- Added homepage ticket-input normalization for deli-style formats (`C17`, `B07`, `X53`) and plain numeric input (`53`), collapsing all accepted formats to a shared numeric `00`-`99` lookup value.
- Refined homepage onboarding ticket-entry copy: title now reads “Enter your ticket number,” placeholder reads “ENTER TICKET #,” primary action reads “Submit,” and the extra helper sentence was removed.
- Added a top-left back-arrow control on the homepage ticket-entry modal step so users can return to language selection before submitting a ticket.
- Reordered ticket detail modal metrics to the new hierarchy (`Estimated Wait`, then `Tickets Ahead`, then `Queue Position`), while preserving existing returned/unclaimed/called status messaging behavior.
- Replaced homepage (`/`) `DRAWING ORDER` ticket grid card content with a personalized ticket card variant (`YOUR TICKET`) that shows inline ticket-specific rows, status notes, and an `Enter a new ticket number` action.
- Scoped personalized-card behavior to homepage (`/`) only: `/display` retains the existing searchable full-grid board with legend/key and ticket detail modal interactions.
- Added homepage inline fallback handling for tickets not yet present in draw order, showing a localized check-back message plus `CHECK BACK SOON` value placeholders.
- Added localized personalized-card labels/actions/messages across all supported display languages and introduced targeted tests for the modal order and homepage personalized card behavior.
- Corrected ticket-ahead and wait-time calculations so the currently serving shopper is counted as ahead for upcoming tickets (for example, next-in-queue now shows `1` ahead with an estimated `2 minutes` wait).
- Added homepage ticket-number persistence in browser `localStorage` (`homepage-ticket-selection-v1`) with auto-expiry at local midnight, so refreshes retain the client’s ticket while preventing carry-over into the next service day.
- Updated localized homepage `Enter a new ticket number` button text translations to the new intent-based phrasing (replacing legacy all-caps/change-ticket wording in non-English locales).
- Added a centered secondary CTA under homepage personalized ticket controls that links clients directly to `/arcade` (`👾 PLAY GAMES`), with localized copy across supported languages.
- Styled the homepage personalized-card Arcade CTA with an Arcade-like pixel treatment (retro frame + action colors) and applied the same Arcade display font to the CTA text (emoji excluded), while keeping implementation scoped to core display code.
- Added ticket-aware Arcade banner behavior that reads persisted homepage ticket selection: no ticket keeps animated `NOW SERVING`, while tracked tickets show `ESTIMATED WAIT` in `#h #m` format.
- Added called-ticket Arcade reaction flow using `react-canvas-confetti`: when the tracked ticket is called, Arcade dispatches a pause event and Snake auto-pauses active runs before confetti celebration.
- Updated Arcade tracked-ticket wait formatting to full units with a sub-hour exception (`# minutes` when under one hour; otherwise `# hours # minutes`), removed the tracked wait value border frame, and reduced `ESTIMATED WAIT` label sizing so longer localized strings fit within the banner.
- Fixed Arcade Snake settings card surface fill by applying panel background through the full card wrapper (removing the transparent top strip).
- Localized the Snake settings card title by replacing hardcoded `DIFFICULTY SETTING` with a new translated `snakeDifficultySettingTitle` key across all supported languages.
- Increased Arcade banner typography scale for Arabic, Persian, and Chinese locales (approximately 2x) to improve readability for `NOW SERVING` and `ESTIMATED WAIT` states.
- Increased Arabic/Persian/Chinese typography in Snake gameplay surfaces so the readout labels (`SCORE`, `LENGTH`), settings-row value line (`SETTING: ...`), and center control label (`START`/`PAUSE`/`PLAY`) render at a larger, easier-to-read size.
- Refactored Snake board rendering to a single canvas paint path (grid + snake + pellet) and removed CSS pseudo-grid layering to eliminate small-screen subpixel drift/misalignment between grid cells and gameplay pixels.
- Updated Arcade tracked-ticket called-state UX: when a ticket is called, the banner now replaces wait copy with `TICKET CALLED!` / `PLEASE CHECK-IN`, animates the alert into viewport center for 10 seconds with flashing emphasis, and repeats confetti bursts during that alert window.
- Moved the called-state Arcade check-in callout to a fixed center overlay with responsive max-width/clamp typography so translated callout text no longer crops on smaller screens during center-scale animation.
- Added runtime viewport-fit scaling for the called-state check-in overlay (client-side measured) so longer localized strings like Russian dynamically downscale to stay fully visible during center animation.
- Added a temporary called-state backdrop dimmer behind the centered check-in callout (matching `GAME OVER` darkening treatment) while the 10-second ticket-called alert animation runs.
- During active ticket-called overlays, the top banner now remains populated with live `NOW SERVING: #<ticket>` status instead of hiding banner content.
- Fixed called-state overlay persistence by limiting center callout rendering to the active alert window and dismissing it immediately when Arcade play resumes.
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
- Updated the `/arcade` `PLAY SNAKE` CTA rendering to support per-word wrapping for multi-word translations, preventing overflow and preserving readability across supported languages.
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
- Updated Arcade mode-switcher icon geometry to match 8bitcn `retro-mode-switcher` (full pixel maps), and aligned theme semantics to app consistency: light mode shows sun, dark mode shows moon.
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
