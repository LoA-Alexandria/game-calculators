import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260930120000_harden_rls_authorization.sql", import.meta.url),
  "utf8",
);
const edgeFunction = await readFile(
  new URL("../supabase/functions/premium-irrigation-planner/index.ts", import.meta.url),
  "utf8",
);
const plannerPage = await readFile(
  new URL("../app/simulations/irrigation-planner/page.tsx", import.meta.url),
  "utf8",
);
const privatePlanner = await readFile(
  new URL("../supabase/private-assets/irrigation-planner/index.html", import.meta.url),
  "utf8",
);

test("Premium status RPC binds non-admin checks to the signed-in user", () => {
  assert.match(migration, /target is distinct from auth\.uid\(\)/i);
  assert.match(migration, /public\.current_site_role\(\) is distinct from 'admin'/i);
  assert.match(migration, /using errcode = '42501'/i);
  assert.match(migration, /grant execute on function public\.has_active_premium\(uuid\) to authenticated/i);
});

test("guild applicants cannot write membership roles directly", () => {
  assert.match(migration, /revoke insert, update on table public\.guild_memberships from authenticated/i);
  assert.match(migration, /grant insert \(guild_id, user_id, status, request_note\)[\s\S]*?to authenticated/i);
  assert.match(migration, /grant update \(status, requested_at, decided_at, decided_by, request_note\)[\s\S]*?to authenticated/i);
  assert.match(migration, /status = 'pending'[\s\S]*?and role = 'member'/i);
  assert.match(migration, /set role = 'member'[\s\S]*?where status in \('pending', 'rejected'\)/i);
});

test("direct-message recipients retain read updates but lose content updates", () => {
  assert.match(migration, /revoke update on table public\.messages from authenticated/i);
  assert.match(migration, /grant update \(read_at\) on table public\.messages to authenticated/i);
});

test("planner access checks the caller and Premium before signing the private asset", () => {
  const authenticate = edgeFunction.indexOf("userClient.auth.getUser()");
  const premiumCheck = edgeFunction.indexOf('userClient.rpc("has_active_premium"');
  const signAsset = edgeFunction.indexOf("createSignedUrl(OBJECT_PATH");
  assert.ok(authenticate >= 0 && authenticate < premiumCheck);
  assert.ok(premiumCheck >= 0 && premiumCheck < signAsset);
  assert.match(edgeFunction, /SIGNED_URL_SECONDS = 600/);
  assert.match(edgeFunction, /from\("premium-tools"\)/);
  assert.match(migration, /values \('premium-tools', 'premium-tools', false\)/i);
  assert.match(migration, /allowed_mime_types = array\['text\/html'\]/i);
});

test("the static planner page invokes the entitlement endpoint instead of shipping a public URL", async () => {
  assert.match(plannerPage, /functions\.invoke<\{ url\?: string \}>\("premium-irrigation-planner"\)/);
  assert.doesNotMatch(plannerPage, /\/tools\/irrigation-planner\/index\.html/);
  await assert.rejects(
    access(new URL("../public/tools/irrigation-planner/index.html", import.meta.url)),
    { code: "ENOENT" },
  );
  await access(new URL("../supabase/private-assets/irrigation-planner/index.html", import.meta.url));
});

test("planner state round-trips without allowing stale host state to replace private saves", () => {
  assert.match(plannerPage, /event\.source !== plannerFrame\.current\?\.contentWindow/);
  assert.match(plannerPage, /event\.origin !== plannerOrigin/);
  assert.match(plannerPage, /type !== "popepoch:planner-state"/);
  assert.match(privatePlanner, /localStorage\.getItem\(key\) === null/);
  assert.match(privatePlanner, /type:'popepoch:planner-state', storage:storage\}, parentOrigin/);
  assert.match(privatePlanner, /window\.parent === window \|\| !parentOrigin/);
  assert.match(privatePlanner, /localStorage\.setItem\(KEY, message\.theme\)/);
  assert.match(plannerPage, /key === "popepoch-theme" \|\| key === "popepoch-scheme"\) continue/);
});
