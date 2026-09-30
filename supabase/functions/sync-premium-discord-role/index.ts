import { createClient } from "npm:@supabase/supabase-js@2";
import { earlySupporterRoleShouldBePresent, premiumRoleShouldBePresent } from "./premium-role.ts";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1534685294371274822";
const allowedOrigins = new Set([
  "https://loa-alexandria.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://loa-alexandria.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("Origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });

  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ error: "Not signed in" }, { status: 401, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return Response.json({ error: "Invalid session" }, { status: 401, headers });

    const body = await request.json().catch(() => ({})) as { userId?: unknown };
    const targetUserId = typeof body.userId === "string" && body.userId ? body.userId : user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (targetUserId !== user.id) {
      const { data: callerAccess, error: callerError } = await adminClient
        .from("editor_access").select("role").eq("user_id", user.id).maybeSingle();
      if (callerError) return Response.json({ error: "Could not check administrator access" }, { status: 500, headers });
      if (callerAccess?.role !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403, headers });
    }

    const [
      { data: entitlement, error: entitlementError },
      { data: targetAccess, error: accessError },
      { data: earlySupporter, error: supporterError },
    ] = await Promise.all([
      adminClient.from("premium_entitlements").select("status, starts_at, expires_at").eq("user_id", targetUserId).maybeSingle(),
      adminClient.from("editor_access").select("discord_user_id").eq("user_id", targetUserId).maybeSingle(),
      adminClient.from("early_supporters").select("revoked_at").eq("user_id", targetUserId).maybeSingle(),
    ]);
    if (entitlementError || accessError || supporterError) return Response.json({ error: "Could not load Premium, supporter, or Discord account data" }, { status: 500, headers });
    const discordUserId = targetAccess?.discord_user_id;
    if (!discordUserId || !/^\d{5,32}$/.test(discordUserId)) {
      return Response.json({ error: "This account has not signed in with its linked Discord account yet" }, { status: 409, headers });
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const vipRoleId = Deno.env.get("DISCORD_VIP_ROLE_ID");
    if (!botToken || !vipRoleId || !/^\d{5,32}$/.test(vipRoleId)) {
      return Response.json({ error: "Discord VIP role integration is not configured" }, { status: 503, headers });
    }

    const active = premiumRoleShouldBePresent(entitlement);
    const isEarlySupporter = earlySupporterRoleShouldBePresent(earlySupporter);
    const earlySupporterRoleId = Deno.env.get("DISCORD_EARLY_SUPPORTER_ROLE_ID");
    const testVersionRoleId = Deno.env.get("DISCORD_TEST_VERSION_ROLE_ID");
    const warnings: string[] = [];
    const roleChanges = [{ id: vipRoleId, present: active, label: "VIP" }];
    if (isEarlySupporter && (!earlySupporterRoleId || !/^\d{5,32}$/.test(earlySupporterRoleId))) {
      warnings.push("Early Supporter Discord role is not configured");
    }
    if (isEarlySupporter && (!testVersionRoleId || !/^\d{5,32}$/.test(testVersionRoleId))) {
      warnings.push("Test Version Discord role is not configured");
    }
    if (earlySupporterRoleId && /^\d{5,32}$/.test(earlySupporterRoleId)) {
      roleChanges.push({ id: earlySupporterRoleId, present: isEarlySupporter, label: "Early Supporter" });
    }
    if (testVersionRoleId && /^\d{5,32}$/.test(testVersionRoleId)) {
      roleChanges.push({ id: testVersionRoleId, present: isEarlySupporter, label: "Test Version" });
    }

    const results = await Promise.all(roleChanges.map(async (role) => {
      const response = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/members/${discordUserId}/roles/${role.id}`, {
        method: role.present ? "PUT" : "DELETE",
        headers: { Authorization: `Bot ${botToken}` },
      });
      return { ...role, status: response.status, ok: response.ok };
    }));
    for (const result of results) {
      if (!result.ok) warnings.push(`${result.label} role update failed (${result.status})`);
    }
    if (warnings.length) {
      console.error("Discord role sync was incomplete", warnings);
      return Response.json({ action: active ? "assigned" : "removed", earlySupporter: isEarlySupporter, warnings }, { headers });
    }
    return Response.json({ action: active ? "assigned" : "removed", earlySupporter: isEarlySupporter }, { headers });
  } catch (error) {
    console.error("Premium Discord role sync failed", error);
    return Response.json({ error: "Premium Discord role sync failed" }, { status: 500, headers });
  }
});
