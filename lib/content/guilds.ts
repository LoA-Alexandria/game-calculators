/**
 * Guild roster and membership helpers. Shared state lives in Supabase; this
 * module is the typed client surface and URL helpers for the static pages.
 *
 * Guild rooms use query `?guild=<slug>` because the site is a static export and
 * cannot pre-render unknown admin-created slugs at build time.
 */

import { asset } from "../site.ts";

export const GUILD_STATUSES = ["pending", "active", "rejected"] as const;
export type GuildMembershipStatus = (typeof GUILD_STATUSES)[number];

export const GUILD_ICON_BUCKET = "guild-icons";
export const GUILD_ICON_MAX_BYTES = 512 * 1024;
export const GUILD_ICON_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type Guild = {
  id: string;
  slug: string;
  name: string;
  description: string;
  server_name: string;
  icon_path: string | null;
  master_discord_user_id: string;
  created_at: string;
};

export type GuildMembership = {
  guild_id: string;
  user_id: string;
  status: GuildMembershipStatus;
  role: "member" | "officer";
  request_note: string;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
};

export const GUILD_REQUEST_NOTE_MAX = 280;
export const GUILD_DISPLAY_NAME_MAX = 40;

/** Trim and clamp an applicant note for insert/update. */
export function normalizeGuildRequestNote(value: string): string {
  return value.trim().slice(0, GUILD_REQUEST_NOTE_MAX);
}

/** Trim and clamp a roster display name. */
export function normalizeGuildDisplayName(value: string): string {
  return value.trim().slice(0, GUILD_DISPLAY_NAME_MAX);
}

/** Prefer the member's chosen name; fall back to a shortened Discord id. */
export function guildRosterLabel(entry: {
  display_name: string;
  discord_user_id: string | null;
}): string {
  const name = entry.display_name?.trim();
  if (name) return name;
  const id = entry.discord_user_id;
  if (!id) return "—";
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export type GuildTab = "news" | "planung";

export type GuildPost = {
  id: string;
  guild_id: string;
  channel: GuildTab;
  title: string;
  body: string;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type GuildRosterEntry = {
  user_id: string | null;
  discord_user_id: string | null;
  display_name: string;
  status: GuildMembershipStatus | "active";
  is_master: boolean;
  is_officer: boolean;
  requested_at: string;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isGuildSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && value.length >= 2 && value.length <= 48;
}

/** Normalize a display name into a slug suggestion for the admin form. */
export function suggestGuildSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function guildListHref(): string {
  return "/guilds/";
}

export function guildRoomHref(slug: string, tab: GuildTab = "news"): string {
  const path = tab === "news" ? "/guilds/room/news/" : "/guilds/room/planung/";
  return `${path}?guild=${encodeURIComponent(slug)}`;
}

export function guildRoomUrl(slug: string, tab: GuildTab = "news"): string {
  return asset(guildRoomHref(slug, tab));
}

export function readGuildSlugParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const slug = value.trim().toLowerCase();
  return isGuildSlug(slug) ? slug : null;
}

const DISCORD_USER_ID_PATTERN = /^[0-9]{5,32}$/;

export function isDiscordUserId(value: string): boolean {
  return DISCORD_USER_ID_PATTERN.test(value.trim());
}

/** True when this Discord snowflake is the guild master (admins are treated separately in UI). */
export function isGuildMasterOf(
  guild: Pick<Guild, "master_discord_user_id">,
  discordUserId: string | null | undefined,
): boolean {
  if (!discordUserId) return false;
  return guild.master_discord_user_id === discordUserId;
}

export function guildIconExtension(mime: string): "png" | "jpg" | "webp" | null {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return null;
}

export function guildIconObjectPath(guildId: string, mime: string): string | null {
  const ext = guildIconExtension(mime);
  if (!ext) return null;
  return `${guildId}/icon.${ext}`;
}

export function isGuildIconFile(file: File): boolean {
  return (
    GUILD_ICON_TYPES.includes(file.type as (typeof GUILD_ICON_TYPES)[number])
    && file.size > 0
    && file.size <= GUILD_ICON_MAX_BYTES
  );
}

/** Public object URL for a stored icon path, or null when unset. */
export function guildIconPublicUrl(
  supabaseUrl: string | undefined,
  iconPath: string | null | undefined,
): string | null {
  if (!supabaseUrl || !iconPath) return null;
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${GUILD_ICON_BUCKET}/${iconPath.split("/").map(encodeURIComponent).join("/")}`;
}

/** Case-insensitive match on server name (and name as fallback). */
export function guildMatchesServerFilter(
  guild: Pick<Guild, "name" | "server_name">,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return (
    guild.server_name.toLocaleLowerCase().includes(needle)
    || guild.name.toLocaleLowerCase().includes(needle)
  );
}
