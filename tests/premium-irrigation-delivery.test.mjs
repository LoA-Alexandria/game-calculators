import assert from "node:assert/strict";
import test from "node:test";
import { serveSignedPlanner } from "../supabase/functions/premium-irrigation-planner/serve-signed-planner.mjs";

const STORAGE_PATH = "/storage/v1/object/sign/premium-tools/irrigation-planner/index.html";
const ORIGIN = "https://example.supabase.co";
const headers = { "Cache-Control": "no-store" };

function plannerRequest(token) {
  const url = new URL("https://example.supabase.co/functions/v1/premium-irrigation-planner");
  if (token !== undefined) url.searchParams.set("token", token);
  return url;
}

test("unsigned and malformed planner requests never read the private asset", async () => {
  let reads = 0;
  const fetchAsset = () => { reads += 1; throw new Error("unexpected read"); };
  for (const token of [undefined, "", "../../other-asset", "x".repeat(4097)]) {
    const response = await serveSignedPlanner(plannerRequest(token), headers, ORIGIN, STORAGE_PATH, fetchAsset);
    assert.equal(response.status, 403);
  }
  assert.equal(reads, 0);
});

test("an expired signature cannot return executable HTML", async () => {
  const response = await serveSignedPlanner(
    plannerRequest("signed.token"), headers, ORIGIN, STORAGE_PATH,
    async () => new Response("expired", { status: 403 }),
  );
  assert.equal(response.status, 403);
  assert.notEqual(response.headers.get("Content-Type"), "text/html; charset=utf-8");
});

test("a valid signature serves only the fixed private object as HTML", async () => {
  const html = "<!doctype html><html><body>Planner</body></html>";
  let requestedUrl;
  const response = await serveSignedPlanner(
    plannerRequest("signed.token"), headers, ORIGIN, STORAGE_PATH,
    async (url) => {
      requestedUrl = url;
      return new Response(html, { headers: { "Content-Type": "text/plain" } });
    },
  );
  assert.equal(requestedUrl.origin, ORIGIN);
  assert.equal(requestedUrl.pathname, STORAGE_PATH);
  assert.equal(requestedUrl.searchParams.get("token"), "signed.token");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), html);
  assert.equal(response.headers.get("Content-Type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(response.headers.get("Content-Security-Policy"), /frame-ancestors https:\/\/loa-alexandria\.github\.io/);
});

test("non-HTML and oversized private responses are refused", async () => {
  for (const html of ["not HTML", `<!doctype html>${"x".repeat(1_000_000)}`]) {
    const response = await serveSignedPlanner(
      plannerRequest("signed.token"), headers, ORIGIN, STORAGE_PATH,
      async () => new Response(html),
    );
    assert.equal(response.status, 503);
  }
});
