// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

// Idempotent schema applier. Runs `schema.sql` (the canonical core schema,
// including the AI-translation tables) against the target Postgres database.
// Safe to re-run: create and alter statements use IF NOT EXISTS, while data
// migrations are written to be idempotent.
//
// Usage:
//   node --env-file=.env.local scripts/apply-schema.mjs            # core schema
//   node --env-file=.env.local scripts/apply-schema.mjs --arcade   # also arcade
//   node --env-file=.env.local scripts/apply-schema.mjs --dry-run  # verify only
//
// Reads DATABASE_URL (and ARCADE_DATABASE_URL with --arcade) from the
// environment. Uses `pg` (node-postgres), which speaks the standard wire
// protocol to both local Docker Postgres and Neon.
//
// Safety: each file is applied inside a single transaction (BEGIN/COMMIT) so it
// is all-or-nothing — a failure rolls back, never leaving a half-migrated
// schema. Every statement is idempotent, so applying to a DB that already has
// some or all of the schema is safe. Use --dry-run first against production
// (Neon) to confirm the migration applies cleanly without writing anything.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import pg from "pg";

const { Pool } = pg;
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const applyFile = async (label, connectionString, schemaPath, dryRun) => {
  if (!connectionString) {
    console.error(`[skip] ${label}: connection string not set.`);
    return false;
  }
  const sql = readFileSync(join(repoRoot, schemaPath), "utf8");
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    // Apply the whole idempotent file atomically: every statement commits
    // together or none do, so a failure can never leave a half-migrated schema.
    // (All statements are idempotent and safe to wrap and re-run.)
    await client.query("BEGIN");
    await client.query(sql);
    if (dryRun) {
      await client.query("ROLLBACK");
      console.log(`[dry-run] ${label}: ${schemaPath} applied cleanly, rolled back (no changes kept).`);
    } else {
      await client.query("COMMIT");
      console.log(`[ok]   ${label}: applied ${schemaPath} (atomic).`);
    }
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback error */
    }
    console.error(`[fail] ${label}: ${error?.message ?? error} (rolled back, no changes applied).`);
    return false;
  } finally {
    client.release();
    await pool.end();
  }
};

const main = async () => {
  const withArcade = process.argv.includes("--arcade");
  // --dry-run applies the schema inside a transaction and rolls back — proves it
  // would apply cleanly against the target (e.g. production Neon) without writing.
  const dryRun = process.argv.includes("--dry-run");
  let ok = await applyFile("core", process.env.DATABASE_URL, "schema.sql", dryRun);
  if (withArcade) {
    ok = (await applyFile("arcade", process.env.ARCADE_DATABASE_URL, "schema.arcade.sql", dryRun)) && ok;
  }
  process.exit(ok ? 0 : 1);
};

await main();
