# LOTTO realtime public-state hub

This Worker is the isolated Phase 1/2 proof for LOTTO's provisional v2.0
architecture. It uses one SQLite-backed Durable Object per agency to retain the
latest allowlisted public state and push revisioned updates to subscribed
browsers through the WebSocket Hibernation API.

It is not yet the production read path. Neon remains authoritative and the
existing `/api/state` polling path remains unchanged.

## Local development

1. Copy `.dev.vars.example` to `.dev.vars` and replace the placeholder token.
2. Run `npm run realtime:dev` from the repository root.
3. Verify `http://localhost:8787/health`.
4. In another terminal, run
   `REALTIME_TEST_PUBLISH_TOKEN=<local-token> npm run realtime:verify`.

Public routes use the agency id `william-temple-house` during the beta proof:

- `GET /v1/agencies/william-temple-house/state`
- `GET /v1/agencies/william-temple-house/events` with a WebSocket upgrade
- `POST /v1/agencies/william-temple-house/publish` with
  `Authorization: Bearer <PUBLISH_TOKEN>`
- authenticated `GET`/`POST /v1/agencies/william-temple-house/control` with a
  distinct `CONTROL_TOKEN`

The publish route accepts only protocol-valid, checksummed envelopes and
rejects stale revisions or same-revision checksum conflicts. Subscribers cannot
write data.

The control route accepts `{ "mode": "drain" }` or `{ "mode": "resume" }`.
Drain state is stored in the agency Durable Object so it survives hibernation
and deployments. Draining closes current sockets and refuses new event upgrades
with HTTP 503, but publication and snapshot storage continue. Resume allows new
connections, which immediately receive the newest stored projection. The
control token is intentionally different from the Vercel-held publish token.

## Remote beta

The standalone proof is deployed at
`https://lotto-realtime-beta.et2-geiger.workers.dev`. It is intentionally not
connected to Neon or a LOTTO client yet. Hash-based Cloudflare preview URLs are
disabled; the account `workers.dev` route is the only deployed hostname.

After rotating `PUBLISH_TOKEN` and the independent `CONTROL_TOKEN`, allow Cloudflare's serving deployment a short
propagation window before running the remote verifier. The verifier has passed
health, authentication, snapshot, WebSocket delivery, idempotency, monotonic
revision, and CORS checks against the remote beta Worker.

`npm run realtime:load` runs the bounded fanout harness with 1, 10, 100, and
200 clients by default. It accepts a smaller comma-separated set through
`REALTIME_LOAD_CLIENTS`, caps any one group at 500, caps one run at 1,000 total
connections, and refuses a remote host unless
`REALTIME_TEST_ALLOW_REMOTE=beta`. It writes only to the synthetic
`william-temple-house-load-e2e` object.

`npm run realtime:benchmark` runs equal polling and WebSocket cohorts against
the separate synthetic `william-temple-house-benchmark-e2e` object. It records
delivery latency, checksum convergence, snapshot request counts, and automated
pass/fail gates in a timestamped JSON artifact. The benchmark adds a stricter
remote-host equality check and cannot target an application or production
hostname accidentally. See `docs/REALTIME_BENCHMARK.md` for configuration,
safe local/remote commands, evidence interpretation, and the limits of this
Phase 2 comparison. An optional nonzero `REALTIME_BENCHMARK_IDLE_MS` adds a
realtime-only idle/wake probe on `william-temple-house-idle-e2e`; polling never
touches that object during its idle window.

## Deployment safety

Deploy only to the isolated Cloudflare beta Worker named
`lotto-realtime-beta`. Set `PUBLISH_TOKEN` and the distinct `CONTROL_TOKEN` with
`wrangler secret put`; never add either to `wrangler.jsonc`, Git, screenshots,
logs, or documentation. Keep `CONTROL_TOKEN` out of Vercel entirely.

Operators use `npm run realtime:control` with the token already present in
`REALTIME_CONTROL_TOKEN`. Local targets need no confirmation. Every remote
status, drain, or resume requires
`REALTIME_CONTROL_CONFIRM=<mode>:<agency>@<exact-host>`, which prevents a copied
command from controlling the wrong agency or Worker. Drain first during an
incident, then set `LOTTO_REALTIME_APPLICATION_ENABLED=false` in Vercel and
redeploy so newly loaded pages also remain on adaptive polling. Resume the hub
before re-enabling the Vercel application gate.

Production publication and client feature flags must remain disabled until the
beta exit gates in `docs/V2.0_REALTIME_ARCHITECTURE_PLAN.md` pass.

The verification, load, and A/B benchmark scripts write only to their dedicated
synthetic objects. Remote beta verification additionally
requires `REALTIME_TEST_ALLOW_REMOTE=beta`, the beta Worker URL in
`REALTIME_TEST_BASE_URL`, and `https://beta.williamtemple.app` in
`REALTIME_TEST_ORIGIN`.
