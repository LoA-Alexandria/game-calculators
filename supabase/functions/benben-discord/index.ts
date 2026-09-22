import { createClient } from "npm:@supabase/supabase-js@2";

const DISCORD_API = "https://discord.com/api/v10";
const DEFAULT_SITE_URL = "https://loa-alexandria.github.io/game-calculators/benben/";
const ACTIONS = new Set(["feed", "polish", "play", "rest"]);
const ACTION_LABELS: Record<string, string> = {
  feed: "fed Benben some pebbles",
  polish: "polished Benben",
  play: "sunbathed with Benben",
  rest: "helped Benben rest",
};
const encoder = new TextEncoder();

const allowedOrigins = new Set([
  "https://loa-alexandria.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : "https://loa-alexandria.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function hexBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  return new Uint8Array(value.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

async function createLaunchToken(guildId: string, channelId: string): Promise<string> {
  const secret = Deno.env.get("BENBEN_LAUNCH_SECRET");
  if (!secret) throw new Error("BENBEN_LAUNCH_SECRET is not configured");
  const payload = base64Url(encoder.encode(JSON.stringify({ guildId, channelId, exp: Math.floor(Date.now() / 1000) + 21600 })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, ["sign"]), encoder.encode(payload));
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

async function readLaunchToken(token: string): Promise<{ guildId: string; channelId: string } | null> {
  const secret = Deno.env.get("BENBEN_LAUNCH_SECRET");
  const [payload, signature, extra] = token.split(".");
  if (!secret || !payload || !signature || extra) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret, ["verify"]), fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { guildId?: unknown; channelId?: unknown; exp?: unknown };
    if (typeof parsed.guildId !== "string" || !/^\d+$/.test(parsed.guildId) || typeof parsed.channelId !== "string" || !/^\d+$/.test(parsed.channelId)) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { guildId: parsed.guildId, channelId: parsed.channelId };
  } catch {
    return null;
  }
}

async function verifyDiscordRequest(request: Request, rawBody: string): Promise<boolean> {
  const publicKey = Deno.env.get("DISCORD_APPLICATION_PUBLIC_KEY");
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!publicKey || !signature || !timestamp) return false;
  const signedAt = Number(timestamp);
  if (!Number.isFinite(signedAt) || Math.abs(Date.now() / 1000 - signedAt) > 300) return false;
  const publicKeyBytes = hexBytes(publicKey);
  const signatureBytes = hexBytes(signature);
  if (!publicKeyBytes || !signatureBytes) return false;
  try {
    const key = await crypto.subtle.importKey("raw", publicKeyBytes, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, signatureBytes, encoder.encode(timestamp + rawBody));
  } catch {
    return false;
  }
}

function discordMessage(state: Record<string, unknown>, caretaker: string, action: string, siteUrl: string) {
  const fed = Number(state.fed ?? 0);
  const happy = Number(state.happy ?? 0);
  const polished = Number(state.polished ?? 0);
  const rested = Number(state.rested ?? 0);
  const average = Math.round((fed + happy + polished + rested) / 4);
  const mood = average >= 85 ? "Radiant" : average >= 65 ? "Content" : average >= 40 ? "Worried" : "Gloomy";
  return {
    content: `🪨 **${caretaker} ${ACTION_LABELS[action] ?? "cared for Benben"}.**`,
    embeds: [{
      title: `Benben is ${mood}`,
      description: [
        `🍇 Fed **${fed}%**  ·  💛 Happy **${happy}%**`,
        `✨ Polished **${polished}%**  ·  🌙 Rested **${rested}%**`,
        `🔥 **${Number(state.community_streak ?? 0)} day** community streak`,
        ...(state.phoenix_active ? ["🔥🐦 A phoenix is visiting Benben!"] : []),
      ].join("\n"),
      color: 0x42c6d3,
      footer: { text: `${Number(state.total_actions ?? 0)} community care actions` },
    }],
    components: [{ type: 1, components: [{ type: 2, style: 5, label: "Open Benben", emoji: { name: "🪨" }, url: siteUrl }] }],
    allowed_mentions: { parse: [] },
  };
}

async function updateDiscordStatus(
  adminClient: ReturnType<typeof createClient>,
  guildId: string,
  channelId: string,
  state: Record<string, unknown>,
  caretaker: string,
  action: string,
) {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) throw new Error("DISCORD_BOT_TOKEN is not configured");
  const siteUrl = Deno.env.get("BENBEN_SITE_URL") ?? DEFAULT_SITE_URL;
  const launchUrl = new URL(siteUrl);
  launchUrl.searchParams.set("discord_launch", await createLaunchToken(guildId, channelId));
  const body = discordMessage(state, caretaker, action, launchUrl.toString());
  const { data: existing } = await adminClient.from("benben_discord_channels").select("message_id").eq("guild_id", guildId).eq("channel_id", channelId).maybeSingle();
  let response: Response | null = null;
  if (existing?.message_id) {
    response = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${existing.message_id}`, {
      method: "PATCH",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return;
    if (response.status !== 404) throw new Error(`Discord edit failed (${response.status})`);
  }
  response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Discord post failed (${response.status})`);
  const message = await response.json() as { id: string };
  const { error } = await adminClient.from("benben_discord_channels").upsert({ guild_id: guildId, channel_id: channelId, message_id: message.id, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function handleInteraction(request: Request, rawBody: string) {
  if (!await verifyDiscordRequest(request, rawBody)) return new Response("invalid request signature", { status: 401 });
  const interaction = JSON.parse(rawBody) as { type?: number; guild_id?: string; channel_id?: string; data?: { name?: string } };
  if (interaction.type === 1) return Response.json({ type: 1 });
  if (interaction.type !== 2 || interaction.data?.name !== "benben") return Response.json({ type: 4, data: { content: "Unknown command.", flags: 64 } });
  if (!interaction.guild_id || !interaction.channel_id) return Response.json({ type: 4, data: { content: "Benben needs to be opened from a server channel.", flags: 64 } });
  const token = await createLaunchToken(interaction.guild_id, interaction.channel_id);
  const siteUrl = Deno.env.get("BENBEN_SITE_URL") ?? DEFAULT_SITE_URL;
  const url = new URL(siteUrl);
  url.searchParams.set("discord_launch", token);
  return Response.json({
    type: 4,
    data: {
      content: "Visit Benben, choose a care action, and this channel's shared status will be updated.",
      flags: 64,
      components: [{ type: 1, components: [{ type: 2, style: 5, label: "Open Benben", emoji: { name: "🪨" }, url: url.toString() }] }],
    },
  });
}

Deno.serve(async (request) => {
  const signature = request.headers.get("X-Signature-Ed25519");
  if (signature) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const rawBody = await request.text();
    try { return await handleInteraction(request, rawBody); }
    catch (error) { console.error(error); return new Response("Interaction failed", { status: 500 }); }
  }

  const headers = corsHeaders(request.headers.get("Origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ error: "Not signed in" }, { status: 401, headers });

  try {
    const body = await request.json() as { action?: unknown; launchToken?: unknown };
    if (typeof body.action !== "string" || !ACTIONS.has(body.action) || typeof body.launchToken !== "string") {
      return Response.json({ error: "Invalid care request" }, { status: 400, headers });
    }
    const launch = await readLaunchToken(body.launchToken);
    if (!launch) return Response.json({ error: "This Discord launch link has expired. Run /benben again." }, { status: 400, headers });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return Response.json({ error: "Invalid session" }, { status: 401, headers });
    const caretaker = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "A caretaker").slice(0, 80);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const instanceId = `discord:${launch.guildId}:${launch.channelId}`;
    const { data: state, error: careError } = await adminClient.rpc("care_for_benben_instance", {
      p_action: body.action,
      p_instance_id: instanceId,
      p_user_id: user.id,
      p_caretaker: caretaker,
    });
    if (careError) return Response.json({ error: careError.message }, { status: 400, headers });

    let discordUpdated = true;
    try {
      await updateDiscordStatus(adminClient, launch.guildId, launch.channelId, state as Record<string, unknown>, caretaker, body.action);
    } catch (error) {
      discordUpdated = false;
      console.error("Benben care succeeded but Discord status update failed", error);
    }
    return Response.json({ state, discordUpdated }, { headers });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Benben could not be updated" }, { status: 500, headers });
  }
});
