# v2.0.0-rc.3 production cutover (Hobby account)

**Status:** Executed September 7, 2026. First service day completed
September 8, 2026 with realtime as the client state source and no operational
issues reported.

The steps below are kept as the executed record and as the procedure for the
eventual Pro-account migration, which will repeat them against new resources.

This deploys RC.3 to the **existing personal Hobby Vercel project serving
`williamtemple.app`**, with realtime active. It is deliberately not the Pro-account
migration described in
[`V2.0_REALTIME_ARCHITECTURE_PLAN.md`](./V2.0_REALTIME_ARCHITECTURE_PLAN.md)
Phase 7; that remains the eventual destination and is blocked on the
organization's Pro-license approval. Treat this as a validation step toward it.

Because this reuses the account and project already serving the apex, there is
no generated-hostname staging step and no DNS change. That removes the domain
risk but also removes the pre-cutover rehearsal surface: **the rollback target is
the previous production deployment in the same Vercel project**, promoted from
the Vercel dashboard.

## What is different from the beta

| Concern | Beta | RC.3 production |
| --- | --- | --- |
| `LOTTO_DEPLOYMENT_ENVIRONMENT` | `beta` | `production` |
| Sandbox banner / `robots.txt` blocking | On | **Off** — requires exactly `beta` |
| Worker | `lotto-realtime-beta` | `lotto-realtime-production` |
| Durable Object namespace | Beta | Separate; created by the named environment |
| Allowed origins | localhost, preview, `beta.williamtemple.app` | `https://williamtemple.app` only |
| Publish / control tokens | Beta values | **Freshly generated; never copied** |

## Order of operations

The first two steps are not interchangeable. `raffle_state.revision` is written
inside every mutation transaction
([`state-manager-db.ts`](../src/lib/state-manager-db.ts)), not only when
publication is enabled, so RC.3 code against an unmigrated production database
fails on every staff write.

### 1. Migrate production Neon (before any deploy)

`schema.sql` is idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT
EXISTS`), so this is safe to run against the live database and safe to re-run.

```bash
DATABASE_URL='<production Neon URL>' node scripts/apply-schema.mjs
```

Confirm afterwards that `raffle_state.revision` exists, that
`raffle_public_state_publications` exists with its four indexes, and that the
outbox is empty. The existing production deployment continues to work with this
schema applied — the column defaults to `0` and the old code ignores both.

### 2. Deploy the production Worker

```bash
npm run realtime:check:production   # dry run; confirms bindings and origins
npm run realtime:deploy:production
```

Then install freshly generated secrets **for that environment only**:

```bash
npx wrangler secret put PUBLISH_TOKEN --config workers/realtime-hub/wrangler.jsonc --env production
npx wrangler secret put CONTROL_TOKEN --config workers/realtime-hub/wrangler.jsonc --env production
```

Generate each with `openssl rand -base64 48`. Do not reuse a beta token, and do
not install `CONTROL_TOKEN` in Vercel — it is an operator-only credential.

### 3. Verify the Worker before any client points at it

```bash
REALTIME_TEST_BASE_URL='https://lotto-realtime-production.et2-geiger.workers.dev' \
REALTIME_TEST_ALLOW_REMOTE=production \
REALTIME_TEST_ORIGIN='https://williamtemple.app' \
REALTIME_TEST_PUBLISH_TOKEN='<production publish token>' \
REALTIME_TEST_CONTROL_TOKEN='<production control token>' \
npm run realtime:verify
```

This exercises health, authentication, snapshot, WebSocket, idempotency,
monotonicity, and origin policy against the synthetic
`william-temple-house-e2e` agency, so it never writes to the live agency's
Durable Object.

### 4. Deploy the app with realtime still off

Set the production environment in Vercel, deliberately leaving realtime
disabled for the first deploy:

```
LOTTO_DEPLOYMENT_ENVIRONMENT=production
LOTTO_REALTIME_APPLICATION_ENABLED=false
LOTTO_REALTIME_SHADOW_PUBLISH=false
LOTTO_REALTIME_SOURCE_CANARY=false
LOTTO_REALTIME_HUB_URL=https://lotto-realtime-production.et2-geiger.workers.dev
LOTTO_REALTIME_EXPECTED_HUB_HOST=lotto-realtime-production.et2-geiger.workers.dev
LOTTO_REALTIME_AGENCY_ID=william-temple-house
LOTTO_REALTIME_PUBLISH_TOKEN=<production publish token>
```

`LOTTO_DEPLOYMENT_ENVIRONMENT` is read at **build** time, not only at runtime:
`/robots.txt` is a statically prerendered route (`○ (Static)` in the build
output), so its contents are fixed when the bundle is built. Set the variable in
the Vercel project environment *before* triggering the deploy, and treat any
later change to it as requiring a fresh deploy rather than a restart. This was
verified both ways locally — a `production` build serves `Allow: /` with no
`X-Robots-Tag` and no banner; a `beta` build serves `Disallow: /` with
`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`.

Deploy and confirm the app behaves exactly as v1.26 did: pages render, staff can
sign in, one harmless mutation succeeds and advances `raffle_state.revision`,
`/api/state` responds, adaptive polling is the only state source, and **no beta
banner appears and `/robots.txt` allows crawling**. This step proves the schema
and the new build in isolation from the hub.

`LOTTO_REALTIME_EXPECTED_HUB_HOST` is not optional in production. It defaults to
the beta Worker hostname, and the build compares it against
`LOTTO_REALTIME_HUB_URL`; a mismatch throws rather than emitting a
Content-Security-Policy for the wrong origin. The `connect-src` directive is
generated from it at build time, so the hub origin must be correct *before* the
build, not merely before the connection.

### 5. Enable publication, then rendering

Enable in two stages so a failure is attributable. Each stage is a Vercel
environment change plus a redeploy of the same commit.

1. `LOTTO_REALTIME_SHADOW_PUBLISH=true` — staff writes now publish to the hub.
   Verify one mutation produces a matching Neon/outbox revision with status
   `accepted` and an identical checksum in the hub snapshot. `/admin/realtime`
   is the diagnostic for this and is available in production as of rc.3
   (administrator session required). Clients are still
   polling; nothing user-visible changes.
2. `LOTTO_REALTIME_APPLICATION_ENABLED=true` and
   `LOTTO_REALTIME_SOURCE_CANARY=true` — ordinary Home, Display, Inventory, and
   Arcade select realtime after the exact handshake.

Verify after stage 2: all four surfaces connect at the same revision,
`?realtime=poll` opens no socket, a drain forces polling fallback, resume
restores realtime, and the Display connects on the iOS 15.4 simulator.

## Rollback

In increasing order of severity, and all reversible:

1. **Realtime misbehaving:** set `LOTTO_REALTIME_APPLICATION_ENABLED=false` and
   redeploy the same commit. Clients return to adaptive polling. **Still never
   exercised on any hosted environment** — see the caveat below.
2. **Hub misbehaving with sockets open:** drain it, which closes sockets and
   refuses new ones while still accepting publication.
   ```bash
   npm run realtime:control -- --mode drain --agency william-temple-house
   ```
   Resume with `--mode resume`. The confirmation string is
   `drain:william-temple-house@<hub hostname>`.
3. **Build itself at fault:** promote the previous production deployment in the
   Vercel dashboard. The additive schema does not need reverting; the older code
   ignores the revision column and the outbox table.

## Deployment record

- Production Neon migrated September 7, 2026 via the Neon SQL editor:
  `raffle_state.revision` present, `raffle_public_state_publications` present
  with 4 indexes, 0 outbox rows, `current_revision` 0.
- Worker `lotto-realtime-production` deployed at
  `https://lotto-realtime-production.et2-geiger.workers.dev`, version
  `efa9f993-9627-4466-b395-173263662db3`. Health reports
  `environment: production`. With no secrets installed, publish and control both
  refuse with 503, a disallowed origin is refused with 403, and the allowed
  origin reaches an empty hub.
- Production publish and control secrets installed September 7, 2026, generated
  independently and never copied from beta. `CONTROL_TOKEN` is deliberately not
  present in Vercel.
- Remote protocol verification passed against the production hub:
  `health, authentication, snapshot, websocket, idempotency, monotonicity, cors,
  drain, resume` all ok at `latestRevision: 3`. This exercised the Cloudflare
  drain/resume control — rollback lever 2 — on production infrastructure. The
  run used the synthetic `william-temple-house-e2e` agency; the live
  `william-temple-house` object remained empty afterwards, confirming isolation.
- Before the secrets existed, a bogus control token was rejected with 401,
  confirming the hub fails closed on authentication as well as configuration.

## Incident: revision 0 broke public reads on cutover

Immediately after the stage-A deploy, every `/api/state` request returned 500
while all page routes still rendered. Cause: the migration defaults
`raffle_state.revision` to 0 and only a write allocates a positive revision, but
`safeReadStateWithRevision` rejected anything below 1. A migrated database is
therefore unreadable between the migration and its first staff write.

Recovered in seconds with a single statement, no redeploy:

```sql
update raffle_state set revision = 1 where id = 'singleton' and revision = 0;
```

The code now accepts revision 0 as the legitimate pre-write state, so no future
migrating deployment hits this. **Any other environment migrated from an
existing database needs either that statement or the fix deployed before its
first public read.**

## First service day

September 8, 2026. Realtime served as the client state source for the full
service day with no operational issues. Staff reported admin-to-display
propagation as immediate, against a measured ~30 second adaptive-polling
baseline recorded during stage B on the same deployment.

## Known caveats

- **The Vercel application gate has never been live-toggled.** It passes
  configuration, mount, suite, and production-build tests, but the operational
  exercise (disable deployment followed by restore deployment) has not been run
  on any hosted environment. It is rollback lever #1. Exercise it deliberately
  during a quiet period rather than discovering its behavior during an incident.
- **No generated-hostname rehearsal.** Deploying into the project that already
  serves the apex means the first real test is on the live domain. Prefer a
  window outside pantry service hours.
- **Stable-release gates remain open:** the Pro account, ten representative
  service days, provider-wide fault injection, physical iPadOS 15.8 device
  validation, and the measured ≥95% reduction in public-origin Neon reads. RC.3
  is a release candidate for that reason.
- **Hobby account limits.** The account has no Vercel support path and lower
  function/bandwidth allowances than Pro. Watch usage during the first service
  day; see [`USAGE_COSTS.md`](../USAGE_COSTS.md).

## First service day monitoring

Follow the lean launch checklist in
[`V2.0_REALTIME_ARCHITECTURE_PLAN.md`](./V2.0_REALTIME_ARCHITECTURE_PLAN.md).
Roll back immediately on unexplained revision divergence, repeated fallback on a
healthy network, a failed newest publication, material Function errors, or an
unexpected usage surge.
