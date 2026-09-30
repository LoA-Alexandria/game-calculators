import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261012120000_early_supporters.sql", import.meta.url),
  "utf8",
);

test("Early Supporter cohort is admin-granted, Premium-gated, and capped under a transaction lock", () => {
  assert.match(migration, /create table public\.early_supporters/i);
  assert.match(migration, /public\.current_site_role\(\) is distinct from 'admin'/i);
  assert.match(migration, /public\.has_active_premium\(new\.user_id\)/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /count\(\*\).*early_supporters\).*>= 20/is);
  assert.match(migration, /revoked_at timestamptz/i);
  assert.match(migration, /revoke all on table public\.early_supporters from anon, authenticated/i);
});

test("Public supporter credits expose opted-in names only and member identity remains private", () => {
  assert.match(migration, /grant select \(display_name, granted_at\).*to anon/is);
  assert.match(migration, /to anon\s+using \(show_on_credits and revoked_at is null\)/i);
  assert.match(migration, /user_id = auth\.uid\(\) or public\.current_site_role\(\) = 'admin'/i);
  assert.match(migration, /not show_on_credits or display_name is not null/i);
});
