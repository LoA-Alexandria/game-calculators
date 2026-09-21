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

export type Guild = {
  id: string;
  slug: string;
  name: string;
  description: string;
  master_discord_user_id: string;
  created_at: string;
};

export type GuildMembership = {
  guild_id: string;
  user_id: string;
  status: GuildMembershipStatus;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
};

export type GuildTab = "news" | "planung";

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
