-- Neon database schema for raffle state and authentication

-- Main state table
CREATE TABLE IF NOT EXISTS raffle_state (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Snapshot history
CREATE TABLE IF NOT EXISTS raffle_snapshots (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for snapshot lookups
CREATE INDEX IF NOT EXISTS raffle_snapshots_created_at_idx
  ON raffle_snapshots(created_at DESC);

CREATE INDEX IF NOT EXISTS raffle_snapshots_id_idx
  ON raffle_snapshots(id);

-- NextAuth tables
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

CREATE INDEX IF NOT EXISTS verification_token_identifier_idx
  ON verification_token(identifier);

CREATE INDEX IF NOT EXISTS accounts_userId_idx
  ON accounts("userId");

CREATE INDEX IF NOT EXISTS sessions_userId_idx
  ON sessions("userId");

CREATE INDEX IF NOT EXISTS sessions_sessionToken_idx
  ON sessions("sessionToken");
