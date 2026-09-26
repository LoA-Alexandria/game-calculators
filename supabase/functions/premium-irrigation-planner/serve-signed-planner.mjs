const MAX_PLANNER_BYTES = 1_000_000;
const PLANNER_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors https://loa-alexandria.github.io http://localhost:3000 http://localhost:3017",
].join("; ");

export async function serveSignedPlanner(requestUrl, headers, supabaseUrl, signedStoragePath, fetchAsset = fetch) {
  const token = requestUrl.searchParams.get("token");
  if (!token || token.length > 4096 || !/^[A-Za-z0-9._=-]+$/.test(token) || !supabaseUrl) {
    return new Response("Planner link is invalid", { status: 403, headers });
  }

  const storageUrl = new URL(signedStoragePath, supabaseUrl);
  storageUrl.searchParams.set("token", token);
  try {
    const asset = await fetchAsset(storageUrl);
    if (!asset.ok) return new Response("Planner link expired", { status: 403, headers });
    const html = await asset.text();
    if (new TextEncoder().encode(html).length > MAX_PLANNER_BYTES || !/^\s*<!doctype html>/i.test(html)) {
      return new Response("Planner asset is invalid", { status: 503, headers });
    }
    return new Response(html, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": "inline",
        "Content-Security-Policy": PLANNER_CSP,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  } catch {
    return new Response("Planner asset is unavailable", { status: 503, headers });
  }
}
