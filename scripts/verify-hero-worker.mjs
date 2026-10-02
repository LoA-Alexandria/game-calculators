import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { optimizeTeams } from "../lib/calculators/hero-battle.ts";

// Execute the exported worker bundle in a worker-like JS context, without a browser.
const root = path.resolve("out");
const chunks = path.join(root, "_next/static/chunks");
const bundleNames = fs.readdirSync(chunks, { recursive: true }).filter((name) => name.endsWith(".js"));
const bundles = bundleNames.map((name) => fs.readFileSync(path.join(chunks, name), "utf8"));
const bundleText = bundles.join("\n");
const turboMatch = bundleText.match(/"static\/chunks\/(turbopack-worker-[^"]+)",(\["static\/chunks\/[^]]+\])/);
const webpackWorkerId = bundleText.match(/new Worker[\s\S]{0,300}?\.u\((\d+)\)/)?.[1];
let workerFile, dependencies = [], workerHref;
if (turboMatch) {
  workerFile = path.join(chunks, turboMatch[1]);
  dependencies = JSON.parse(turboMatch[2]).map((entry) => "/_next/" + entry);
  workerHref = "https://example.test/_next/static/chunks/" + turboMatch[1];
} else if (webpackWorkerId) {
  const entryName = bundleNames.find((name) => new RegExp(`(?:^|[\\/])${webpackWorkerId}[.-].*\\.js$`).test(name));
  assert.ok(entryName, "webpack worker entry exists in the exported chunks");
  workerFile = path.join(chunks, entryName);
  workerHref = "https://example.test/_next/static/chunks/" + entryName;
} else {
  assert.fail("exported worker entry and dependencies exist");
}
const messages = [];
class WorkerGlobalScope { static [Symbol.hasInstance](value) { return value?.self === value; } }
const context = Object.assign(new WorkerGlobalScope(), {
  WorkerGlobalScope, URL, console, setTimeout, clearTimeout, queueMicrotask,
  location: { origin: "https://example.test", href: workerHref + (turboMatch ? "#params=" + encodeURIComponent(JSON.stringify([dependencies, "", "", ""])) : "") },
  postMessage: (message) => messages.push(message),
});
context.self = context;
const sandbox = vm.createContext(context);
const execute = (file) => vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
context.importScripts = (...urls) => {
  for (const url of urls) {
    const file = path.resolve(root, "." + new URL(url, context.location.href).pathname);
    assert.ok(file.startsWith(root + path.sep));
    execute(file);
  }
};
execute(workerFile);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(typeof context.onmessage, "function");
const hero = (id) => ({ id, atk: 100, hp: 1000, stars: 0 });
const pool = [hero("achilles"), hero("caesar"), hero("da-vinci")];
const options = { rounds: 10, seed: 42, trials: 4, budget: 20, size: 2, objective: "damage", enemy: [hero("guinevere")], dummy: false, enemyReduction: 0, items: [], collection: [] };
context.onmessage({ data: { pool, options } });
const result = messages.find((message) => message.result)?.result;
assert.deepEqual(JSON.parse(JSON.stringify(result)), JSON.parse(JSON.stringify(optimizeTeams(pool, options))));
console.log("Exported worker runs and matches the source engine: 6 ordered teams, 128 validation trials.");
