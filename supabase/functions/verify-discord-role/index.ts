import { createClient } from "npm:@supabase/supabase-js@2";

const GUILD_ID = "1534685294371274822";

/**
 * Higher wins when a member holds several mapped Discord roles. Without a fixed
 * rule the effective role would depend on the order Discord happens to return
 * them in. Mirrors ROLE_RANK in lib/auth/roles.ts — keep the two in step.
 */
const ROLE_RANK: Record<string, number> = { guide_writer: 1, manager: 2, admin: 3 };

function highestRole(roles: string[]): string | null {
  let best: string | null = null;
  for (const role of roles) {
    if (best === null || (ROLE_RANK[role] ?? 0) > (ROLE_RANK[best] ?? 0)) best = role;
  }
  return best;
}

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

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // The mapping is data now, so an admin can change who gets what without a
  // deploy. Read it with the service role: the caller may not be allowed to.
  const { data: mappings, error: mappingError } = await adminClient
    .from("role_mappings")
    .select("discord_role_id, role");
  if (mappingError) return Response.json({ error: "Could not read the role mapping" }, { status: 500, headers });

  const byDiscordRole = new Map((mappings ?? []).map((row) => [row.discord_role_id as string, row.role as string]));
  const granted = member.roles.flatMap((roleId) => {
    const role = byDiscordRole.get(roleId);
    return role ? [role] : [];
  });
  const role = highestRole(granted);
  const canEdit = role !== null;

  const { error: saveError } = await adminClient.from("editor_access").upsert({
    user_id: user.id,
    discord_user_id: discordUserId,
    role,
    // kept in step until no deployed frontend reads it any more
    can_edit: canEdit,
    checked_at: new Date().toISOString(),
  });
  if (saveError) return Response.json({ error: "Could not save editor access" }, { status: 500, headers });
  return Response.json({ role, canEdit }, { headers });
});
