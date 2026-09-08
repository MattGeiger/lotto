# Realtime client canary

## Status

This document defines the first Phase 4 browser integration for LOTTO's
provisional v2.0 realtime architecture. The implementation is beta-only,
disabled by default, and observational. It is not the public-state source and
does not reduce Neon or Vercel usage yet.

Home, Display, Inventory, and the Arcade banner can open one native WebSocket to
the isolated Cloudflare Durable Object, validate its public-state envelope, and
compare that state with the existing `/api/state` result. The ordinary adaptive
polling path continues to fetch and render all visible queue state.

## Safety boundary

Two independent gates are required:

1. The server-only `LOTTO_REALTIME_CLIENT_CANARY=true` flag must be present in a
   deployment explicitly marked `LOTTO_DEPLOYMENT_ENVIRONMENT=beta`.
2. The browser URL must contain exactly `?realtime=observe`.

The flag is rejected outside beta. The configured hub must be an HTTPS origin
whose hostname exactly matches `LOTTO_REALTIME_EXPECTED_HUB_HOST`; the browser
receives only the derived `wss://` subscription URL and opaque agency ID. The
publish token remains server-only. When the flag is off, the server emits no
canary configuration and the normal CSP does not include the Worker origin.

The initial cohort URLs are:

```text
https://beta.williamtemple.app/?realtime=observe
https://beta.williamtemple.app/display?realtime=observe
https://beta.williamtemple.app/inventory?realtime=observe
https://beta.williamtemple.app/arcade?realtime=observe
```

In RC.2, removing the query parameter returns that browser to the ordinary
default realtime source. Use `?realtime=poll` for a polling-only control with
no realtime socket.

## Observer state machine

The observer uses the browser's native `WebSocket`; no client SDK or new
dependency is shipped.

1. Open exactly one subscribe-only socket for the configured agency.
2. Parse each text frame through the strict protocol-v1 envelope schema.
3. Require the configured agency ID and recompute the SHA-256 checksum over the
   allowlisted public projection.
4. Close permanently with policy code `1008` if the frame is malformed, belongs
   to another agency, or fails its checksum.
5. Read the authoritative Neon revision from the
   `x-lotto-state-revision` header on the existing `/api/state` response and
   hash that response's public projection locally. The revision and payload
   come from one database query; this adds no fetch, Function invocation, or
   Neon read.
6. Require revision and checksum agreement when the revision header is
   available. Local file storage omits the header and retains checksum-only
   comparison. The pushed state is never passed to the rendering path.
7. On a transport close, reconnect after 1, 2, 4, 8, and 16 seconds, then stop.
   A valid message resets the consecutive-failure count.
8. When the document is hidden, clear any pending retry and close the socket.
   When it becomes visible, start one fresh connection. No fixed heartbeat,
   background timer, or overlapping socket is used.

The visible beta badge reports connection state, the latest hub revision, and
one comparison state:

| Comparison | Meaning |
| --- | --- |
| `Waiting for comparison` | One side has not supplied a valid checksum yet |
| `Neon match` | The pushed public payload and polled public payload are identical |
| `Hub ahead; polling unchanged` | The hub revision is newer than the authoritative poll revision |
| `Polling ahead; hub delayed` | The authoritative poll revision is newer than the hub revision |
| `State mismatch` | Both sides are present but do not agree and the hub is not demonstrably newer |

The badge is test instrumentation, not a supported public status indicator.
It intentionally exposes no ticket search, session, email, token, payload, or
staff identity.

## Bounded browser telemetry

The latest summary is available to a tester at:

```js
window.__LOTTO_REALTIME_CANARY__
```

Every change also dispatches a `lotto:realtime-canary` `CustomEvent`. The value
contains only connection/comparison status, hub and polled revisions and
checksums, message and reconnect counts, delivery/convergence timings, and an
update timestamp.
It is in-memory only and is not posted to Vercel, Neon, Cloudflare, or an
analytics provider by this slice.

## Beta configuration

Keep all values server-only; none uses a `NEXT_PUBLIC_` prefix:

```text
LOTTO_DEPLOYMENT_ENVIRONMENT=beta
LOTTO_REALTIME_CLIENT_CANARY=true
LOTTO_REALTIME_HUB_URL=https://lotto-realtime-beta.et2-geiger.workers.dev
LOTTO_REALTIME_EXPECTED_HUB_HOST=lotto-realtime-beta.et2-geiger.workers.dev
LOTTO_REALTIME_AGENCY_ID=william-temple-house
```

Enabling the browser observer does not require or expose
`LOTTO_REALTIME_PUBLISH_TOKEN`. Shadow publication must already be healthy so
the Durable Object has a current projection, but its switch remains independent.

## Validation runbook

1. Confirm the beta Admin realtime diagnostic reports the newest outbox row as
   accepted and the hub snapshot has the same revision/checksum.
2. Open one ordinary control tab without a query parameter and one observer tab
   with `?realtime=observe`. Only the observer tab should show the badge and
   create a Worker WebSocket.
3. Open Home, Display, Inventory, and Arcade observer tabs. Confirm each reaches
   `connected` and then `Neon match`; inspect the in-memory telemetry value and
   require identical non-null hub/poll revisions.
4. Perform a reversible authenticated staff action. Record the time from the
   Neon commit to the WebSocket message and from that message to polling
   convergence. The badge may briefly show `Hub ahead`; it must settle at
   `Neon match` without the pushed copy changing visible queue state.
5. Repeat with serving next/previous, Returned/Unclaimed/revert, undo/redo,
   restore, reset, hours, rotation, display URL, and announcement changes.
6. Background and foreground each observer tab. Confirm the hidden socket
   closes and exactly one socket reconnects on visibility.
7. Interrupt and restore the network. Confirm delays are bounded, no sockets
   overlap, and polling continues to keep the display current throughout.
8. Send a malformed or bad-checksum frame in deterministic tests; the live
   public endpoint is subscribe-only and is not used to inject arbitrary test
   payloads.
9. Run the production build, legacy bundle scan, production hydration smoke,
   iOS 15.4 simulator check, and physical iPad mini 4 check before advancing
   beyond internal beta observation.

## Automated coverage

Run:

```bash
npx vitest run tests/realtime-client-canary-config.test.ts \
  tests/realtime-canary-mount.test.tsx \
  tests/realtime-canary-observer.test.tsx \
  tests/api-state-actions.test.ts \
  tests/readonly-display-public.test.tsx \
  tests/ticket-called-celebration.test.tsx \
  tests/arcade-now-serving-banner.test.tsx \
  tests/security-csp.test.ts
```

Coverage includes beta/host/CSP configuration boundaries, explicit URL cohort
selection, exact revision parsing and comparison, valid equality, hub/poll-ahead
states, tamper rejection, zero observer fetches, single socket reuse, visibility
pause/resume, the five-attempt retry ceiling, and all four public consumer poll
paths.

## First live beta observation

The first production-shaped browser observation completed on the isolated beta
stack on September 1, 2026:

- the ordinary `/display` control did not create an observer, while
  `/display?realtime=observe` connected and matched the polled revision-15
  projection;
- the first stored snapshot correctly reported no delivery latency because it
  was not a live broadcast;
- saving the existing beta display URL to itself committed a harmless Neon
  revision `16`, which the open socket received as a live broadcast in `127 ms`;
- the observer first reported `Hub ahead; polling unchanged`, then matched the
  refreshed `/api/state` projection in `1,221 ms` without rendering the pushed
  copy;
- the first-match convergence value remained exactly `1,221 ms` through two
  later refreshes, proving it is a fixed measurement rather than a growing
  snapshot-age counter;
- the socket received two valid frames with zero reconnects; and
- `/admin/realtime` reported revision `16` as `accepted` on attempt `1`.

The convergence refresh was triggered through the same visible-document path
used when a tab returns to the foreground so the proof did not need to wait for
the adaptive poll ceiling. Temporary in-page event sampling was removed after
the run. This is one successful checkpoint, not a completed Phase 4 canary.

## Expanded Phase 4 beta observation

The additive exact-revision and four-surface slice was deployed and observed on
the isolated beta stack on September 1, 2026:

- Home, Display, Inventory, and Arcade each connected and reported exact
  `hub r16 / poll r16` matches. Initial comparison times were 284 ms, 499 ms,
  0 ms, and 0 ms respectively.
- A fresh `/arcade` control without the query parameter created no observer.
- A direct `/api/state` response exposed `x-lotto-state-revision: 70`, matching
  the later live browser cohort's `hub r70 / poll r70` result. The response body
  contract remained unchanged.
- One Display observer stayed connected for 307 seconds at exact revision `70`
  with its original 99 ms convergence measurement unchanged. No mismatch or
  visible reconnect occurred. This is application-level idle stability, not a
  Cloudflare hibernation or billing claim.
- Safari on the iOS 15.4 iPad mini 4 simulator hydrated the deployed observer,
  reached `hub r70 / poll r70`, and returned to the same connected match after
  a five-second real app background/foreground cycle.
- The same Chrome observation exposed a pre-existing service-date hydration
  mismatch on both the observer and polling-only control. Vercel rendered the
  UTC date while the Pacific browser rendered the pantry date. The beta branch
  now starts the clock from a deterministic hydration value and formats the
  service date in the persisted pantry timezone. Deployment
  `Da5gC8yMFixrFfJVAHTuACTmB986` was rechecked at the same UTC/Pacific boundary:
  server HTML contained the deterministic placeholder, both fresh browser
  pages showed Tuesday, neither logged a console error, and the observer
  matched `r70 / r70` in 79 ms.
- The repaired deployment then passed the iOS 15.4 simulator cycle again. The
  foregrounded page showed the Pacific service date and returned to connected
  `hub r70 / poll r70` after five seconds in the background.

The deterministic suite remains the proof for zero overlapping sockets,
visibility cleanup, and the five-attempt reconnect ceiling. A real isolated
network-interruption drill is still required; disabling the host network would
also interrupt the active development and authentication sessions and is not a
safe substitute for per-device fault injection.

## Current limitations and Phase 4 gates

- All four current public queue-state consumers are connected and have passed
  one production-shaped exact-revision observation on the isolated beta.
- Neon-backed `/api/state` exposes its authoritative positive revision in a
  response header from the same query as the state payload. Local file storage
  intentionally omits the header and uses checksum-only comparison.
- This `?realtime=observe` slice still never renders pushed state or stops
  polling. Phase 5 now has a separate independently gated
  `?realtime=source` implementation; see
  [`REALTIME_SOURCE_CANARY.md`](./REALTIME_SOURCE_CANARY.md). The observer remains
  the unchanged dual-read control and is not silently promoted into the source
  cohort.
- There is no application heartbeat. Silent half-open behavior, Durable Object
  hibernation evidence, sustained memory/cost measurement, isolated network
  interruption, and physical legacy-device recovery still require
  production-shaped measurement. The iOS 15.4 simulator is useful compatibility
  evidence but does not replace the physical iPad mini 4 gate.
- The kill switch is deployment configuration. Replace `?realtime=observe`
  with `?realtime=poll` to disable realtime for one browser; dropping the query
  returns to the RC.2 default source.

## Rollback

Set `LOTTO_REALTIME_CLIENT_CANARY=false` in the isolated beta project and
redeploy. The server stops issuing browser configuration and removes the Worker
origin from `connect-src`; every public surface continues on its unchanged
adaptive polling path. Shadow publication may remain enabled for server-side
comparison or be disabled independently. No schema, database state, or public
client migration must be reversed.

### Deployment environments eligible for realtime

`LOTTO_DEPLOYMENT_ENVIRONMENT` answers two independent questions, and they were
deliberately separated in v2.0.0-rc.3:

- **May this deployment use the realtime hub?** `beta` or `production`.
- **Is this the beta sandbox?** `beta` only. This alone drives the "Beta test
  environment" banner, the blocking `robots.txt`, and the `X-Robots-Tag` header.

Before rc.3 a single value answered both, so production could not enable
realtime without also de-indexing the live site and telling every client their
actions did not affect the real app.

The gate is still fail-closed, which was the point of the original beta-only
restriction. Only those two exact values qualify: unset, empty, or near-miss
values such as `prod`, `Production`, or `staging` refuse realtime rather than
assuming it is welcome. Being merely "not beta" is never sufficient. See
`src/lib/deployment-environment.ts` and `tests/beta-deployment-safety.test.tsx`.
