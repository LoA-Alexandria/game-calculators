// SHA-256 of the versioned private asset, checked against the deployed copy.
// The page runs this HTML on the site origin, so an unexpected Storage update
// must never become executable code for signed-in visitors.
const TRUSTED_PLANNER_SHA256 = "8a1b12edc0bd69bd23d8987c2de9df76fba1fd6224c3073044e8a2881b1793c5";
const MAX_PLANNER_BYTES = 1_000_000;

export async function loadTrustedPlannerHtml(signedUrl, fetchAsset = fetch) {
  const asset = await fetchAsset(signedUrl);
  if (!asset.ok) throw new Error("Private planner asset could not be read");
  const bytes = new Uint8Array(await asset.arrayBuffer());
  if (bytes.byteLength > MAX_PLANNER_BYTES) throw new Error("Private planner asset is too large");

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const sha256 = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (sha256 !== TRUSTED_PLANNER_SHA256) throw new Error("Private planner asset does not match this release");

  const html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!/^\s*<!doctype html>/i.test(html)) throw new Error("Private planner asset is not HTML");
  return html;
}
