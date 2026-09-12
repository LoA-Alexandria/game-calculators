import { createClient } from "npm:@supabase/supabase-js@2";

const GUILD_ID = "1534685294371274822";
const EDITOR_ROLE_IDS = new Set([
  "1534890988588498944", // Coders
  "1534693394692178161", // Builders
]);

const allowedOrigins = new Set([
  "https://loa-alexandria.github.io",
  "http://localhost:3000",
]);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : "https://loa-alexandria.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return Response.json({ error: "Invalid session" }, { status: 401, headers });

  const { providerToken } = await request.json();
  if (typeof providerToken !== "string" || !providerToken) return Response.json({ error: "Discord authorization needs refreshing" }, { status: 400, headers });

  const discordResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${GUILD_ID}/member`, {
    headers: { Authorization: `Bearer ${providerToken}` },
  });
  if (!discordResponse.ok) return Response.json({ error: "Could not verify Discord membership" }, { status: 403, headers });

  const member = await discordResponse.json() as { roles: string[]; user?: { id: string } };
  const discordUserId = member.user?.id;
  const identityIds = new Set([
    user.user_metadata?.provider_id,
    user.user_metadata?.sub,
    ...(user.identities ?? []).flatMap((identity) => [identity.identity_data?.provider_id, identity.identity_data?.sub]),
  ].filter((value): value is string => typeof value === "string"));
  if (!discordUserId || !identityIds.has(discordUserId)) return Response.json({ error: "Discord identity mismatch" }, { status: 403, headers });

  const canEdit = member.roles.some((roleId) => EDITOR_ROLE_IDS.has(roleId));
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: saveError } = await adminClient.from("editor_access").upsert({
    user_id: user.id,
    discord_user_id: discordUserId,
    can_edit: canEdit,
    checked_at: new Date().toISOString(),
  });
  if (saveError) return Response.json({ error: "Could not save editor access" }, { status: 500, headers });
  return Response.json({ canEdit }, { headers });
});
