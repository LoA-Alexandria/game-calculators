import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { loadTrustedPlannerHtml } from "../supabase/functions/premium-irrigation-planner/load-trusted-planner.mjs";
import { prepareSandboxedPlannerHtml } from "../lib/irrigation-planner-sandbox.ts";

const asset = await readFile(new URL("../supabase/private-assets/irrigation-planner/index.html", import.meta.url));
const plannerSource = asset.toString("utf8");

test("only the versioned private planner asset may run in the browser", async () => {
  const html = await loadTrustedPlannerHtml("signed-url", async () => new Response(asset));
  assert.equal(html, asset.toString("utf8"));

  const changed = new Uint8Array(asset);
  changed[100] ^= 1;
  await assert.rejects(
    loadTrustedPlannerHtml("signed-url", async () => new Response(changed)),
    /does not match this release/,
  );
  await assert.rejects(
    loadTrustedPlannerHtml("expired-url", async () => new Response("expired", { status: 403 })),
    /could not be read/,
  );
});

test("planner puts the main solve action before optional search settings", () => {
  const solveButton = plannerSource.indexOf('id="solveBtn"');
  const advancedOptions = plannerSource.indexOf('<details class="advanced-search">');
  assert.ok(solveButton >= 0 && advancedOptions > solveButton);
  assert.match(plannerSource, /id="budgetSel"/);
  assert.match(plannerSource, /id="tierAutoChk"/);
  assert.match(plannerSource, /id="minTypeChk"/);
});

test("planner wrapper explains the workflow and collapses reference notes", async () => {
  const page = await readFile(new URL("../app/simulations/irrigation-planner/page.tsx", import.meta.url), "utf8");
  assert.match(page, /planner-quickstart-title/);
  assert.match(page, /planner-workspace-title/);
  assert.match(page, /<details className="planner-notes">/);
});

test("sandboxed planner uses a bounded memory store and nonce-checked persistence bridge", () => {
  const dangerous = "</script><script>unexpected()</script>";
  const html = prepareSandboxedPlannerHtml(
    asset.toString("utf8"),
    { irrigation_planner_v1: dangerous, irrigation_prod_v1: "x".repeat(100_001) },
    "https://loa-alexandria.github.io",
    "one-time-nonce",
  );
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /\blocalStorage\b/);
  assert.doesNotMatch(html, /<script>unexpected\(\)<\/script>/);

  const firstScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(firstScript);
  const listeners = new Map();
  const messages = [];
  const parent = { postMessage: (message, origin) => messages.push({ message, origin }) };
  const window = {
    parent,
    addEventListener: (type, handler) => listeners.set(type, handler),
  };
  vm.runInNewContext(firstScript, {
    window,
    document: { documentElement: { classList: { add: () => {} } } },
  });
  assert.equal(window.__plannerStorage.getItem("irrigation_planner_v1"), dangerous);
  assert.equal(window.__plannerStorage.getItem("irrigation_prod_v1"), null);
  window.__plannerStorage.setItem("irrigation_planner_v1", "saved-layout");
  assert.equal(messages.at(-1).message.nonce, "one-time-nonce");
  assert.equal(messages.at(-1).message.storage.irrigation_planner_v1, "saved-layout");
  assert.equal(messages.at(-1).origin, "https://loa-alexandria.github.io");

  const count = messages.length;
  listeners.get("message")({
    source: parent,
    origin: "https://attacker.example",
    data: { type: "popepoch:planner-ping", nonce: "one-time-nonce" },
  });
  assert.equal(messages.length, count);
  listeners.get("message")({
    source: parent,
    origin: "https://loa-alexandria.github.io",
    data: { type: "popepoch:planner-ping", nonce: "one-time-nonce" },
  });
  assert.equal(messages.length, count + 1);
});
