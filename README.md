# William Temple House — Digital Raffle & Queue Board

Next.js (App Router) app with ShadCN-inspired UI, JSON persistence, and atomic backups to digitize the pantry raffle flow.

## Features
- Staff dashboard (`/admin`) to set ranges, toggle random vs sequential, append tickets, re-randomize, update “now serving,” and reset with confirmations.
- Public display (`/display`) with airport-style grid and QR code sharing (no auto-polling to avoid interrupting form entry).
- Isolated read-only board server (`npm run readonly`) on its own port that polls the JSON state and exposes zero write paths.
- File-based datastore with atomic writes, timestamped backups, and append logic that preserves prior random order.
- Tests written with Vitest + Testing Library for the state manager and grid highlighting.

## Scripts
- `npm run dev` — start the Next.js dev server.
- `npm run build` — production build.
- `npm start` — run the built app.
- `npm run readonly` — start the standalone read-only board on port 4000 (configurable via `READONLY_PORT`).
- `npm test` — run Vitest suite.
- `npm run lint` — run ESLint.

## Read-only board server
- Runs on a separate port (default `4000`) and serves a static view that polls `data/state.json` every 4s.
- Defaults to a high-contrast, read-only display suitable for wall screens.
- No controls or writes are exposed—purely a viewer for wall displays or embeds.
- Displays the WTH horizontal logo at the top of the read-only board.
- Configure via env vars:
  - `READONLY_PORT` — port to listen on (default `4000`).
  - `READONLY_POLL_MS` — poll interval in milliseconds (default `4000`).
  - `READONLY_DATA_DIR` — directory containing `state.json` (default `./data`).
- Start it alongside the main app:
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
  - Env toggles: `DATABASE_URL` enables Postgres; set `USE_DATABASE=false` locally to force the file-based manager when you want to test the legacy path.

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
- Deploy the Next.js app; verify `/display`, `/admin` (auth required), and `/api/state` reads/writes against Neon.
- Confirm magic-link delivery works for an `@williamtemple.org` address.

7) Observability
- Vercel free logs are short-lived; optionally add Sentry free or a lightweight `errors` table in Neon for aggregation (avoid PII).
- Add a simple health/readiness route; ensure errors return 4xx/5xx without stack traces in production.

## Routing and domains (deployment)
- Production domain: `williamtemple.app` (custom domain in Vercel).
- Planned routes:
  - `/` → public read-only board (currently at `http://localhost:4000` via the standalone server). For deployment, serve the read-only page at the root.
  - `/login` → magic-link entry; after sign-in, redirect to the staff landing page (current homepage content).
  - `/admin` → staff dashboard (unchanged), linked from the staff landing page after login.
- Update Vercel project settings to point the production domain at this app; keep localhost paths for development (`http://localhost:3000` app, `http://localhost:4000` standalone read-only server).

## Local development (no external deps)
- `docker-compose` runs the app, Postgres, and MailDev (SMTP + web UI). Default `.env.local` uses `DATABASE_URL=postgresql://postgres:postgres@db:5432/neondb?sslmode=disable`, `EMAIL_SERVER_HOST=maildev`, `EMAIL_SERVER_PORT=1025`.
- Fully offline: leave `RESEND_API_KEY` unset, keep `EMAIL_FROM=login@localhost`, and optionally set `AUTH_BYPASS=true` to skip auth.
- To exercise the full email flow locally, keep `AUTH_BYPASS=false`, start docker, and open magic links from MailDev at `http://localhost:1080`.
- Prefer file-based state? Set `USE_DATABASE=false` (still works with `AUTH_BYPASS=true` if you want to skip auth).

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
   - `USE_DATABASE=true` and `DATABASE_URL=postgresql://postgres:postgres@db:5432/neondb?sslmode=disable`
   - `EMAIL_FROM=login@localhost`, `EMAIL_SERVER_HOST=maildev`, `EMAIL_SERVER_PORT=1025`
   - `ADMIN_EMAIL_DOMAIN` (optional; restrict sign-ins)
   - Optional: `RESEND_API_KEY` + production `EMAIL_FROM` when testing Resend instead of MailDev
   - Optional: `AUTH_BYPASS=true` to skip auth during UI work
4. Required services:
   - Provided by docker compose: app, Postgres, MailDev (open http://localhost:1080 to view emails)
   - Neon/Resend are only needed for production or remote testing

### Environment Variables Reference

See `.env.example` for the full list. Critical vars:
- `AUTH_SECRET` — required for JWT encryption (generate with openssl)
- `DATABASE_URL` — required for magic-link storage
- `RESEND_API_KEY` — required to send magic-link emails
- `EMAIL_FROM` — must be verified in Resend
- `ADMIN_EMAIL_DOMAIN` — restricts login to your domain

Local options:
- Set `USE_DATABASE=false` and `AUTH_BYPASS=true` to skip auth.
- Set `USE_DATABASE=true` with Neon to test the full auth flow.

## Run in Docker
- Build and start locally (includes a bind mount for persistent `data/`):
  ```bash
  docker compose up --build
  ```
- App listens on `http://localhost:3000` (staff dashboard `/admin`, public board `/display`).
- Stored state lives in your host `./data` directory so it survives container restarts.

## Tech
- Next.js 16 (App Router) + Tailwind CSS.
- ShadCN-style UI components (Radix + cva).
- Vitest + Testing Library.

## Theme / design tokens
- Global palette and design tokens live in `src/app/globals.css` (`--color-primary`, surfaces, borders, focus, status colors).
- UI components (buttons, badges, cards, inputs, switches, tooltips) consume those tokens rather than hard-coded colors. Update tokens to change app-wide styling.
- The public display no longer shows a mode pill; mode selection is still managed in the admin controls but not surfaced in the UI chrome.
- Snapshot history: admin can undo/redo and restore from timestamped snapshots (backed by `data/state-*.json` files) via `/api/state` actions and UI controls.
