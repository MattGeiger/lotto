## Deployment migration plan (Neon + NextAuth magic links)

### Overview
Goal: run the same stack locally and on Vercel using Neon Postgres, NextAuth v5 email/magic-link auth (Resend), and keep parity between dev and production. Local Docker should read `.env.local`. **Production now requires `DATABASE_URL`; file-system storage is development-only.**

### Steps (canonical)
1) Provision Neon
   - Create a project in Neon (free tier OK).
   - Copy the connection string (`postgresql://...sslmode=require`).
   - Run schema once in Neon SQL editor using `schema.sql` at the repo root. It creates raffle tables, snapshots, indexes, and NextAuth tables.

2) Update env for local (Docker reads `.env.local` via `env_file`)
   - Add/edit `.env.local`:
     ```
     DATABASE_URL=postgresql://postgres:postgres@db:5432/neondb?sslmode=disable
     EMAIL_FROM=login@localhost
     EMAIL_SERVER_HOST=maildev
     EMAIL_SERVER_PORT=1025
     ADMIN_EMAIL_DOMAIN=williamtemple.org
     AUTH_SECRET=<openssl rand -base64 32>
     AUTH_BYPASS=false
     AUTH_TRUST_HOST=true
     # RESEND_API_KEY=... (only needed when testing Resend instead of MailDev)
     ```
   - Docker pulls these via `env_file: .env.local`.
   - For production, use `.env.production.example` as a template; `DATABASE_URL` is mandatory.

3) Dependencies
   - Install `@auth/pg-adapter` (for Neon) alongside existing `@neondatabase/serverless`.

4) Code changes (auth)
   - `src/lib/auth.ts`:
     - Uses `DATABASE_URL` exclusively for the adapter; fails fast when missing (production required).
     - Resend only when `RESEND_API_KEY` is set; otherwise defaults to MailDev settings above for local.
     - Domain allowlist enforced; `trustHost` true.

5) Docker config
   - `docker-compose.yml` uses:
     ```yaml
     env_file:
       - .env.local
    environment:
       - NODE_ENV=development
     ```
   - Services: app, Postgres (`db`), MailDev (`maildev`).

6) Test flow checklist
   - `docker compose down && docker compose up --build`
   - Visit `/login`, submit `@williamtemple.org`.
   - Email arrives from `login@williamtemple.app`; link signs in.
   - Neon tables show user rows; verification_token row appears then is consumed.
   - `/admin` accessible post-login; non-allowed domains rejected.

7) Vercel notes
   - Set envs in Vercel: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL_DOMAIN`.
   - Same auth config works on Vercel; Neon free tier is sufficient. Production will fail fast without `DATABASE_URL`.
   - Next.js 16 renamed `middleware` → `proxy`; file lives at `src/proxy.ts` with the same matcher guarding `/admin` and `/api/state` and runs on the Node.js runtime by default (no Edge support).

### Status
- Schema captured in `schema.sql`; adapter uses `DATABASE_URL` exclusively.
- Populate `.env.local` / `.env.production` before deployment. Local MailDev remains the default mailer without RESEND.
- Pending: run `docker compose up --build` and validate magic-link flow end-to-end.
