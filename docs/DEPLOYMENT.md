# Deployment & Operations

Operational reference for running LOTTO locally and in production. For a product
overview see the [README](../README.md); for release history see
[`CHANGELOG.md`](../CHANGELOG.md) and [`docs/RELEASES.md`](./RELEASES.md).

## Local URLs

- Personalized homepage (client): http://localhost:3000/
- Public board: http://localhost:3000/display
- Inventory lookup (only when FEED is configured): http://localhost:3000/inventory
- Arcade: http://localhost:3000/arcade
- Staff dashboard (admin): http://localhost:3000/admin
- Help: http://localhost:3000/help
- Staff sign-in: http://localhost:3000/login

## Scripts

- `npm run dev` — start the Next.js dev server.
- `npm run build` — production build.
- `npm start` — run the built app.
- `npm run readonly` — optional standalone read-only board on port 4000
  (configurable via `READONLY_PORT`).
- `npm test` — Vitest suite.
- `npm run lint` — ESLint.

## Local development (no external deps)

`docker compose` runs the app, Postgres, and MailDev (SMTP + web UI):

```bash
docker compose up --build
```

- App on http://localhost:3000; MailDev inbox on http://localhost:1080.
- Stored state lives in the host `./data` directory (survives restarts).
- Local `npm run dev` on localhost bypasses auth automatically (no OTP needed).
- Fully offline: leave `RESEND_API_KEY` unset and keep `EMAIL_FROM=login@localhost`.
- To exercise the full email flow, keep `AUTH_BYPASS=false`, start docker, and open
  magic links from MailDev.

### Environment setup

1. Copy the example: `cp .env.example .env.local`
2. Generate a secret: `openssl rand -base64 32`
3. Fill `.env.local`:
   - `AUTH_SECRET` (required) and `AUTH_TRUST_HOST=true`
   - `DATABASE_URL=postgresql://postgres:postgres@db:5432/neondb?sslmode=disable`
   - `EMAIL_FROM=login@localhost`, `EMAIL_SERVER_HOST=maildev`, `EMAIL_SERVER_PORT=1025`
   - `ADMIN_EMAIL_ALLOWLIST` (exact addresses) and/or `ADMIN_EMAIL_DOMAIN`
     (managed domain); when both are set either path is accepted, and production
     fails closed when neither is set
   - Optional: `RESEND_API_KEY` + production `EMAIL_FROM` to test Resend instead of MailDev

See `.env.example` for the full list.

### Configure an appearance

LOTTO compiles one William Temple House default. After the first staff sign-in,
use **Admin → Advanced → Appearance** to create and activate the deployment's
identity. Appearance data is stored in the deployment database; uploaded
graphics use Vercel Blob in hosted environments. See
[`CONFIGURABLE_BRANDING_PLAN.md`](./CONFIGURABLE_BRANDING_PLAN.md).

## Read-only board options

- Built-in: `/display` is the QR-enabled public board.
- FEED inventory: `/inventory` is available when the active Appearance enables
  its FEED connection, or when the compiled WTH default or
  `NEXT_PUBLIC_FEED_PUBLIC_INVENTORY_URL` supplies an endpoint. Queue-only
  appearances omit the Inventory navigation item and `/inventory` returns not
  found.
- Optional standalone server: `npm run readonly` (port `4000`), polling
  `data/state.json` for legacy/edge hosting. Configure via `READONLY_PORT`,
  `READONLY_POLL_MS`, `READONLY_DATA_DIR`.

## Persistence

- Development fallback: `data/state.json` with timestamped backups
  (`state-YYYYMMDDHHMMSSmmm-XXXXXX.json`); the `data/` dir is gitignored except
  `data/.gitkeep`.
- Production: Neon Postgres (the file store is only used when `DATABASE_URL` is
  absent in development).

## Production deployment (one Vercel project per agency)

All agencies deploy the same repository and branch. Each agency must have a
separate Vercel project, Neon database, auth secret, Resend sender/domain,
allowed staff-email policy, and public domain. Do not share databases or secrets
between agencies. Configure Appearance independently in each deployment; set
`NEXT_PUBLIC_FEED_PUBLIC_INVENTORY_URL` only if that agency has its own FEED
deployment.

**If another agency's production project already exists (e.g. `williamtemple.app`),
treat it as read-only for the duration of a new agency's launch.** All of the
steps below happen in a *new*, separate Vercel project, a *new* Neon database,
and that agency's own DNS/Resend accounts. The only time the existing project is
touched is the one shared step everyone deploys through — merging to `main` (see
[Shared branch, one merge affects everyone](#shared-branch-one-merge-affects-everyone)
below) — and that step should only ship code already verified to build cleanly
for every brand profile.

### William Temple House production

- **Live:** https://williamtemple.app (Vercel, custom domain).
- **Auth:** scanner-safe Auth.js Magic Link + Verification Code fallback;
  sign-ins restricted to `@williamtemple.org`.
- **Email:** Resend (`login@williamtemple.app`; configure SPF/DKIM/DMARC in DNS).
- **Database:** Neon Postgres (serverless) with a shared connection pool.

### v2.0 beta environment (provisioning in progress)

The provisional realtime architecture proof will use a stable,
production-shaped deployment at `https://beta.williamtemple.app`. This should
be a **separate Vercel project**, not another preview in the live WTH project.
The separation resolves the current WTH Preview database-variable gap and gives
WebSocket, authentication, PWA, CSP, DNS, and physical-device tests a stable
origin.

The beta hostname must not be a second frontend attached to production state.
Provision independent beta resources:

- a fresh Neon database populated from `schema.sql` with synthetic/sanitized
  state, not production auth, snapshots, credentials, or queue history;
- a separate public Vercel Blob store and token;
- a distinct `AUTH_SECRET`, auth tables, and beta callback URL;
- a separate Resend key/configuration with clearly identifiable beta messages;
- a Cloudflare beta Worker environment and Durable Object namespace;
- a beta realtime hostname such as `realtime-beta.williamtemple.app` when DNS
  ownership permits, or a dedicated `workers.dev` hostname for the first proof;
  and
- separate metrics, logs, spend alerts, and secrets at all three providers.

Use beta-specific no-index policy and a visible non-production staff/admin
banner. Confirm cookies remain host-only between the apex and beta origins. Do
not place the Vercel app itself behind the Cloudflare proxy merely because the
realtime hub uses Cloudflare; that would be a separate experiment.

Promotion moves reviewed code, protocol versions, additive schema migrations,
Worker configuration, and runbooks. Never promote beta database rows, Blob
objects, Durable Object storage, auth tokens, or secrets into production.

Provisioning was explicitly approved on August 31, 2026. The current proof
environment is intentionally incomplete and must not be mistaken for an
accepted v2.0 architecture or a production promotion:

| Layer | Current beta status |
| ----- | ------------------- |
| Git | `codex/v2-realtime-beta`; `main` and the live WTH project remain untouched |
| Vercel | Separate Hobby-team project `wth_apps/lotto-beta`; Production tracks only the beta branch |
| App URL | `https://beta.williamtemple.app` is the stable beta origin; `https://lotto-beta-sigma.vercel.app` remains a generated alias. Both route only to the beta project, whose Production deployments track `codex/v2-realtime-beta`. |
| Neon | Separate Free resource `neon-copper-queen` in Portland (US West), connected to beta Production only |
| Schema | The original 15 expected `public` tables plus the additive Phase 3 `raffle_state.revision` and `raffle_public_state_publications` schema are applied. Metadata verification found the revision column, outbox table, four expected outbox indexes, and zero initial outbox rows. |
| Runtime config | Distinct beta `AUTH_SECRET` and `ENCRYPTION_MASTER_KEY`; production-safe auth bypass/domain/from-address settings plus `LOTTO_DEPLOYMENT_ENVIRONMENT=beta` applied |
| Public smoke | `/` renders and `/api/state` returns `200` from the isolated Neon database. RC.2 deployment `48MNHWZZ2Qg9yjdCBesNASrp3nPx` serves commit `df180f0`; ordinary Home, Display, Inventory, and Arcade URLs connected at revision `91` after the exact handshake, and the parameter-free Display connected on the iOS 15.4 simulator. |
| Authentication | A sending-only `LOTTO Beta` Resend key, restricted to the already verified `williamtemple.app` domain, is stored only in the beta Vercel Production environment. `AUTH_URL` and Auth.js provider callbacks use `https://beta.williamtemple.app`. Deployment `HqLiGzzahAf2QxHe5MPHqQKND5Ua` is ready; Resend delivered the custom-origin Magic Link, the link established an authenticated `/admin` session, and the page reached Persistence confirmed. A session created on the generated Vercel hostname did not cross to the custom hostname. The key remains in the existing Resend workspace for this proof; domain/account migration is explicitly deferred. |
| Blob | Separate public store `lotto-beta-blob` is provisioned in Portland (`PDX1`) and connected only to the beta project; its read-write token/store ID/webhook key are generated for beta Production and Preview |
| Realtime | `lotto-realtime-beta` is deployed at `https://lotto-realtime-beta.et2-geiger.workers.dev`; RC.2 Worker version `5f9eb992-c0b3-43bb-a9a3-30db66dc1741` includes the independently authenticated persistent drain/resume control. The remote protocol verifier passes, a bounded 1/10/100/200-client run delivered all 311 target updates, and beta-only Neon shadow publication is enabled and repair-proven. RC.2 makes the source controller the ordinary Home/Display/Inventory/Arcade beta default; all four connected at revision `91`. `?realtime=poll` opened no source socket, `?realtime=observe` reported hub/poll revision `91` with a Neon match, and `?realtime=source` remains an alias. A live drain refused a fresh connection and produced `Polling fallback · connection closed`; resume automatically restored `Realtime source · live · r91`. The Vercel application gate is deployed and code/build-tested but has not been live-toggled. Production remains polling-only. The owner has deferred the ten-day, provider-wide, and physical-iPad exercises until the stable-release decision. |
| DNS | Cloudflare serves a DNS-only `beta` CNAME to Vercel plus the Vercel ownership-verification TXT value alongside the existing apex/`www` verification values. The apex, `www`, and `feed` records were not changed. The Worker already allowlists the stable beta origin. |
| Safety UX | Beta-only `X-Robots-Tag`, blocking `robots.txt`, and visible sign-in/admin warning banner are implemented; production behavior remains unchanged because the feature requires the explicit beta environment value |

The first Vercel deployment was created manually from the beta branch after
Production branch tracking was changed from `main`. Do not change that tracking
or move the custom hostname to another project. Neon now publishes only an
allowlisted derived projection to the beta Worker. Exact Home, Display,
Inventory, and Arcade observer URLs compare it without rendering it; separately
gated source URLs may render it only after the documented Neon/hub handshake and
retain polling fallback. The beta email proof does not authorize moving
`williamtemple.app` between Resend workspaces: that domain also serves live
LOTTO and the separately hosted FEED application, so any future account
migration requires a coordinated credential cutover for all three applications.

The Phase 3 server settings are deliberately separate from browser connection
flags. Keep them server-only:

```text
LOTTO_REALTIME_SHADOW_PUBLISH=true
LOTTO_REALTIME_HUB_URL=https://lotto-realtime-beta.et2-geiger.workers.dev
LOTTO_REALTIME_EXPECTED_HUB_HOST=lotto-realtime-beta.et2-geiger.workers.dev
LOTTO_REALTIME_AGENCY_ID=william-temple-house
LOTTO_REALTIME_PUBLISH_TOKEN=<rotated beta-only secret>
LOTTO_REALTIME_PUBLISH_TIMEOUT_MS=1500
```

The first Phase 4 browser observer has its own independent switch:

```text
LOTTO_REALTIME_CLIENT_CANARY=true
```

It is currently `true` only in the isolated beta deployment. The app permits an
exact beta Worker `wss://` origin in CSP and issues a read-only observer
configuration only to Home/Display clients that also opt in with
`?realtime=observe`. Polling remains authoritative and rendered; the observer
adds no API request. See
[`REALTIME_CLIENT_CANARY.md`](./REALTIME_CLIENT_CANARY.md) for test and rollback
guidance.

Phase 5 adds a separate beta-only rendered-source switch:

```text
LOTTO_REALTIME_APPLICATION_ENABLED=true
LOTTO_REALTIME_SOURCE_CANARY=true
```

Ordinary beta URLs select the source controller. Source clients perform an
initial `/api/state` handshake, stop only scheduled polling after exact
revision/checksum agreement, and immediately return to adaptive polling if
source authority is lost. `?realtime=poll` forces polling without opening a
socket; `?realtime=observe` retains the Phase 4 diagnostic; and
`?realtime=source` remains a compatibility alias. The flag is independent from
the Phase 4 observer and shadow-publish switches and remains `true` only for the
isolated beta Production environment.
See
[`REALTIME_SOURCE_CANARY.md`](./REALTIME_SOURCE_CANARY.md) for the state machine,
test URLs, validation gates, and rollback.

`LOTTO_REALTIME_APPLICATION_ENABLED` is the master rendered-connection gate.
An explicit `false` overrides both source and observer configuration for new
page loads; change it in Vercel and redeploy the same known-good commit. The
variable is server-only and must be set explicitly in beta and every
production-scoped v2 deployment.

Activation fails closed unless `LOTTO_DEPLOYMENT_ENVIRONMENT` is exactly `beta`
or `production`, the remote
URL is HTTPS, and its hostname exactly matches the expected host. Deploy and
verify the additive schema with the flag still false before installing a newly
rotated token in both providers. Enabling the flag adds one outbox row in the
existing mutation transaction, at most one bounded post-commit Worker request,
and one best-effort outcome update. It does not change `/api/state`, public
polling, or any browser behavior. See
[`REALTIME_SHADOW_PUBLICATION.md`](./REALTIME_SHADOW_PUBLICATION.md) for the
transaction, repair, rollback, and cost contract.

See
[`V2.0_REALTIME_ARCHITECTURE_PLAN.md`](./V2.0_REALTIME_ARCHITECTURE_PLAN.md)
for the phased gates and rollback requirements.

### William Temple House v2.0 production migration decision

The owner has confirmed that the consulting business's existing paid Vercel
Pro account will own a new William Temple House v2.0 project. The exact tested
release-candidate commit will be deployed there with production-scoped Neon,
Blob, auth/Resend, and Cloudflare resources. The beta database, Blob contents,
auth rows, Durable Object storage, and secrets are not migration inputs.

The earliest preferred cutover window is **Thursday, September 3, 2026 after
2:30 PM America/Los_Angeles**, after the pantry's last service period of the
week. This is an operator-attended window, not an automated schedule. Before
changing DNS, verify the Pro deployment on its generated Vercel hostname. Then
assign `williamtemple.app` to the new project and update the Cloudflare apex
record and Auth.js callback configuration as one coordinated change.

Keep both the current production project and the Hobby beta account/project
intact during cutover. The old production deployment is the DNS/domain rollback
target; the beta remains the independent comparison environment. Shut them
down only after the new Pro deployment serves the apex, sign-in and all four
public surfaces pass, realtime and forced polling pass, provider signals are
acceptable through the agreed checkpoint, and the owner explicitly accepts
the migration. Retire their provider resources and secrets deliberately after
acceptance rather than deleting them during DNS work.

### Realtime emergency controls

The application and hub have complementary controls:

- Set `LOTTO_REALTIME_APPLICATION_ENABLED=false` in Vercel and redeploy the
  known-good commit to prevent newly loaded pages from starting any rendered
  realtime connection, including the diagnostic observer.
- Use the Cloudflare control to persistently drain an agency's existing
  sockets. Draining refuses new event connections but continues accepting
  state publications, so staff commands and hub convergence remain available.

Generate a dedicated `CONTROL_TOKEN` independently from `PUBLISH_TOKEN`, store
it only as a Cloudflare Worker secret and in the approved operator credential
store, and never install it in Vercel. The operator command reads the token from
`REALTIME_CONTROL_TOKEN` and requires an exact remote confirmation. For the
current beta Worker:

```bash
REALTIME_CONTROL_BASE_URL=https://lotto-realtime-beta.et2-geiger.workers.dev \
REALTIME_CONTROL_AGENCY_ID=william-temple-house \
REALTIME_CONTROL_MODE=drain \
REALTIME_CONTROL_CONFIRM=drain:william-temple-house@lotto-realtime-beta.et2-geiger.workers.dev \
npm run realtime:control
```

Use `REALTIME_CONTROL_MODE=status` with the corresponding `status:`
confirmation to inspect the drain state. To restore service, resume the Worker
first, then set the Vercel application gate to `true` and redeploy:

```bash
REALTIME_CONTROL_BASE_URL=https://lotto-realtime-beta.et2-geiger.workers.dev \
REALTIME_CONTROL_AGENCY_ID=william-temple-house \
REALTIME_CONTROL_MODE=resume \
REALTIME_CONTROL_CONFIRM=resume:william-temple-house@lotto-realtime-beta.et2-geiger.workers.dev \
npm run realtime:control
```

On drain or any other source failure, a visible client performs one immediate
Neon reconciliation and then resumes the complete adaptive polling schedule:
post-change burst, operating/pre-open clamps, long-idle/off-hours backoff,
visibility pause, and bounded error retry. WebSocket reconnect timing is a
separate bounded loop and does not reset polling history.

### Production environment variables

```
AUTH_BYPASS=false
AUTH_SECRET=<generated>
AUTH_TRUST_HOST=true
DATABASE_URL=postgresql://...sslmode=require
EMAIL_FROM=login@williamtemple.app
RESEND_API_KEY=re_...
ADMIN_EMAIL_DOMAIN=williamtemple.org
BLOB_READ_WRITE_TOKEN=<added automatically when the public Blob store is connected>
NODE_ENV=production
```

### Hosted Appearance asset storage

LOTTO v1.22.1 stores uploaded Appearance logos and generated install icons in
a **public Vercel Blob store**. Public access is intentional: these brand assets
must load on public LOTTO pages, in installed-app metadata, and from external
email clients. The generated URL includes a random suffix and contains no
private operational data.

Configure this once in each agency's Vercel project:

1. Open **Storage → Create Database → Blob**.
2. Choose **Public** access. Name the store `lotto-brand-assets` (or another
   agency-specific name).
3. Connect it to **Production** and **Preview**. Vercel adds
   `BLOB_READ_WRITE_TOKEN` automatically; keep the default variable name.
4. Redeploy the project so the running Functions receive the credential.
5. In **Admin → Advanced → Appearance**, upload a small test logo and install
   mark, then save the draft. Reload and verify both previews still load.
6. Redeploy once more and verify the saved previews still load. This complete
   upload/save/reload/redeploy cycle is the release gate for durable branding.
   If the appearance is activated, also request a test sign-in email and verify
   its logo loads.

Do not paste the token into Appearance configuration, Neon, or client-visible
variables. Local/self-hosted development does not need Blob and continues to
write `data/brand-assets/` (or `BRAND_ASSETS_DIR`). On Vercel, LOTTO refuses the
upload with a specific storage-configuration message if neither the Blob token
nor a Vercel OIDC/store-id pairing is available; it never falls back to the
deployment filesystem. Server uploads are limited to 4 MB so their multipart
envelope remains below Vercel Functions' 4.5 MB request limit.

Before deploying v1.22.0, apply the complete `schema.sql` to the agency's Neon
database. The additive authentication migration adds
`verification_token.type` (default `magic_link`) plus
`verification_token_identifier_type_idx`; OTP and Magic Link credentials can
then coexist without one flow deleting the other. Do not drop or recreate the
table. Verify with:

```sql
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'verification_token'
  AND column_name = 'type';

SELECT to_regclass('public.verification_token_identifier_type_idx')
  AS token_type_index;
```

Before deploying v1.21.0, apply `schema.sql` to the agency's Neon database so
`raffle_session_summaries` and the singleton `feed_integration_credentials`
store exist. After deployment, sign in and use **Admin → History → Sync With
FEED → Setup** to generate the one active token, then copy the displayed URL and
token into FEED's administrator-only connection settings. LOTTO stores only a
hash; FEED encrypts its copy. Do not use `AUTH_SECRET`, a NextAuth token, or a
database credential.

An existing `LOTTO_FEED_INTEGRATION_TOKEN` Vercel variable remains a migration
fallback only while no database token exists. Once an administrator generates
the in-app token, the database hash takes precedence immediately and the
legacy variable can be removed without redeploy-time pairing work.

With no active Appearance row, the safe default is William Temple House. Use
the in-app Appearance workflow rather than a build-time profile variable.

## New agency deployment runbook

This is the full, step-by-step path from "nothing exists yet" to a live
production deployment for a new agency, written up after actually launching
St. Johns Food Share (2026-07-18). Follow it in order — several steps have
non-obvious failure modes that are easy to misdiagnose as something else. Where
a step is Vercel/Neon/Resend/Namecheap-specific, that's called out; swap in
whatever registrar/host the agency actually uses.

### 0. Prerequisites

> **Configurable branding (shipped in v1.20.0):** with the
> [`CONFIGURABLE_BRANDING_PLAN.md`](./CONFIGURABLE_BRANDING_PLAN.md) work, a new
> agency no longer needs a compiled brand profile at all — identity, logos,
> icons, and colors are configured in the Admin **Appearance** wizard after
> first sign-in, and the deployment starts as the WTH-shaped default. WTH is the
> only compiled profile; do not add another compiled agency theme.
> For the configurable path, `schema.sql` must be applied
> (it now includes `brand_configurations`) and a public Vercel Blob store must
> be connected as described above so uploaded assets persist across deploys.

- The Appearance workflow and asset store are available. The first deployment
  can launch temporarily with the compiled WTH default; activate the agency's
  saved Appearance after the first staff sign-in. Confirm `npm run build` and
  test both the default and a representative saved appearance before merging —
  a merge to `main` redeploys **every** agency sharing this repo (see [Shared
  branch, one merge affects everyone](#shared-branch-one-merge-affects-everyone)).
- You have (or can get) admin access to: the shared Vercel team, a Neon
  account/project for this agency, a Resend account, and the agency's domain
  registrar.

### 1. Create the Vercel project and connect Git

1. In the Vercel dashboard, create a new project for the agency (or use one a
   teammate already scaffolded — check **Settings → Git** first; it may not be
   connected yet).
2. **Settings → Git → Connect Git Repository** → pick the same repo every other
   agency deploys from (e.g. `MattGeiger/LOTTO`). This opens a repo-picker
   that may appear as a **separate OS-level popup window** outside whatever
   browser-automation tooling you're using — if a click on "GitHub" appears to
   hang, check for a popup before assuming it failed.
3. **Settings → Environments**: confirm the `Production` environment's branch
   tracking is `main` (this is usually already correct — it's the repo's
   default branch — but verify it explicitly).
4. **Verify Settings → Build and Deployment → Framework Preset reads "Next.js".**
   This is the single most important checkbox in this whole runbook and it is
   **not guaranteed to auto-detect correctly**, especially for a project that
   was scaffolded before Git was connected (e.g. by connecting a database
   first). If it silently defaults to **"Other"**, `npm run build` still
   succeeds and the deployment shows **Ready** — but every route serves
   Vercel's generic `404: NOT_FOUND` in production, because the build output
   isn't wired up as a Next.js app. There is no error anywhere pointing at this
   — you have to know to check it. See
   [`docs/ISSUES.md`](./ISSUES.md) for the full failure story. If you have to
   fix this *after* a deployment already ran, saving the corrected setting does
   **not** retroactively fix that deployment — you must trigger a new one
   (**Deployments → ⋯ → Redeploy**, "latest Project Settings" applied).
5. Connecting Git does **not** automatically trigger a first deployment. If
   **Deployments** is empty after connecting, trigger one manually:
   **Deployments → ⋯ (top right) → Create Deployment**, type `main`, and
   confirm it resolves to **Production** before deploying.

### 2. Provision a dedicated Neon database

1. In the new Vercel project: **Storage → Create Database → Neon → Continue**.
   This uses Vercel's Neon Marketplace integration on the "Launch" plan
   (usage-based: storage + compute-hours; not contractually free, but
   typically near-zero for a low-traffic queue app). **Never reuse another
   agency's database** — always create a new one here.
2. Name it something recognizable (matching the project name is a good
   default) and pick the same region as the Vercel deployment.
3. When connecting the new database to the project, Vercel asks which
   **Environments** to inject its variables into — the default is
   **Production and Preview**, which is correct; take it. (WTH's database was
   set up Production-only at some point, which is why its PR/branch preview
   builds fail — see
   [Known issue: WTH previews fail](#known-issue-wth-preview-deployments-fail-production-is-unaffected)
   below. Don't repeat that for a new agency.) Leave the **Custom Environment
   Variable Prefix** field empty — the app expects the bare `DATABASE_URL`
   name, not a prefixed one.

### 2a. Provision hosted brand-asset storage

Before an administrator uses the Appearance upload controls, create and connect
the agency's public Vercel Blob store by following
[Hosted Appearance asset storage](#hosted-appearance-asset-storage). This is
separate from Neon: Neon stores the versioned Appearance configuration, while
Blob stores the referenced logo/icon bytes.

### 3. Apply the database schema

**This step is easy to skip and the failure mode is confusing** — the app will
otherwise deploy successfully, the public `/display` board will even work (it
falls back to defaults), but staff sign-in silently breaks: OTP requests fail
with a generic "Unable to issue code," and Magic Link fails with NextAuth's
generic "Configuration" error. Neither error mentions the database. Root cause:
those flows read/write `verification_token`, `users`, `accounts`, `sessions`,
and `otp_failures` — tables that don't exist yet on a freshly created database.

The canonical schema lives in [`schema.sql`](../schema.sql) at the repo root
(applied idempotently by `scripts/apply-schema.mjs`, run via `npm run
db:migrate`). **Do not hand-copy a subset of it into this doc again** — that's
exactly how this step got missed on the first St. Johns launch: an older
version of this doc embedded a two-table snippet (`raffle_state` +
`raffle_snapshots` only) that predated the NextAuth and AI-translation tables
being added to `schema.sql`, and following the doc instead of the real file
silently reproduced the same gap. Always point at the file.

**How you apply it depends on how you got the connection string:**

- **If you have `DATABASE_URL` locally** (e.g. you provisioned the Neon
  database directly at [console.neon.tech](https://console.neon.tech) instead
  of through Vercel's Marketplace flow, then linked it to Vercel as an
  *existing* database): put it in `.env.local` and run
  `npm run db:migrate` from the repo root. This is the easy path — prefer it
  for future agencies if you have the choice.
- **If the database was created through Vercel's "Create Database" flow (as
  in step 2 above)**: `DATABASE_URL` is stored as a Vercel **Sensitive**
  environment variable, which **cannot be revealed again after creation** —
  not in the dashboard (no reveal/eye icon, only a lock icon), not via
  `vercel env pull` (even with `--yes`, even from a real interactive
  terminal — it writes the literal string `"[SENSITIVE]"` to the `.env` file
  instead of the value), and not via the Neon integration's own
  ".env.local"/"Show secret" panel. This is intentional Vercel platform
  behavior for that variable type, not a bug to work around by trying harder.
  Instead, run the SQL directly against the database without ever needing the
  connection string:
  1. Vercel dashboard → project → **Storage** → the database → **Query** (in
     the left nav, under "Database").
  2. The first write query in a session prompts for **2FA** (authenticator
     code or passkey) — this is your Vercel account's own security, not
     something to route around; have the account owner complete it.
  3. Toggle **Read-only** off.
  4. The query box only accepts **one SQL statement per run** — pasting the
     whole multi-statement `schema.sql` fails with `cannot insert multiple
     commands into a prepared statement`. Copy each `CREATE TABLE` /
     `CREATE INDEX` statement from `schema.sql` one at a time, in file order
     (foreign keys mean order matters — e.g. `users` before `accounts` and
     `sessions`; `ai_configurations`/`translations` before `usage_records`),
     and run each with the ⌘+Enter / Run button.
  5. Verify: **Schema** tab in the same left nav, switch the schema selector
     from Neon's own default (`neon_auth`) to **`public`**, and confirm all 12
     pre-v1.20 tables plus `brand_configurations` from `schema.sql` are listed
     (`accounts`, `ai_configurations`, `brand_configurations`, `languages`,
     `otp_failures`, `raffle_snapshots`, `raffle_state`, `sessions`,
     `system_prompts`, `translations`, `usage_records`, `users`, and
     `verification_token`).

### 4. Set environment variables

Set the agency's full auth, database, email, storage, and optional FEED variable
block in the new Vercel project, scoped to **Production** (and Preview for the
app-config vars — not the database ones, which you already scoped in step 2).
After deployment, sign in and activate the saved Appearance.

### 5. Point the domain at Vercel

1. **Vercel → project → Domains → Add** the agency's domain. Vercel shows the
   DNS record(s) needed (typically an `A` record for the apex domain pointing
   at Vercel's anycast IP, refreshed periodically — use whatever Vercel's
   Domains page currently displays, don't hard-code an IP here).
2. At the registrar (Namecheap, in St. Johns' case): a newly purchased domain
   is usually still parked with the registrar's own placeholder records — a
   **URL Redirect Record** for `@` and a **CNAME** for `www` pointing at the
   registrar's parking page. **Remove those first**, then add Vercel's `A`
   record for `@`. Leaving the parking redirect in place will make the domain
   keep resolving to the registrar's placeholder instead of Vercel.
3. DNS propagation for a fresh `A` record is often much faster than the
   "may take a few hours" warnings suggest (it took well under a minute for
   a new agency domain), but don't assume — verify before moving on:
   `dig +short A <domain> @8.8.8.8` should return Vercel's IP, and the
   Vercel Domains page should show "Valid Configuration"/no warning icon.

### 6. Verify the sending domain in Resend

1. Resend dashboard → **Domains → Add Domain** → the agency's domain.
2. Resend shows a DKIM `TXT` record, an SPF `MX` + `TXT` record pair (both on
   a `send` subdomain), and an optional DMARC `TXT` record. Add all of them at
   the registrar.
3. **Namecheap-specific gotcha:** a fresh domain's Mail Settings default to
   **"Email Forwarding"**, which does not expose a way to add a custom `MX`
   record in the UI at all. Switch **Advanced DNS → Mail Settings** to
   **"Custom MX"** first (safe to do on a brand-new domain with no configured
   forwarding addresses yet — check the forwarding-addresses list is actually
   empty before switching on a domain that isn't brand new), *then* add
   Resend's `MX` record alongside the `TXT` records.
4. Verification is asynchronous and happens in stages — expect the domain
   status to move `Not Started` → `Pending` → `Verified` over a couple of
   minutes as DKIM, then SPF/MX, are individually confirmed. Click
   **Verify DNS Records** to kick off a check rather than only waiting
   passively; each individual record's status updates independently
   (DKIM commonly verifies before SPF/MX).
5. Once verified, create a **new API key** scoped to **Sending access**
   (least privilege — matches the pattern of existing agency keys) under
   **API Keys → Create API Key**, and put it in the Vercel project as
   `RESEND_API_KEY`. Domain-scoping the key is only available once the domain
   itself shows Verified.

### 7. First production deployment

If you haven't already triggered one in step 1.5, do it now
(**Deployments → ⋯ → Create Deployment**, branch `main`) so the app is running
against the schema and env vars from steps 3–4.

### 8. Deploy checklist

1. `/display` loads and shows the agency's brand (logo, colors, copy) — not
   another agency's.
2. `/admin` redirects to sign-in (auth required); `/api/state` reads/writes
   succeed once signed in.
3. **Verification Code and Magic Link both succeed** for an address allowed by the agency's
   `ADMIN_EMAIL_ALLOWLIST`/`ADMIN_EMAIL_DOMAIN` policy, and both are rejected
   for a disallowed address. Don't just check that the request returns
   `200` — confirm the actual email arrives, since a `200` with a missing
   schema (step 3) can still surface as a generic error *after* that point in
   some flows. If either fails with "Unable to issue code" or NextAuth's
   "Configuration" page, re-check step 3 first — that's the most likely cause
   even though neither error message mentions the database. For Magic Link,
   verify the emailed URL first opens `/login/confirm`, refreshing that page
   does not expire the link, and only selecting **Sign in** completes the
   session. Inspect both messages with images disabled and confirm the agency
   name remains visible as text.
4. For queue-only deployments: nav omits Inventory, `/inventory` returns 404,
   CSP has no FEED origin. For FEED-enabled deployments: confirm the
   agency-specific inventory and CSP origin, and that a failed feed never
   falls back to another agency's endpoint.
5. On an actual mobile device or a resized mobile viewport, check the
   personalized homepage (`/`) for the header logo overlapping "NOW SERVING" —
   this only shows up for brands whose logo lockup is taller relative to its
   width than William Temple House's wide horizontal wordmark. See
   [`docs/ISSUES.md`](./ISSUES.md) for the fix if it recurs (it shouldn't — the
   header logo is now height-capped independent of aspect ratio — but re-check
   after any change to `BrandLogo` or the personalized homepage header).
6. Install the PWA to a homescreen and confirm the label matches the
   profile's intended `shortName` (`manifest.ts` maps `shortName` →
   `short_name`, which iOS/Android prefer over `name` for the launcher label).

### Known issue: WTH preview deployments fail (production is unaffected)

Every PR/branch preview build in the `wthlotto` Vercel project fails with
`Error: DATABASE_URL is required for production deployment`, while
`williamtemple.app` itself (which only ever builds from `main`) stays green.
Root cause: the Neon-integration variables in that project (`DATABASE_URL` and
siblings) are scoped **Production only**, not **Production and Preview** —
likely because that integration was connected before Vercel defaulted new
connections to include Preview. This is a real, open gap (nobody can preview a
WTH branch before merging), but it is **not** a production risk, and fixing it
means editing the live WTH project's environment variables — do not do that
without explicit direction, per the standing rule that WTH's production
project is look-but-don't-touch. If asked to fix it: re-scope those specific
variables to include Preview in **Settings → Environment Variables**, which
does not require rotating the secret.

### Shared branch, one merge affects everyone

Every agency's Vercel project tracks the same `main` branch. Merging a PR to
`main` triggers a new production deployment for **every** agency's project
simultaneously — there is no way to ship a change to just one agency's
project. Before merging anything (not just new-agency setup work): run
`npm run build` for the WTH default and exercise a representative saved
appearance locally first. A change that only breaks runtime appearance
resolution will still ship to everyone the moment it merges.

## Theme / design tokens

`src/app/globals.css` is the ordered theme import manifest. Shared foundations,
protected operational semantics, and component rules live under
`src/app/styles/shared/`; deployment identity layers live under
`src/app/styles/brands/`. Agency selectors must not replace universal status
semantics. See [`docs/CSS_THEME_ARCHITECTURE.md`](./CSS_THEME_ARCHITECTURE.md)
and [`docs/UI_DESIGN.md`](./UI_DESIGN.md).
