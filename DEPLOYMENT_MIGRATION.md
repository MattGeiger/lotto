## Deployment migration plan (Neon + NextAuth magic links)

### Overview
Goal: run the same stack locally and on Vercel using Neon Postgres, NextAuth v5 email/magic-link auth (Resend), and keep parity between dev and production. Local Docker should read `.env.local`.

### Steps (canonical)
1) Provision Neon
   - Create a project in Neon (free tier OK).
   - Copy the connection string (`postgresql://...sslmode=require`).
   - Run schema once in Neon SQL editor:
     ```sql
     CREATE TABLE IF NOT EXISTS verification_token (
       identifier TEXT NOT NULL,
       expires TIMESTAMPTZ NOT NULL,
       token TEXT NOT NULL,
       PRIMARY KEY (identifier, token)
     );
     CREATE TABLE IF NOT EXISTS users (
       id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
       name TEXT,
       email TEXT NOT NULL UNIQUE,
       "emailVerified" TIMESTAMPTZ,
       image TEXT
     );
     CREATE TABLE IF NOT EXISTS accounts (
       id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
       "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       type TEXT NOT NULL,
       provider TEXT NOT NULL,
       "providerAccountId" TEXT NOT NULL,
       refresh_token TEXT,
       access_token TEXT,
       expires_at BIGINT,
       token_type TEXT,
       scope TEXT,
       id_token TEXT,
       session_state TEXT,
       UNIQUE(provider, "providerAccountId")
     );
     CREATE TABLE IF NOT EXISTS sessions (
       id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
       "sessionToken" TEXT NOT NULL UNIQUE,
       "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       expires TIMESTAMPTZ NOT NULL
     );
     CREATE INDEX IF NOT EXISTS verification_token_identifier_idx ON verification_token(identifier);
     CREATE INDEX IF NOT EXISTS accounts_userId_idx ON accounts("userId");
     CREATE INDEX IF NOT EXISTS sessions_userId_idx ON sessions("userId");
     CREATE INDEX IF NOT EXISTS sessions_sessionToken_idx ON sessions("sessionToken");
     ```

2) Update env for local (Docker reads `.env.local` via `env_file`)
   - Add/edit `.env.local`:
     ```
     USE_DATABASE=true
     DATABASE_URL=postgresql://<neon-connection-string>
     RESEND_API_KEY=...
     EMAIL_FROM=login@williamtemple.app
     ADMIN_EMAIL_DOMAIN=williamtemple.org
     NEXTAUTH_URL=http://localhost:3000
     AUTH_URL=http://localhost:3000
     AUTH_SECRET=<openssl rand -base64 32>
     AUTH_BYPASS=false
     AUTH_TRUST_HOST=true
     ```
   - Docker pulls these via `env_file: .env.local`.

3) Dependencies
   - Install `@auth/pg-adapter` (for Neon) alongside existing `@neondatabase/serverless`.

4) Code changes (auth)
   - `src/lib/auth.ts` should:
     - Import `PostgresAdapter` and `Pool` from `@neondatabase/serverless`.
     - Create `resend` only when `RESEND_API_KEY` is set.
     - Build `adapter` conditionally when `DATABASE_URL` is present and `USE_DATABASE` is not false.
     - Wrap NextAuth config in a function: `export const { handlers, auth } = NextAuth(() => ({ ... }))`.
     - Keep domain allowlist, magic link email send via Resend, trustHost checking `AUTH_URL`/`NEXTAUTH_URL`/`AUTH_TRUST_HOST`.
     - Log a warning if no adapter (email auth won’t work without DB).

5) Docker config
   - `docker-compose.yml` uses:
     ```yaml
     env_file:
       - .env.local
     environment:
       - NODE_ENV=production
     ```

6) Test flow checklist
   - `docker compose down && docker compose up --build`
   - Visit `/login`, submit `@williamtemple.org`.
   - Email arrives from `login@williamtemple.app`; link signs in.
   - Neon tables show user rows; verification_token row appears then is consumed.
   - `/admin` accessible post-login; non-allowed domains rejected.

7) Vercel notes
   - Set envs in Vercel: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (prod domain), `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL_DOMAIN`, `USE_DATABASE=true`.
   - Do not set `AUTH_TRUST_HOST` in production.
   - Same auth config works on Vercel; Neon free tier is sufficient.

### Status
- Pending: implement adapter wiring in `src/lib/auth.ts` and install `@auth/pg-adapter`.
- Pending: populate `.env.local` with Neon `DATABASE_URL` and `AUTH_SECRET`.
- Pending: run `docker compose up --build` and validate magic-link flow end-to-end.
