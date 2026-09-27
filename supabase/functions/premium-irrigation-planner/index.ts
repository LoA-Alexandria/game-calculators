import { createClient } from "npm:@supabase/supabase-js@2";
import { loadTrustedPlannerHtml } from "./load-trusted-planner.mjs";

const ALLOWED_ORIGINS = new Set([
  "https://loa-alexandria.github.io",
  "http://localhost:3000",
  "http://localhost:3017",
]);
const OBJECT_PATH = "irrigation-planner/index.html";
const SIGNED_URL_SECONDS = 600;

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const headers = corsHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ error: "Sign in required" }, { status: 401, headers });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return Response.json({ error: "Planner service is not configured" }, { status: 503, headers });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return Response.json({ error: "Invalid session" }, { status: 401, headers });

  const { data: hasPremium, error: premiumError } = await userClient.rpc("has_active_premium", {
    target: user.id,
  });
  if (premiumError) return Response.json({ error: "Could not verify Premium access" }, { status: 503, headers });
  if (hasPremium !== true) return Response.json({ error: "Active Premium required" }, { status: 403, headers });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: storageError } = await adminClient.storage
    .from("premium-tools")
    .createSignedUrl(OBJECT_PATH, SIGNED_URL_SECONDS);
  if (storageError || !data?.signedUrl) {
    return Response.json({ error: "Planner asset is unavailable" }, { status: 503, headers });
  }
  try {
    const html = await loadTrustedPlannerHtml(data.signedUrl);
    return Response.json({ html }, { status: 200, headers });
  } catch {
    return Response.json({ error: "Planner asset does not match this release" }, { status: 503, headers });
  }
});
