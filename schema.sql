-- Neon database schema for raffle state and authentication

-- Main state table
CREATE TABLE IF NOT EXISTS raffle_state (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Existing deployments predate authoritative public-state revisions. The
-- default preserves their current row and the next state persist allocates the
-- first positive revision atomically.
ALTER TABLE raffle_state
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0);

-- Transactional intent for the derived realtime public-state projection.
-- Payload is the strict public allowlist, never complete internal raffle state.
CREATE TABLE IF NOT EXISTS raffle_public_state_publications (
  publication_id TEXT PRIMARY KEY,
  revision BIGINT NOT NULL UNIQUE CHECK (revision > 0),
  protocol_version INTEGER NOT NULL CHECK (protocol_version > 0),
  checksum TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'failed', 'superseded')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  committed_at TIMESTAMPTZ NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raffle_public_state_publications_revision_idx
  ON raffle_public_state_publications(revision DESC);

CREATE INDEX IF NOT EXISTS raffle_public_state_publications_status_idx
  ON raffle_public_state_publications(status, revision DESC);

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

-- Immutable operational closeouts consumed by FEED. These records are not
-- part of the undo/snapshot retention system and are never pruned by Reset.
CREATE TABLE IF NOT EXISTS raffle_session_summaries (
  summary_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  supersedes_summary_id TEXT REFERENCES raffle_session_summaries(summary_id),
  content_hash TEXT NOT NULL,
  service_date DATE NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  UNIQUE (session_id, revision),
  UNIQUE (session_id, content_hash)
);

CREATE INDEX IF NOT EXISTS raffle_session_summaries_cursor_idx
  ON raffle_session_summaries(recorded_at ASC, summary_id ASC);

CREATE INDEX IF NOT EXISTS raffle_session_summaries_service_date_idx
  ON raffle_session_summaries(service_date);

-- One narrowly scoped credential authorizes FEED to read immutable queue
-- summaries. LOTTO stores only its SHA-256 hash; generating another token
-- atomically replaces this singleton and immediately invalidates the old one.
CREATE TABLE IF NOT EXISTS feed_integration_credentials (
  id TEXT PRIMARY KEY CHECK (id = 'singleton'),
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- NextAuth tables
CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'magic_link',
  PRIMARY KEY (identifier, token)
);

-- Existing deployments predate typed verification records. Auth.js inserts
-- Magic Link rows without naming this column, so the default preserves adapter
-- compatibility while LOTTO's OTP path can remain isolated.
ALTER TABLE verification_token
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'magic_link';

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

CREATE INDEX IF NOT EXISTS verification_token_identifier_type_idx
  ON verification_token(identifier, type);

CREATE INDEX IF NOT EXISTS accounts_userId_idx
  ON accounts("userId");

CREATE INDEX IF NOT EXISTS sessions_userId_idx
  ON sessions("userId");

CREATE INDEX IF NOT EXISTS sessions_sessionToken_idx
  ON sessions("sessionToken");

-- OTP safeguards
CREATE TABLE IF NOT EXISTS otp_failures (
  email TEXT PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_request TIMESTAMPTZ
);

-- =====================================================================
-- AI Translation stack (v2.0, Feature 3 — ported from FEED)
-- =====================================================================

-- Enabled-language catalog. Keyed by English name (matches translations.language).
-- The 8 hardcoded base languages are always enabled; others are opt-in and only
-- become client-visible once their translations are complete.
CREATE TABLE IF NOT EXISTS languages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI provider/model configurations. API keys are encrypted at rest
-- (AES-256-GCM, master key from ENCRYPTION_MASTER_KEY env var); per-row salt.
CREATE TABLE IF NOT EXISTS ai_configurations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'apikey', -- 'apikey' | 'prompt'
  service_type TEXT,                   -- 'OpenAI' | 'Anthropic' | 'Google'
  model TEXT,
  model_name TEXT,
  encrypted_api_key TEXT,
  salt TEXT,
  input_cost DOUBLE PRECISION DEFAULT 0,
  output_cost DOUBLE PRECISION DEFAULT 0,
  unit_price TEXT DEFAULT 'per_1m',    -- 'per_1m' | 'per_1k'
  temperature DOUBLE PRECISION,
  top_p DOUBLE PRECISION,
  thinking_level TEXT,
  max_tokens INT,
  input_token_limit INT,
  output_token_limit INT,
  daily_cost_limit DOUBLE PRECISION,
  monthly_cost_limit DOUBLE PRECISION,
  tokens_per_minute INT,
  requests_per_minute INT,
  requests_per_day INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Shared system prompts driving translation/classification.
CREATE TABLE IF NOT EXISTS system_prompts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  prompt_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  translation_approach TEXT,
  context_guidance TEXT,
  additional_guidance TEXT,
  temperature DOUBLE PRECISION,
  top_p DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Translation cache. One row per (original text, language, type) with a status.
CREATE TABLE IF NOT EXISTS translations (
  id SERIAL PRIMARY KEY,
  original_text TEXT NOT NULL,
  translated_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  language TEXT NOT NULL,                  -- English name, matches languages.name
  type TEXT NOT NULL,                      -- 'ui_string' | 'brand_string' | 'announcement' | 'inventory'
  metadata JSONB,
  prompt_tokens INT,
  completion_tokens INT,
  total_cost DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT translations_unique_combo UNIQUE (original_text, language, type)
);

CREATE INDEX IF NOT EXISTS translations_status_idx ON translations(status);
CREATE INDEX IF NOT EXISTS translations_language_idx ON translations(language);
CREATE INDEX IF NOT EXISTS translations_type_idx ON translations(type);

-- Per-operation token/cost accounting for limit enforcement + metrics.
CREATE TABLE IF NOT EXISTS usage_records (
  id SERIAL PRIMARY KEY,
  ai_configuration_id INT REFERENCES ai_configurations(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  operation_type TEXT,
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_cost DOUBLE PRECISION DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  duration INT,
  translation_id INT REFERENCES translations(id) ON DELETE SET NULL,
  model_used TEXT,
  service_provider TEXT,
  language TEXT
);

CREATE INDEX IF NOT EXISTS usage_records_timestamp_idx ON usage_records(timestamp DESC);
CREATE INDEX IF NOT EXISTS usage_records_provider_idx ON usage_records(service_provider);
CREATE INDEX IF NOT EXISTS usage_records_success_idx ON usage_records(success);

-- Configurable branding: per-deployment appearance configurations
-- (docs/CONFIGURABLE_BRANDING_PLAN.md). At most one row is active; template
-- rows are the read-only wizard starting points seeded from the compiled
-- brand profiles.
CREATE TABLE IF NOT EXISTS brand_configurations (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS brand_configurations_single_active_idx
  ON brand_configurations(is_active) WHERE is_active;
