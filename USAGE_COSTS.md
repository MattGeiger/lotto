# LOTTO Usage Costs and Public-Read Architecture

Last reviewed: September 3, 2026

## Purpose

This document explains why a small LOTTO installation can incur a few dollars
to roughly $20 per month in database cost, identifies the requests that create
that cost, and compares ways to serve public queue state without querying Neon
Postgres on every poll.

Prices and product limits change. The figures below are a planning model, not a
quote. Recheck the linked provider pages before making a purchasing decision.

## v2.0 provisional direction

On August 31, 2026, the project selected a Neon-authoritative Cloudflare Durable
Object realtime hub as the direction to prove for v2.0. The selection is not a
final production decision. The current application remains the supported
baseline until the experiment, beta stack, shadow comparison, production
canary, cost analysis, failure drills, security review, and real-iPad validation
all pass.

The complete gated plan is in
[`docs/V2.0_REALTIME_ARCHITECTURE_PLAN.md`](docs/V2.0_REALTIME_ARCHITECTURE_PLAN.md).

On September 2, the owner confirmed that the consulting business's existing
paid Vercel Pro account will own a new v2.0 production project. The Hobby beta
is therefore temporary rather than the production cost model. The preferred
William Temple House cutover window begins Thursday, September 3, 2026 after
2:30 PM America/Los_Angeles. The existing production and beta deployments
remain rollback/comparison targets until the Pro deployment is explicitly
accepted; only then are the Hobby beta account/project and the old production
deployment retired.

The recovery design uses two cost-conservative controls. A server-only Vercel
gate prevents rendered realtime from starting on new page loads after
redeployment. A separately authenticated Cloudflare drain closes current
sockets and refuses new ones while continuing to accept publications. Affected
clients make one immediate Neon reconciliation and then use the unchanged
adaptive polling schedule, including long-idle and closed-hours backoff.

RC.2 makes this controller the ordinary default on all four isolated-beta
public surfaces. A healthy page therefore replaces scheduled Vercel Function
and Neon reads with one hibernatable WebSocket; `?realtime=poll` remains the
socket-free comparison path. This changes the beta measurement model only and
does not yet change production usage.

## Executive conclusion

The cost concern is valid. LOTTO's database work is small, but Neon bills
compute primarily by **compute size multiplied by active time**, not by the
complexity of an individual query. Neon normally suspends a compute after five
minutes without activity. During open and pre-open periods, LOTTO caps public
polling at five minutes. One visible kiosk can therefore keep a compute active,
or keep waking it at the edge of the suspension window, even though each poll
only reads one JSON row.

The recommended direction is not to replace Postgres. Neon remains a good fit
for authenticated writes, transactional state changes, authentication,
snapshots, translations, and administrative reporting. Instead, LOTTO will
experiment with an event-driven **public read model**:

1. Neon remains the authoritative source of truth.
2. Every committed state change receives a monotonic revision and records
   publication intent inside the authoritative transaction.
3. One Cloudflare Durable Object per agency stores only the newest allowlisted
   public projection.
4. Hibernatable WebSockets broadcast the revision to connected Home, Display,
   Inventory, and Arcade clients.
5. Healthy clients stop ordinary polling; connection failure immediately
   restores the current bounded adaptive polling strategy.

This is a modest form of command/query separation, sometimes called CQRS-lite.
It changes the cost driver from “number and timing of public polls” to “number
of committed state changes, connected recipients, and reconnections.” The hub
is a derived copy that can drift temporarily, so revisioning, idempotent
publication, observable outbox recovery, and automatic polling fallback are
non-negotiable.

Tagged CDN delivery and Vercel Blob remain credible fallback designs if the
Durable Object proof fails. A Blob `current.json` would be a mutable
materialized view rather than literal WORM storage.

## Current LOTTO behavior

### Public queue reads

The following visible client surfaces fetch `/api/state` with
`cache: "no-store"`:

- `/` and `/display`, through `src/components/readonly-display.tsx`;
- `/inventory`, through `src/components/ticket-called-celebration.tsx`; and
- Arcade pages, through `src/arcade/components/now-serving-banner.tsx`.

Those clients share `src/lib/polling-strategy.ts`. Polling pauses while a tab is
hidden, which is good, but a kiosk display remains visible. The relevant steady
cadences are:

| Situation                             | Poll delay |
| ------------------------------------- | ---------: |
| Recently changed, burst window        | 30 seconds |
| Less than 10 minutes since a change   |   1 minute |
| 10–30 minutes since a change          |  2 minutes |
| 30–60 minutes since a change          |  5 minutes |
| 1–4 hours since a change              | 10 minutes |
| Open or pre-open steady-state ceiling |  5 minutes |
| Closed steady state                   | 30 minutes |

`GET /api/state` calls `stateManager.loadState()`. In production, the Neon
implementation performs a one-row query resembling:

```sql
SELECT payload
FROM raffle_state
WHERE id = 'singleton'
LIMIT 1;
```

The query is simple and the current HTTP use of the Neon serverless driver is
appropriate for this one-shot operation. Changing to a pooled connection does
not solve the cost issue: connection pooling helps connection pressure, while
the problem here is the frequency and timing of database activity.

### Other public-path database reads

Optimizing `/api/state` alone would not make public traffic database-free:

- Active brand configuration resolution opts out of caching and can read Neon
  during each server-rendered page request.
- `/api/languages?client` reads the enabled language catalog when clients mount
  or explicitly refresh it.
- Translation-pack requests read translations, brand data, and announcement
  state.
- Authentication uses a JWT session strategy, so ordinary session validation
  should not itself require a database read, but authenticated writes still do.
- Arcade leaderboard data can use a separate `ARCADE_DATABASE_URL`; it should
  stay isolated from this queue-state optimization and be measured separately.

Page reloads are less frequent than state polling on a fixed kiosk, but brand
and translation reads must eventually receive the same cache/invalidation
treatment or an equivalent public projection.

### Writes and history

Authenticated state mutations read the current state, transactionally update
the singleton state row, and add a full JSON snapshot. Snapshot history is
useful operationally, but it contributes database storage and write-ahead-log
(WAL) history. Cleanup is currently best-effort during reset and is also
available through an administrative cleanup route.

This is a secondary cost driver, not the main polling problem. It should still
be measured because Neon bills database storage and retained change history
separately.

### Public-data boundary

The current state object includes internal operational evidence such as
`queueSession`. A public cache or Blob must not serialize the complete
`RaffleState` object by convenience. It should use an explicit, allowlisted
`PublicRaffleState` schema containing only fields required by public clients.
That boundary protects future admin-only fields as well as today's known ones.

## How Neon billing applies

### Compute

Neon defines a Compute Unit (CU) as approximately one vCPU and 4 GB of RAM.
Compute usage is calculated as:

```text
monthly CU-hours = average active CU size × active hours
compute cost      = monthly CU-hours × plan CU-hour rate
```

At the time of this review, the [Neon pricing page](https://neon.com/pricing)
lists:

| Item                    |                                Free |                             Launch |                              Scale |
| ----------------------- | ----------------------------------: | ---------------------------------: | ---------------------------------: |
| Compute                 | 100 CU-hours/project/month included |                     $0.106/CU-hour |                     $0.222/CU-hour |
| Database storage        |             0.5 GB/project included |                     $0.35/GB-month |                     $0.35/GB-month |
| Restore/history storage |                 Limited free window | $0.20/GB-month of retained changes | $0.20/GB-month of retained changes |
| Public network transfer |                       5 GB included |     100 GB included, then $0.10/GB |     100 GB included, then $0.10/GB |
| Inactivity suspension   |                  Fixed at 5 minutes |   After 5 minutes; can be disabled |                       Configurable |

Neon's [Scale to Zero documentation](https://neon.com/docs/introduction/scale-to-zero)
states that an inactive compute normally suspends after five minutes and wakes
within a few hundred milliseconds when queried again. Neon also cautions in its
[compute-management guidance](https://neon.com/docs/manage/endpoints/) that an
always-active configuration increases usage. The same principle applies when
application traffic prevents the compute from becoming idle.

The minimum commonly configured compute size is 0.25 CU. At the Launch rate,
the approximate compute-only scenarios are:

| Active pattern                   | Active hours/month | Approximate Launch compute cost |
| -------------------------------- | -----------------: | ------------------------------: |
| Continuously active              |                730 |                          $19.35 |
| 9 active hours/day for 30 days   |                270 |                           $7.16 |
| 4.5 active hours/day for 22 days |                 99 |                           $2.62 |

The arithmetic for continuous minimum compute is:

```text
730 hours × 0.25 CU × $0.106/CU-hour = $19.35/month
```

This is why the observed range of a few dollars to about $20 is plausible even
for trivial SQL. A larger minimum, autoscaling under load, storage, retained
history, network transfer, or branches can increase the invoice. Neon's
[November 2025 price-reduction announcement](https://neon.com/blog/major-compute-price-reduction-on-neon)
also says its paid-plan minimum had dropped to $5 per month; confirm how that
minimum applies to the project's direct or marketplace billing arrangement.
Free-plan allowances change what is billed, not what is consumed.

### The five-minute resonance

LOTTO's open/pre-open polling ceiling and Neon's default autosuspend window are
both five minutes. Exact timing, latency, and jitter determine whether Neon
stays continuously active or briefly suspends and wakes, but either outcome
captures nearly all of the possible minimum-compute time.

Closed polling is cheaper for one client but still material. An isolated query
every 30 minutes can hold compute for up to five of those 30 minutes, or about
one-sixth of the month. At minimum Launch compute, that is approximately:

```text
730 hours ÷ 6 × 0.25 CU × $0.106/CU-hour = $3.22/month
```

Multiple clients make the effect nonlinear. Six closed kiosks whose 30-minute
polls happen to be staggered five minutes apart can collectively fill every
idle window and approach continuous compute. During open hours, one kiosk at
the five-minute ceiling can already do so.

Using the default Monday–Friday 10:00–14:00 schedule as an illustrative model,
one always-visible kiosk has about 110 monthly hours in the open/pre-open/
post-close five-minute window. If all remaining time is polled every 30 minutes,
the theoretical active time is roughly 213 hours and minimum Launch compute is
about $5.65. Real usage will differ because changes trigger faster polling,
requests cluster, page loads add reads, and Neon measures the actual compute.

### Storage, history, and transfer

Database storage is billed independently from compute. History storage depends
on retained WAL/data changes inside the restore window, so storing a complete
state snapshot after every action can cost more than the final table size alone
suggests. The absolute amount is likely small for one pantry, but it should be
visible in the cost dashboard rather than assumed away.

Public network transfer is unlikely to dominate for a small JSON response under
the included allowance. The more important fact is that each transfer-producing
query can also reset the compute-idle timer.

Neon's [serverless-driver documentation](https://neon.com/docs/serverless/serverless-driver)
confirms that HTTP is intended for single, non-interactive transactions. The
current transport is therefore not the design error; sending every public poll
to the authoritative database is.

## Vercel cost mechanics that matter

Moving reads away from Neon does not make requests free; it moves them to a
more suitable and usually cheaper delivery layer.

Vercel counts static and cached requests as CDN/Edge Requests and charges data
transfer to the visitor. A cache hit does not invoke the origin function.
[Vercel's CDN documentation](https://vercel.com/docs/how-vercel-cdn-works)
describes that separation, and its
[CDN usage guide](https://vercel.com/docs/manage-cdn-usage) specifically calls
out excessive polling as a source of Edge Requests.

At the time of review, Hobby includes one million Edge Requests and charges are
listed at $2 per additional million where on-demand billing applies. Pro's
regional pricing currently includes ten million Edge Requests. LOTTO must check
its actual plan and region rather than assume an allowance.

A visible client polling every five minutes creates about 8,760 state requests
in a 30.4-day month. One hundred such clients create about 876,000 requests,
before page assets and other endpoints. CDN delivery therefore scales much more
gently than keeping Postgres active, but request counts still need monitoring.

Vercel Functions add invocation, active CPU, provisioned-memory, and origin
transfer usage on cache misses. Under
[Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing),
the first million function invocations are currently included on Hobby and Pro,
with Pro overage listed at $0.60 per million. A CDN hit avoids the function
invocation entirely.

## Desired properties of a public read model

Any selected design should meet these requirements:

- **One authority:** Neon is authoritative; public delivery is derived data.
- **No public write path:** only authenticated state mutations can publish.
- **Allowlisted payload:** internal and future private fields are excluded.
- **Commit order:** durable Postgres commit happens before derived publication.
- **Bounded staleness:** a documented freshness target and recovery TTL exist.
- **Failure visibility:** staff can see when the public version lags the database.
- **Self-healing:** the next write, an explicit repair action, or a bounded job
  can reconcile a failed publication.
- **Request-count tests:** tests assert database queries, cache regenerations,
  and store writes, not only the final UI.
- **Legacy-device validation:** the iPadOS 15 floor must be exercised with the
  production bundle and a Vercel preview.
- **Provider limits are explicit:** payload size, cache behavior, operations,
  and plan allowances are documented and monitored.

Freshness is a product decision. LOTTO should explicitly choose a target such
as “public displays reflect a committed staff action within 60 seconds under
normal operation.” Without that target, cache design becomes guesswork.

## Alternatives

### Alternative 1 — Tagged Vercel CDN response backed by Neon

Create a dedicated public endpoint, for example `/api/public-state`, that
returns only `PublicRaffleState`. Give the response a long Vercel CDN lifetime
and a cache tag. After every successful state-changing transaction, invalidate
that tag. Public polls continue, but almost all receive a CDN response without
a function invocation or Neon query.

[Vercel CDN Cache](https://vercel.com/docs/caching/cdn-cache) supports cached API
responses up to 10 MB when the request and response meet its public-cache rules.
[Tag-based invalidation](https://vercel.com/changelog/tag-based-cache-invalidation-now-available-for-all-responses)
is available on all plans at no added charge. Vercel's function API distinguishes
between safe stale-while-revalidate invalidation and foreground deletion; the
latter can cause a cache stampede and must be tightly scoped.

**Advantages**

- No second durable state store and no database/Blob dual-write gap.
- One public URL works with the existing polling clients.
- Cache hits do not invoke a function or query Neon.
- A cache miss naturally rebuilds from the authoritative database.
- The migration is narrow and reversible.
- Branding, language catalogs, and translation packs can adopt the same tagged
  response pattern.

**Disadvantages and cautions**

- Standard background invalidation may serve stale data once and refresh in the
  background. At a five-minute client poll interval, that extra cycle could be
  too slow for Now Serving.
- Foreground expiration gives the first post-change request fresh data, but
  Vercel warns about stampedes. LOTTO should apply it only to the single public
  state path and verify request collapsing/concurrency in a preview.
- A first request after invalidation or regional eviction still invokes the
  function and wakes Neon.
- Every mutation path must invalidate the tag. A missed path leaves data stale
  until the safety TTL.
- Public requests still consume Edge Requests and visitor data transfer.

**Best fit**

This is the lowest-risk first implementation when LOTTO wants Neon to remain
the sole durable state store and can test an explicit first-request freshness
policy.

### Alternative 2 — Vercel Blob JSON materialized view

After a successful Neon commit, serialize the allowlisted public projection to
a public Blob such as `public-state/current.json`. Clients fetch the Blob URL
directly, so polling never invokes the LOTTO function or Neon.

The repo already uses `@vercel/blob` for public brand assets, which lowers the
adoption cost. Vercel explicitly lists a frequently updated JSON file as a valid
mutable-Blob use case, but its
[Blob overview](https://vercel.com/docs/vercel-blob) warns that overwrites may
take up to 60 seconds to propagate and browser caches add another consideration.
The [public storage guide](https://vercel.com/docs/vercel-blob/public-storage)
sets 60 seconds as the minimum configurable cache lifetime.

**Is this WORM?**

Overwriting `current.json` is not write-once. True WORM storage would write
immutable objects such as `state/1735689600000.json`. Clients would then need a
mutable “latest” pointer, version endpoint, or refreshed page to discover the
new URL. That pointer reintroduces the same cache-coordination problem and can
double request counts. For LOTTO, “immutable authority plus mutable public
projection” is the more useful description.

**Advantages**

- Public polls cannot wake Neon and do not invoke a LOTTO function.
- The last successfully published artifact remains readable during a Neon or
  function outage.
- Cost maps to small object writes, Edge Requests, and transfer instead of
  database active time.
- The architecture is easy to inspect: a version in Postgres can be compared
  with the version inside the Blob.
- Existing Blob provisioning, dependency, and operational familiarity can be
  reused.

**Disadvantages and cautions**

- A Neon commit and Blob upload cannot share one transaction. If the commit
  succeeds and publication fails, public state is stale.
- Database-first ordering, an outbox/publication marker, retry behavior,
  reconciliation, and staff-visible health are required.
- A mutable public Blob has a minimum 60-second propagation/cache constraint.
- Public Blobs are accessible to anyone with the URL and cannot contain
  internal fields. Vercel's
  [Blob security guide](https://vercel.com/docs/vercel-blob/security) also says
  Blob URLs cannot use Vercel WAF protection unless requests are proxied through
  a function, which would give up part of the benefit.
- Each direct access is an Edge Request; downloads use Blob Data Transfer.
- Each `put()` is an Advanced Operation. Vercel's current
  [Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) lists
  1 GB storage, 10,000 Simple Operations, 2,000 Advanced Operations, and 10 GB
  transfer in the Hobby allowances. Hobby cannot buy overage, while Pro uses
  on-demand pricing/credits. A busy pantry can exceed 2,000 state changes in a
  month, so plan behavior matters even though paid operation cost is small.
- The changelog records a January 2026 rollback of an experimental Blob
  snapshot cache, but the reason is not documented in the repository. A new
  implementation must not assume the old failure was understood or fixed.

**Best fit**

Blob is a strong option when a 60-second freshness objective is acceptable,
static availability during database outages is valuable, and LOTTO is willing
to implement publication reconciliation correctly.

### Alternative 3 — Runtime Cache or managed Redis/KV read-through cache

Write the public projection to a low-latency key after each Neon mutation. The
public endpoint reads the key, falling back to Neon on a miss. A CDN response
cache can sit in front of it.

**Advantages**

- Mutable-key semantics fit “latest state” better than object storage.
- Near-immediate updates are possible.
- Atomic compare-and-set or version checks are available in many Redis/KV
  products.
- A Neon fallback can self-heal cache loss.

**Disadvantages and cautions**

- It introduces another service, credential, bill, and failure mode.
- Every CDN miss still invokes a function and performs a cache read.
- Vercel Runtime Cache is regional/ephemeral and currently limits an item to
  2 MB; it is a cache, not durable publication.
- A cache miss can still wake Neon, so eviction behavior matters.
- A hosted Redis service charges per request or provisioned capacity and is
  unnecessary for one small public object unless stronger coordination or
  realtime features are also needed.

Vercel Edge Config is not recommended as the latest queue-state store. Vercel
describes it as optimized for fast reads and **infrequent writes**, not as a
general-purpose key/value store. Current Pro pricing lists reads at $0.000003
and writes at $0.01 each, so frequent ticket actions can cost more than the data
volume suggests.

**Best fit**

Use this only if the project later needs atomic mutable-cache operations,
rate-limited coordination, or sub-60-second freshness that CDN response caching
and Blob cannot provide cleanly.

### Alternative 4 — Cloudflare Durable Object realtime hub

After a successful Neon transaction, LOTTO publishes a versioned allowlisted
projection to one Durable Object per agency. The object stores the newest
projection and broadcasts it to connected public clients over WebSockets.
Cloudflare's Hibernation WebSocket API keeps clients connected while allowing
the object to stop accruing duration charges when no JavaScript is executing.
New and reconnecting clients receive the persisted latest projection; failed
connections return to the current polling strategy.

**Advantages**

- Near-immediate full-state delivery without steady polling.
- Public traffic does not invoke LOTTO functions or query Neon while the
  connection is healthy.
- One object per agency maps naturally to LOTTO's small isolated queue state.
- SQLite-backed Durable Object storage is strongly consistent and transactional
  for the derived latest-state record.
- Hibernation aligns cost with state changes and connection events rather than
  idle wall-clock database compute.
- A raw browser WebSocket avoids adding a large legacy-sensitive client SDK.

**Disadvantages and cautions**

- Neon and the Durable Object cannot share a transaction. A database-first
  outbox, revision checks, idempotent retry, and visible convergence health are
  required.
- It adds a second runtime, deployment, secret boundary, logs, quotas, and
  incident surface.
- Long-lived connection state, mobile Safari, captive networks, backgrounding,
  reconnect storms, and protocol compatibility need explicit testing.
- Workers Free hard-fails operations at its limits; zero trial cost is not a
  production reliability guarantee.
- The hub is derived delivery state, not authoritative persistence in v2.0.

**Best fit**

This is the provisional v2.0 direction because it attacks cost and public
freshness together. It must pass the reversible proof program before replacing
polling for any general production cohort.

### Alternative 5 — Reduce polling only

Increase open-hours intervals, stop closed-hours polling, refresh on focus, or
add a manual refresh control.

**Advantages**

- Minimal code and no new infrastructure.
- Directly lowers request counts.
- Can complement every other alternative.

**Disadvantages and cautions**

- It trades cost for slower public updates.
- One query inside each five-minute Neon idle window is still expensive relative
  to the query's value.
- Staggered clients and unrelated public page reads can still keep Neon active.
- It does not address brand, language, or translation reads.

**Best fit**

Use as an immediate tuning measure only after setting a freshness objective. It
is not sufficient as the long-term architecture.

### Full database migration

Moving all persistence to another hosted Postgres, SQLite service, or backend
would preserve neither the existing operational model nor necessarily lower
cost. LOTTO benefits from Postgres transactions, authentication tables,
snapshots, translation batching, and administrative queries. A migration would
touch nearly every server boundary and require data migration, backup/restore,
concurrency, deployment, and rollback plans.

A full migration is not recommended unless measured Neon storage/compute costs
remain material after public reads are removed, or another requirement—not
polling cost—demands it.

## Comparison

| Alternative                   | Neon protected from public polls | Freshness                        | New durable copy          | Migration risk | Recommendation         |
| ----------------------------- | -------------------------------- | -------------------------------- | ------------------------- | -------------- | ---------------------- |
| Cloudflare Durable Object hub | Yes while connected              | Near-immediate                   | Yes, derived latest state | High           | Provisional v2.0 proof |
| Tagged CDN response           | Yes, except regeneration misses  | Immediate or one stale cycle     | No                        | Low–medium     | Primary fallback       |
| Public Blob JSON              | Yes                              | Approximately 60 seconds or more | Yes, derived              | Medium         | Secondary fallback     |
| Runtime Cache / Redis         | Mostly; misses may reach Neon    | Near-immediate                   | Usually no                | Medium         | Conditional            |
| Poll less often               | Partially                        | Slower by design                 | No                        | Low            | Complement only        |
| Replace Neon                  | Depends on replacement           | Varies                           | Yes/migrated              | Very high      | Not justified for v2.0 |

## Recommendation

### Prove a Neon-authoritative Durable Object public hub

This candidate best matches the combined freshness and cost objective:

- It attacks the real cost multiplier—public reads resetting Neon idle time.
- It stops healthy-client polling rather than only serving polls more cheaply.
- It delivers committed state to connected displays in near-real time.
- It preserves transactional behavior and the existing persistence model.
- Its hibernation model can keep idle WebSockets connected without continuously
  accruing Durable Object duration.
- One object per agency matches LOTTO's isolated queue topology.
- The browser can use a small native WebSocket client rather than a large SDK.

The candidate also introduces the most important new risk: Neon and the hub
cannot commit atomically together. The implementation therefore requires:

- database-first commit ordering;
- a monotonic authoritative revision;
- publication intent recorded with the state transaction;
- idempotent, checksum-aware hub updates;
- bounded retry and visible convergence health;
- subscribe-only public connections;
- automatic polling fallback; and
- independent kill switches for publish, connect, apply, and stop-polling.

The first production-shaped integration should run at
`beta.williamtemple.app` in a separate Vercel project, with a fresh beta Neon
database, Blob store, auth secret/tables, Cloudflare Worker environment,
Durable Object namespace, secrets, and metrics. The beta hostname must never be
a frontend that writes to production data.

The direction becomes definitive only after the proof program passes. Until
then, the current Neon/polling architecture is the production recommendation.

### Preserve CDN and Blob as fallback decisions

If WebSocket reliability, Cloudflare cost, legacy Safari behavior, or
cross-system recovery fails a gate, tagged CDN delivery remains the
lowest-migration alternative. Blob remains useful if a static last-known
artifact and a 60-second freshness objective become more important. Neither
fallback should be implemented in parallel merely to hedge the experiment;
that would multiply failure modes before the primary concept is understood.

The detailed decision and rollback gates are in
[`docs/V2.0_REALTIME_ARCHITECTURE_PLAN.md`](docs/V2.0_REALTIME_ARCHITECTURE_PLAN.md).

## Proposed implementation phases

No runtime change is made by this document. The detailed plan defines eight
gated pre-release phases, followed by a post-release observation phase. Each
pre-release phase has its own evidence and rollback:

1. Baseline Neon/Vercel cost, request, client, mutation, and latency behavior.
2. Prove the public projection, revision, checksum, idempotency, and recovery
   protocol locally without Cloudflare.
3. Prove a standalone hibernating Durable Object with synthetic state, load,
   fault injection, and remote iPadOS 15 testing.
4. Provision the isolated `beta.williamtemple.app` stack and shadow-publish real
   beta transactions while all clients continue polling.
5. Run a dual-read beta canary that compares pushed and polled state without
   rendering the pushed copy.
6. Let selected beta/production clients render realtime state with automatic
   polling fallback.
7. Complete a 30-day limited production rollout, cost comparison, security
   review, and failure drills.
8. Harden the accepted design for a v2.0 release candidate while retaining
   polling as supported degraded mode.

After release, an observation phase retains the kill switches and polling
fallback while cost, latency, and reconnection behavior are reviewed closely.

The beta stack uses a separate Vercel project, fresh Neon database, Blob store,
auth secret/tables, Worker environment, Durable Object namespace, and metrics.
Only reviewed code and protocol versions can be promoted; beta data and secrets
cannot.

See
[`docs/V2.0_REALTIME_ARCHITECTURE_PLAN.md`](docs/V2.0_REALTIME_ARCHITECTURE_PLAN.md)
for phase work, exit gates, rollback, security, protocol, test matrix, and final
release criteria.

## Verification gates

An implementation is not complete until it demonstrates:

- no public response or broadcast contains internal state;
- every successful mutation records one new authoritative revision and
  publication intent;
- a failed database transaction never broadcasts derived state;
- duplicate/reordered messages cannot regress hub or client state;
- a failed publication is visible and converges idempotently;
- Cloudflare failure never blocks an authoritative staff action;
- healthy clients make zero scheduled `/api/state` requests;
- disconnected/incompatible clients return automatically to bounded polling;
- production canary reduces public-origin Neon reads by at least 95%;
- Cloudflare usage and paid-plan projections remain within the approved budget;
- security, overload, replay, quota, and reconnect-storm tests pass;
- build, relevant tests, `check:legacy-bundles`, and `smoke:legacy` pass; and
- `beta.williamtemple.app`, the Vercel release candidate, and remote `wss://`
  realtime/fallback behavior work on the real iPadOS 15 device before
  promotion.

Production-build cleanup must follow the repository guidance: remove `.next`
after legacy verification before returning to development.

## Cost formulas for ongoing planning

Use observed values instead of a single hard-coded estimate:

```text
poll requests/month
  = visible clients × visible hours/day × days/month × 60 ÷ poll interval minutes

public transfer/month
  = requests × compressed response bytes

Neon compute cost
  = average active CU × measured active hours × plan CU-hour rate

Blob advanced operations
  ≈ successful public-state publications

CDN-origin regenerations
  ≈ successful invalidations + cold/evicted regional cache fills

realtime deliveries/month
  ≈ committed publications × connected recipients

Durable Object activity
  = connection/update requests + metered WebSocket messages + active handler duration
```

For the Durable Object candidate, idle healthy clients should create no Neon or
Vercel state-read traffic. Hibernation should prevent idle JavaScript duration,
but Cloudflare still meters applicable connection/message requests, storage,
and active handler work. Model 1×, 10×, and 100× connected clients and state
changes, including a reconnect storm and Free-plan hard-limit behavior.

For tagged CDN delivery, public polls should increase only Edge Requests and
visitor transfer after the cache is warm. For Blob delivery, public polls add
Edge Requests and Blob transfer, while state changes add Advanced Operations.
For the current design, polls add function invocations, origin transfer, Neon
queries, and—most importantly—database active time.

## Decision questions for the team

Before implementation, answer these product questions:

1. Are the provisional p95 two-second and p99 five-second
   commit-to-client-render objectives appropriate for public queue state?
2. During a Neon outage, should public clients show the last known state, an
   explicit stale-state banner, or an unavailable message?
3. Which Vercel Pro project and billing team identifiers should be recorded in
   the final production manifest? The owner has confirmed that the consulting
   business's paid account will own the deployment; the exact project does not
   exist yet.
4. How many always-visible kiosks and public inventory/Arcade clients exist at
   peak, and are their poll timers naturally staggered?
5. Should the production-shaped beta use a dedicated long-lived staging branch,
   and who owns promotion into that branch?
6. Can the `williamtemple.app` DNS zone support a dedicated
   `realtime-beta.williamtemple.app` Worker hostname, or should the first proof
   use an isolated `workers.dev` endpoint?
7. What caused the January 2026 Blob experiment to be rolled back?
8. What paid Cloudflare budget and hard spend/fallback threshold is acceptable
   if production should not rely on Free-plan hard limits?

The answers refine the proof program. They do not make the architecture
definitive before the beta, production canary, and final release gates pass.

## Primary sources

- [Neon pricing](https://neon.com/pricing)
- [Neon Scale to Zero](https://neon.com/docs/introduction/scale-to-zero)
- [Neon compute management](https://neon.com/docs/manage/endpoints/)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [Neon November 2025 compute-price announcement](https://neon.com/blog/major-compute-price-reduction-on-neon)
- [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache)
- [Vercel cache-control headers](https://vercel.com/docs/caching/cache-control-headers)
- [How the Vercel CDN works](https://vercel.com/docs/how-vercel-cdn-works)
- [Vercel CDN pricing and usage](https://vercel.com/docs/manage-cdn-usage)
- [Vercel tag-based cache invalidation](https://vercel.com/changelog/tag-based-cache-invalidation-now-available-for-all-responses)
- [Vercel Functions API: tag invalidation](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)
- [Vercel Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing)
- [Vercel Blob overview](https://vercel.com/docs/vercel-blob)
- [Vercel Blob public storage](https://vercel.com/docs/vercel-blob/public-storage)
- [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Vercel Blob security](https://vercel.com/docs/vercel-blob/security)
- [Vercel Edge Config pricing update](https://vercel.com/changelog/pro-edge-config-pricing)
- [Vercel Edge Config design](https://vercel.com/blog/edge-config-ultra-low-latency-data-at-the-edge)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Cloudflare Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Cloudflare WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare SQLite-backed Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
