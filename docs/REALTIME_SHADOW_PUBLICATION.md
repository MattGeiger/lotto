# Realtime shadow-publication contract

## Status

This document defines the first Phase 3 implementation slice for LOTTO's
provisional v2.0 realtime architecture. It is additive, beta-only, and
disabled by default. Neon remains authoritative and every public surface keeps
using the existing `/api/state` polling path.

Shadow publication copies a committed, allowlisted public projection into the
isolated Cloudflare Durable Object. No browser trusts or renders that copy yet.

Phase 4 now has a separate beta-only, opt-in browser observer that may compare
this copy with the existing polled state without rendering it. Its gates,
state machine, telemetry, and rollback contract live in
[`REALTIME_CLIENT_CANARY.md`](./REALTIME_CLIENT_CANARY.md).

The additive schema was applied to the isolated `neon-copper-queen` beta
database on September 1, 2026. A metadata query confirmed the revision column,
outbox table, and four expected table indexes; the outbox contained zero rows.
The integrating code is deployed to the isolated beta Vercel project. Its
rotated publish credential exists only in the beta Cloudflare and Vercel secret
stores, and shadow publication is enabled only in the beta Production
environment. Production LOTTO and `main` remain unchanged.

## Transaction boundary

Every database-backed queue mutation already converges on the database state
manager's `persist()` transaction. That transaction will atomically:

1. write the ordinary snapshot and any immutable queue closeout;
2. write the complete authoritative `raffle_state.payload`;
3. increment `raffle_state.revision` exactly once;
4. mark an older undelivered public-state intent as superseded; and
5. insert the new checksummed public projection as a pending outbox row.

The new revision is allocated by Postgres inside the same upsert that writes
state. It is never calculated from a separate application read. Concurrent
writes therefore serialize through the singleton state row and cannot allocate
the same revision.

Cloudflare publication happens only after that transaction returns. There is
no distributed transaction and no claim of exactly-once delivery.

## Additive schema

`raffle_state` gains:

| Column | Contract |
| --- | --- |
| `revision BIGINT NOT NULL DEFAULT 0` | Authoritative monotonic public-state revision; existing rows begin at zero and the first subsequent persist allocates one |

`raffle_public_state_publications` stores bounded publication evidence:

| Column | Contract |
| --- | --- |
| `publication_id TEXT PRIMARY KEY` | Application-generated UUID and idempotency identity |
| `revision BIGINT UNIQUE NOT NULL` | Authoritative state revision |
| `protocol_version INTEGER NOT NULL` | Public protocol version used to serialize the row |
| `checksum TEXT NOT NULL` | SHA-256 of the canonical public projection |
| `payload JSONB NOT NULL` | Allowlisted `PublicRaffleState`, never complete internal state |
| `status TEXT NOT NULL` | `pending`, `accepted`, `failed`, or `superseded` |
| `attempt_count INTEGER NOT NULL` | Number of bounded post-commit attempts |
| `committed_at TIMESTAMPTZ NOT NULL` | Database commit timestamp associated with the revision |
| `last_attempt_at TIMESTAMPTZ` | Most recent publication attempt |
| `accepted_at TIMESTAMPTZ` | Hub acceptance timestamp |
| `last_error TEXT` | Bounded, non-sensitive failure summary |
| `created_at`, `updated_at` | Operational evidence timestamps |

Indexes support newest-revision and pending-status diagnostics. The table does
not contain staff identity, authentication data, ticket searches, queue-session
evidence, secrets, or complete snapshots.

## Runtime controls

All settings are server-only and must never use a `NEXT_PUBLIC_` prefix.

| Variable | Default | Requirement |
| --- | --- | --- |
| `LOTTO_REALTIME_SHADOW_PUBLISH` | `false` | Must be exactly `true` to activate; any other nonempty value is rejected |
| `LOTTO_REALTIME_HUB_URL` | unset | HTTPS origin of the isolated beta Worker |
| `LOTTO_REALTIME_EXPECTED_HUB_HOST` | `lotto-realtime-beta.et2-geiger.workers.dev` | Exact remote-host safety boundary |
| `LOTTO_REALTIME_AGENCY_ID` | unset | Protocol-valid opaque agency identifier |
| `LOTTO_REALTIME_PUBLISH_TOKEN` | unset | Cloudflare-stored bearer secret mirrored only into beta Vercel |
| `LOTTO_REALTIME_PUBLISH_TIMEOUT_MS` | `1500` | Per-attempt deadline, bounded from 100–5,000 ms |

Activation additionally requires
`LOTTO_DEPLOYMENT_ENVIRONMENT=beta`. Enabling shadow publication in another
environment fails closed. Localhost HTTP is permitted only for local Worker
development; remote targets require HTTPS and exact hostname agreement.

The first beta configuration uses agency ID `william-temple-house`. Production
publication remains disabled and requires a later, explicit rollout decision.

## Post-commit attempt

After a successful Neon transaction, the server builds protocol v1 from the
outbox evidence and sends one bounded `POST` to:

```text
{LOTTO_REALTIME_HUB_URL}/v1/agencies/{LOTTO_REALTIME_AGENCY_ID}/publish
```

The request contains the bearer token only in the server-to-server
`Authorization` header. The token, full payload, and staff/session data are not
logged.

Hub responses `200` (idempotent duplicate) and `202` (new revision accepted)
mark the outbox row accepted. Authentication, validation, conflict, timeout,
network, and overload failures mark it failed with a bounded summary. Failure
to update the evidence row after a successful publish leaves it pending; a
later identical repair remains safe because the hub is idempotent.

## Staff-action guarantee

A Cloudflare failure must never turn a committed staff action into an error.
The API continues returning the committed Neon state when:

- DNS or network resolution fails;
- the attempt reaches its timeout;
- Cloudflare returns an error or limit response;
- the hub rejects the revision;
- the evidence-status update fails after the network attempt; or
- the shadow feature is disabled between deployments.

The failure is recorded and logged only as a bounded operational warning. No
automatic unbounded retry loop, visitor repair request, cron heartbeat, or
database subscriber is introduced.

## Supersession and repair

Full-state projection means a newer committed revision safely supersedes any
older pending or failed revision. The transaction marks those older rows
`superseded` before inserting the new pending row. This prevents a backlog from
requiring one network request per historical change.

If the newest row fails and no later staff action occurs, an explicit bounded
Admin repair operation will retry only that newest row with its original
publication ID, revision, checksum, and commit timestamp. The beta-only
`/admin/realtime` surface exposes the newest publication metadata and one
user-driven repair action to an allowlisted administrator. Its API fails closed
outside beta, sends `Cache-Control: no-store`, and never returns the stored
payload or publish secret. The page performs one initial status read and does
not poll. No public client may inspect or initiate repair.

## Cost envelope

When disabled, the feature adds no Cloudflare request and no outbox row. The
authoritative revision still advances with a normal state write.

When enabled, each committed mutation adds at most:

- one outbox insert inside the existing Neon transaction;
- one bounded Vercel-to-Cloudflare request; and
- one best-effort outbox status update.

It adds no public-origin request and does not change current polling frequency.
Phase 4 comparison must prove revision/checksum agreement before any public
client applies realtime state.

## First production-shaped beta validation

The initial September 1, 2026 activation used two controlled deployments from
commit `d87d340`:

1. With `LOTTO_REALTIME_SHADOW_PUBLISH=false`, an authenticated same-value
   display-URL save advanced authoritative Neon revision `1` to `2` while the
   outbox remained empty. This confirmed that installing the other runtime
   settings does not activate publication or change the staff write path.
2. With the flag set to `true`, the same bounded action advanced Neon to
   revision `3`, created publication revision `3`, and recorded status
   `accepted` after one attempt with no error.
3. The Durable Object public snapshot returned revision `3` and the exact same
   checksum as Neon:
   `sha256:74c9beaa1b3ca3000be451ddf28f5c540f416f5ef9db16d8d19f01af9e516373`.
4. The ordinary beta `/api/state` endpoint and authenticated Admin persistence
   indicator remained healthy throughout both deployments.

This proves one complete Neon-to-Durable-Object shadow-publication path under
production-like beta hosting. It does not complete Phase 3: the full mutation
matrix, undo/redo/restore/reset cases, injected Cloudflare failures, explicit
repair, WebSocket observation from application clients, and legacy-device
validation remain open. Public clients still poll Neon through `/api/state`.

## Automated mutation and failure matrix

Run the bounded local Phase 3 contract suite with:

```bash
npm run realtime:shadow:check
```

The command covers the public-state protocol, configuration safety boundary,
timeout and redaction behavior, newest-only repair, metadata-only diagnostics,
and the database state manager. Its persisted-mutation matrix exercises 22
variants:

- full generation, batch generation, append, and range extension;
- mode changes, explicit serving changes, and next/previous serving movement;
- Returned, Unclaimed, and status reversion;
- reset, snapshot restore, undo, and redo;
- display URL and operating-hours updates;
- display-language rotation set/clear; and
- announcement set/clear.

Every variant must allocate its revision and outbox row in one transaction,
make exactly one post-commit request, record acceptance, emit a strict envelope
without `queueSession`, and produce a checksum that recomputes from the emitted
state. The first complete run passed 100 focused tests. After adding the
beta-only diagnostics API and UI request-budget coverage, the command passed
108 focused tests. The full project suite then passed 882 tests with the
expected production-bundle fixture skipped.

This is deterministic contract coverage, not a substitute for the beta
environment matrix. Destructive beta cases such as reset still require an
explicit, controlled test window and revision/checksum comparison against both
Neon and the Durable Object.

## First live beta mutation matrix

An authenticated production-shaped run on September 1, 2026 advanced the
isolated beta environment from revision `3` through revision `14`. It exercised
11 mutations in order:

1. generate a temporary five-ticket queue;
2. advance serving twice;
3. move serving backward once;
4. mark the current ticket Returned, including automatic serving advance;
5. mark a called ticket Unclaimed;
6. revert the Unclaimed status;
7. undo that reversion;
8. redo it;
9. restore the initial generated snapshot; and
10. reset the beta queue to its empty daily state.

Generation is one mutation, so the sequence produced 11 total committed
revisions. After every action, the newest Neon state revision and outbox
revision matched; the outbox row was `accepted` after one attempt; and the
Durable Object returned the same revision and checksum. The aggregate database
check for revisions 4–14 reported 11 publication rows, 11 accepted rows, zero
non-accepted rows, and a maximum attempt count of one.

The final reset produced one immutable queue-session closeout, returned the
ordinary beta `/api/state` endpoint to an empty queue with HTTP 200, and left
the Durable Object at revision `14` with the identical empty-state checksum
`sha256:acfb56cbf7edd7e04c1b7d6898c6609172f8210cb91353d4f59a1c0e52308cad`.
Production LOTTO and `main` were not touched.

The live matrix is representative, not exhaustive. Append, extend-range,
batch generation, and live configuration changes remain production-shaped beta
gates. Their deterministic state-manager paths are covered by
`realtime:shadow:check`.

## First controlled failure and newest-only repair

The September 1, 2026 beta fault injection deliberately rotated the isolated
Worker's `PUBLISH_TOKEN` before rotating the corresponding Vercel secret. One
authenticated same-value display-URL save then exercised the real application
write path under a credential mismatch:

1. Neon committed the authoritative mutation and advanced to revision `15`.
   The Admin page continued to report **Persistence confirmed**, proving that
   the post-commit hub failure did not reject the staff action.
2. Publication `aea72a94-9f3c-410c-ab2d-88cf6c804c84` recorded status
   `failed`, attempt count `1`, no acceptance timestamp, and the bounded error
   `Realtime hub returned HTTP 401.`
3. The Durable Object remained at revision `14` and its previous checksum,
   proving that the rejected request could not alter public hub state.
4. The matching token was then rotated into only the beta Vercel Production
   secret and the same commit was redeployed. Selecting **Retry newest
   publication** made one repair attempt with the original publication ID.
5. The outbox changed to `accepted` at attempt count `2`. The Durable Object
   converged to revision `15`, the same publication ID, and checksum
   `sha256:e6a779e36f4a80e1a0a9ea964c3ab1dd0dab7f39afdb8415819cefa87a6d2593`.

The temporary local token copy was removed after the two beta secret stores
were synchronized. Production credentials, the live LOTTO deployment, and
`main` were not touched. This closes the Phase 3 production-shaped
authentication-failure/newest-only-repair gate; timeout, evidence-update, and
invalid-evidence behavior remain covered deterministically by the focused test
suite rather than additional live destructive injections.

## First live browser delivery checkpoint

The next harmless same-value display-URL save advanced isolated beta Neon and
the outbox to revision `16`. The open Phase 4 observer received the accepted
Durable Object broadcast in `127 ms`, while its existing polled checksum still
matched revision `15`; after the normal visible-document refresh path ran, the
two allowlisted projections matched by checksum in `1,221 ms`. The publication
diagnostic reported revision `16`, status `accepted`, and attempt count `1`.
Polling remained authoritative and the pushed payload was not rendered. See
[`REALTIME_CLIENT_CANARY.md`](./REALTIME_CLIENT_CANARY.md) for the browser-side
measurement and remaining gates.

## Rollout sequence

1. Apply the idempotent additive schema to the isolated beta Neon database.
2. Deploy code with `LOTTO_REALTIME_SHADOW_PUBLISH=false`.
3. Verify ordinary authenticated mutations and polling are unchanged.
4. Rotate one publish token and place it only in the beta Cloudflare and Vercel
   secret stores.
5. Configure the beta Worker URL, exact expected hostname, and agency ID.
6. Enable shadow publication only in the beta environment.
7. Exercise every mutation, undo, redo, restore, and reset path.
8. Compare the newest Neon outbox revision/checksum with the Durable Object
   snapshot after every action and injected failure.
9. Disable the flag and confirm the existing application continues normally.

No schema or secret is applied to production as part of this beta rollout.

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
