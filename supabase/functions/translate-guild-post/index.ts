import { createClient } from "npm:@supabase/supabase-js@2";

const LOCALES = ["en", "de", "fr"] as const;
type Locale = (typeof LOCALES)[number];
const MYMEMORY_CHUNK_BYTES = 500;

const allowedOrigins = new Set([
  "https://loa-alexandria.github.io",
  "http://localhost:3000",
]);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : "https://loa-alexandria.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function htmlToPlainText(html: string): string {
  const input = html.trim();
  if (!input) return "";
  if (!/<\/?[a-z][\s\S]*>/i.test(input)) return input;
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainTextToGuildHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function chunkText(text: string, maxBytes = MYMEMORY_CHUNK_BYTES): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const encoder = new TextEncoder();
  if (encoder.encode(trimmed).length <= maxBytes) return [trimmed];

  const chunks: string[] = [];
  let rest = trimmed;
  while (rest.length > 0) {
    if (encoder.encode(rest).length <= maxBytes) {
      chunks.push(rest);
      break;
    }
    let cut = rest.length;
    let low = 1;
    let high = rest.length;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (encoder.encode(rest.slice(0, mid)).length <= maxBytes) {
        cut = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const window = rest.slice(0, cut);
    const breakAt = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const end = breakAt > cut * 0.4 ? breakAt : cut;
    const piece = rest.slice(0, end).trimEnd();
    if (piece) chunks.push(piece);
    rest = rest.slice(end).trimStart();
  }
  return chunks;
}

async function translateText(text: string, from: Locale, to: Locale, email: string | undefined): Promise<string> {
  if (!text.trim() || from === to) return text;
  const parts = chunkText(text);
  const out: string[] = [];
  for (const part of parts) {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", part);
    url.searchParams.set("langpair", `${from}|${to}`);
    if (email) url.searchParams.set("de", email);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
    const payload = await response.json() as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
      quotaFinished?: boolean;
    };
    if (payload.quotaFinished) throw new Error("Translation quota exhausted for today");
    if (payload.responseStatus !== 200 || typeof payload.responseData?.translatedText !== "string") {
      throw new Error("Translation failed");
    }
    const translated = payload.responseData.translatedText;
    if (/^\s*MYMEMORY WARNING/i.test(translated)) {
      throw new Error("Translation quota exhausted for today");
    }
    out.push(translated);
  }
  return out.join("\n\n");
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("Origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });

  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ error: "Not signed in" }, { status: 401, headers });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return Response.json({ error: "Invalid session" }, { status: 401, headers });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  const guildId = (body as { guildId?: unknown })?.guildId;
  const sourceLocale = (body as { sourceLocale?: unknown })?.sourceLocale;
  const title = (body as { title?: unknown })?.title;
  const htmlBody = (body as { body?: unknown })?.body;

  if (typeof guildId !== "string" || !guildId) {
    return Response.json({ error: "Missing guild" }, { status: 400, headers });
  }
  if (!isLocale(sourceLocale)) {
    return Response.json({ error: "Invalid source language" }, { status: 400, headers });
  }
  if (typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400, headers });
  }
  if (typeof htmlBody !== "string") {
    return Response.json({ error: "Body is required" }, { status: 400, headers });
  }

  const { data: officer, error: officerError } = await userClient.rpc("is_guild_officer", {
    p_guild_id: guildId,
  });
  if (officerError) return Response.json({ error: "Could not check guild role" }, { status: 500, headers });
  if (!officer) return Response.json({ error: "Only officers can translate guild news" }, { status: 403, headers });

  const plainTitle = title.trim().slice(0, 120);
  const plainBody = htmlToPlainText(htmlBody).slice(0, 8000);
  const email = Deno.env.get("MYMEMORY_EMAIL")?.trim() || undefined;

  const titleI18n: Record<Locale, string> = { en: "", de: "", fr: "" };
  const bodyI18n: Record<Locale, string> = { en: "", de: "", fr: "" };
  titleI18n[sourceLocale] = plainTitle;
  bodyI18n[sourceLocale] = htmlBody.trim() || plainTextToGuildHtml(plainBody);

  try {
    for (const target of LOCALES) {
      if (target === sourceLocale) continue;
      titleI18n[target] = (await translateText(plainTitle, sourceLocale, target, email)).slice(0, 120);
      const translatedBody = await translateText(plainBody, sourceLocale, target, email);
      bodyI18n[target] = plainTextToGuildHtml(translatedBody.slice(0, 8000));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed";
    return Response.json({ error: message }, { status: 503, headers });
  }

  return Response.json({ title_i18n: titleI18n, body_i18n: bodyI18n }, { headers });
});
