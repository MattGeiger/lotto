# William Temple House — Digital Raffle & Queue Board

Next.js (App Router) app with ShadCN-inspired UI, JSON persistence, and atomic backups to digitize the pantry raffle flow.

## Features
- Staff dashboard (`/admin`) to set ranges, toggle random vs sequential, append tickets, update “now serving,” mark returned/unclaimed tickets, and reset with confirmations.
- Public display (`/` and `/display`) with airport-style grid, status legend, ticket detail messaging (called/returned/unclaimed), and QR code sharing, using adaptive polling with visibility pause and operating-hours backoff.
- Personalized homepage (`/new`) serves the v2.0 personalization track while preserving the current board visual language (QR panel and top-bar search removed, centered WTH branding added, redundant board-row logo removed so `NOW SERVING` sits centered, and a load-time language picker modal shown on entry with a title that cycles through supported languages every 5 seconds).
- Multilingual display UI with language switcher (English, 中文, Español, Русский, Українська, Tiếng Việt, فارسی, العربية) and automatic RTL direction for Farsi/Arabic.
- Built-in read-only board in Next.js plus an optional standalone server (`npm run readonly`) on its own port for edge/legacy hosting.
- File-based datastore with atomic writes, timestamped backups, and append logic that preserves prior random order.
- Tests written with Vitest + Testing Library for the state manager and grid highlighting.

## Local URLs
- Display: http://localhost:3000/
- Display alias: http://localhost:3000/display
- Personalized homepage: http://localhost:3000/new
- Admin: http://localhost:3000/admin
- Login: http://localhost:3000/login
- Staff intro: http://localhost:3000/staff

## Production Deployment
- Live: https://williamtemple.app (Vercel, custom domain)
- Auth: Magic link + OTP fallback; restricted to `@williamtemple.org`
- Email: Resend sender `login@williamtemple.app` (add DMARC/SPF/DKIM in DNS)
- Database: Neon Postgres (serverless) with shared connection pool
- Hosting: Next.js 16 on Vercel (proxy.ts middleware, serverless runtime)

### Production environment variables
```
AUTH_BYPASS=false
AUTH_SECRET=<generated>
AUTH_TRUST_HOST=true
DATABASE_URL=postgresql://...sslmode=require
EMAIL_FROM=login@williamtemple.app
RESEND_API_KEY=re_...
ADMIN_EMAIL_DOMAIN=williamtemple.org
NODE_ENV=production
```

## Scripts
- `npm run dev` — start the Next.js dev server.
- `npm run build` — production build.
- `npm start` — run the built app.
- `npm run readonly` — start the optional standalone read-only board on port 4000 (configurable via `READONLY_PORT`).
- `npm test` — run Vitest suite.
- `npm run lint` — run ESLint.

## Read-only board options
- Built-in: `/` is the default QR-enabled public board, `/display` is the live alias, and `/new` is the homepage-personalization variant.
- Optional standalone: `npm run readonly` on port `4000`, still polling `data/state.json` for legacy/edge hosting.
- Configure standalone via env vars:
  - `READONLY_PORT` — port to listen on (default `4000`).
  - `READONLY_POLL_MS` — poll interval in milliseconds (default `10000`).
  - `READONLY_DATA_DIR` — directory containing `state.json` (default `./data`).
  ```bash
  npm run readonly
  # open http://localhost:4000
  ```

## Persistence
- State stored under `data/state.json` with timestamped backup files (`state-YYYYMMDDHHMMSSmmm-XXXXXX.json`).
- Data dir is ignored by Git except for `data/.gitkeep` to preserve the folder.

## Deployment intent (Vercel hobby/free)
- Target hosting is Vercel’s hobby/free tier, which uses Neon-backed Postgres for managed storage.
- Vercel filesystem is ephemeral (`/tmp` only), so production persistence must move off local files to a durable store (e.g., Neon Postgres via Vercel Postgres/Neon SDK).
- Stay within hobby limits (approx. 190 compute hours, ~512 MB DB storage, up to 10 DBs); avoid features that require paid plans.
- Plan to map current `state.json` + snapshot history to a Postgres schema (or equivalent durable store) so undo/redo and backups remain available across deployments.

## Deploy runbook (Vercel + Neon + magic links)
1) Provision storage (Neon via Vercel Marketplace Postgres integration)
- Install the Neon integration from the Vercel Marketplace and attach it to this project; note `POSTGRES_URL`/`DATABASE_URL` from the Storage tab.
- Initialize tables (run once via Neon console/psql):
  ```sql
  create table if not exists raffle_state (
    id text primary key default 'singleton',
    payload jsonb not null,
    updated_at timestamptz not null default now()
  );
  create table if not exists raffle_snapshots (
    id text primary key,
    payload jsonb not null,
    created_at timestamptz not null default now()
  );
  create index if not exists raffle_snapshots_created_at_idx on raffle_snapshots (created_at desc);
  ```
- Plan a retention policy (e.g., trim to last N snapshots or last N days) to stay within ~512 MB free storage.
  - SDK: prefer `@neondatabase/serverless` (actively maintained). If upgrading from legacy `@vercel/postgres`, use `@neondatabase/vercel-postgres-compat` as a drop-in during transition.
  - Env: `DATABASE_URL` is required for production and preferred locally; file-based state storage is only used when `DATABASE_URL` is absent in development.

2) Configure auth (magic links, domain-locked)
- Use NextAuth Email provider with Resend free tier for mail delivery.
- Enforce `@williamtemple.org` allowlist in the sign-in callback and/or before sending links.
- Required env vars (set in Vercel project):
  - `DATABASE_URL` (Neon connection string)
  - `AUTH_SECRET` (strong random string)
  - `AUTH_TRUST_HOST=true`
  - `EMAIL_FROM` (verified sender in Resend)
  - `RESEND_API_KEY`
  - `ADMIN_EMAIL_DOMAIN=williamtemple.org`

3) Wire persistence to Postgres
- Replace the file-based state manager with Postgres-backed reads/writes using `@neondatabase/serverless` (or `@neondatabase/vercel-postgres-compat` as a drop-in).
- On persist: upsert `raffle_state` and insert into `raffle_snapshots` unless backups are skipped.
- On load: read `raffle_state`, seeding a default row if missing.
- Undo/redo/list/restore operations should query `raffle_snapshots` ordered by `created_at desc`.
- Keep `/tmp` caching optional only for short-lived warm instances; treat the DB as source of truth.

4) Snapshot retention
- Add a daily cron job (Vercel Cron: max 2 jobs on Hobby) to call a small API route that trims old snapshots (e.g., keep last 500 or last 30 days).
- Avoid per-request rate limiting in KV for public reads; if desired, rate-limit only admin/write routes (tiny traffic) using Upstash Redis free or simple in-process guards.

5) Migration from local files (one-time)
- Write a script to read `data/state.json` and `data/state-*.json` and insert into `raffle_state`/`raffle_snapshots`.
- Run the script locally with `DATABASE_URL` pointing to Neon; verify counts and sample undo/redo in the admin UI.

6) Deploy
- Set all env vars in Vercel.
- Deploy the Next.js app; verify `/` (public board), `/admin` (auth required), and `/api/state` reads/writes against Neon.
- Confirm magic-link delivery works for an `@williamtemple.org` address.

7) Observability
- Vercel free logs are short-lived; optionally add Sentry free or a lightweight `errors` table in Neon for aggregation (avoid PII).
- Add a simple health/readiness route; ensure errors return 4xx/5xx without stack traces in production.

## Routing and domains (deployment)
- Production domain: `williamtemple.app` (custom domain in Vercel).
- Planned routes:
  - `/` → public read-only board route (QR-enabled operational experience).
  - `/display` → public read-only board alias (same behavior as `/`).
  - `/new` → homepage personalization surface (maintains existing look-and-feel direction while iterating).
  - `/login` → magic-link entry; after sign-in, redirect to the staff landing page (current homepage content).
  - `/admin` → staff dashboard (unchanged), linked from the staff landing page after login.
  - `/staff` → staff welcome/intro (former homepage).
- Update Vercel project settings to point the production domain at this app; keep localhost paths for development (`http://localhost:3000` app with `/`, optional `http://localhost:4000` standalone read-only server).

## Local development (no external deps)
- `docker-compose` runs the app, Postgres, and MailDev (SMTP + web UI). Default `.env.local` uses `DATABASE_URL=postgresql://postgres:postgres@db:5432/neondb?sslmode=disable`, `EMAIL_SERVER_HOST=maildev`, `EMAIL_SERVER_PORT=1025`.
- Local `npm run dev` on localhost bypasses auth automatically (no OTP required) unless you are on Vercel.
- Fully offline: leave `RESEND_API_KEY` unset and keep `EMAIL_FROM=login@localhost`.
- To exercise the full email flow locally, keep `AUTH_BYPASS=false`, start docker, and open magic links from MailDev at `http://localhost:1080`.

## Environment Setup

### Local Development

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
2. Generate an auth secret:
   ```bash
   openssl rand -base64 32
   ```
3. Fill `.env.local` with required values:
   - `AUTH_SECRET` (required) and `AUTH_TRUST_HOST=true`
   - `DATABASE_URL=postgresql://postgres:postgres@db:5432/neondb?sslmode=disable`
   - `EMAIL_FROM=login@localhost`, `EMAIL_SERVER_HOST=maildev`, `EMAIL_SERVER_PORT=1025`
   - `ADMIN_EMAIL_DOMAIN` (optional; restrict sign-ins)
   - Optional: `RESEND_API_KEY` + production `EMAIL_FROM` when testing Resend instead of MailDev
   - Optional: `AUTH_BYPASS=true` to bypass auth outside localhost dev (for example, custom non-production environments)
4. Required services:
   - Provided by docker compose: app, Postgres, MailDev (open http://localhost:1080 to view emails)
   - Neon/Resend are only needed for production or remote testing

### Environment Variables Reference

See `.env.example` for the full list. Critical vars:
- `AUTH_SECRET` — required for JWT encryption (generate with openssl)
- `DATABASE_URL` — required for magic-link/OTP storage
- `RESEND_API_KEY` — required to send emails via Resend
- `EMAIL_FROM` — must be verified in Resend (production default `login@williamtemple.app`)
- `ADMIN_EMAIL_DOMAIN` — restricts login to your domain

Local options:
- Localhost dev already bypasses auth automatically; set `AUTH_BYPASS=true` only when you need bypass in non-localhost non-production environments.
- Add `RESEND_API_KEY` and a production `EMAIL_FROM` to test Resend instead of MailDev.

## Run in Docker
- Build and start locally (includes a bind mount for persistent `data/`):
  ```bash
  docker compose up --build
  ```
- App listens on `http://localhost:3000` (public board `/`, alias `/display`, personalized homepage `/new`, staff dashboard `/admin`, staff intro `/staff`).
- Stored state lives in your host `./data` directory so it survives container restarts.

## Tech
- Next.js 16 (App Router) + Tailwind CSS.
- ShadCN-style UI components (Radix + cva).
- Vitest + Testing Library.
## Version History
- 1.2.0 (2026-01-20) — Refined the floating header search cluster so the pill shares the same palette-based gradient/hover fill as the language/theme buttons, keeps responsive text/icon scaling, and sits in its own padded grouping with a shadowed icon trigger.
- 1.1.3 (2026-01-19) — Added the multilingual search bar on the public display so clients can quickly locate a ticket, with dedicated lookups and a “ticket not found” dialog.
- 1.1.2 (2026-01-16) — Adaptive display polling with visibility pause, operating-hours slack, and idle backoff tiers to reduce edge requests.
- 1.1.1 (2026-01-13) — Fixed returned-ticket skipping when advancing draw positions, confirm dialogs now close reliably, and display date refreshes on long-running screens.
- 1.1.0 (2026-01-13) — Added returned/unclaimed ticket statuses, admin controls + Live State lists, display legend + ticket detail messaging, and returned tickets excluded from wait estimates with auto-advance when returned.
- 1.0.4 (2025-12-12) — OTP-first login default and staff version display; lint cleanup.
- 1.0.3 (2025-11-29) — Added operating hours with timezone selection, preserved through reset, plus closed-day display messaging and pantry hours table.
- 1.0.1 (2025-11-28) — Added Vietnamese/Farsi/Arabic translations, RTL-aware public display (scoped to display only), and per-language timestamp localization.
- 1.0.0 (2025-11-27) — Production release with magic link + OTP auth, Neon/Resend, snapshot cleanup, Speed Insights, custom domain.
- 0.9.0 — Initial Vercel deployment and custom domain setup.

## Theme / design tokens
- Global palette and design tokens live in `src/app/globals.css` (`--color-primary`, surfaces, borders, focus, status colors).
- UI components (buttons, badges, cards, inputs, switches, tooltips) consume those tokens rather than hard-coded colors. Update tokens to change app-wide styling.
- The public display no longer shows a mode pill; mode selection is still managed in the admin controls but not surfaced in the UI chrome.
- Snapshot history: admin can undo/redo and restore from timestamped snapshots (backed by `data/state-*.json` files) via `/api/state` actions and UI controls.
