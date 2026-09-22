/**
 * Alliances between two guilds for one planning event.
 *
 * An officer offers, an officer of the invited guild answers, and an accepted
 * alliance gets its own shared siege board next to each guild's own plan.
 * Everything here is pure; the rows come from `guild_alliances`.
 */

import type { GuildRosterEntry } from "./guilds.ts";
import type { GuildPlanEventId } from "./guild-events.ts";

export const GUILD_ALLIANCE_STATUSES = ["pending", "accepted", "declined"] as const;
export type GuildAllianceStatus = (typeof GUILD_ALLIANCE_STATUSES)[number];

export const GUILD_ALLIANCE_NOTE_MAX = 280;

export type GuildAllianceRow = {
  id: string;
  event_id: GuildPlanEventId;
  from_guild_id: string;
  to_guild_id: string;
  status: GuildAllianceStatus;
  note: string;
  created_at: string;
};

/** A member of either allied guild, with the guild they belong to. */
export type GuildAllianceRosterEntry = GuildRosterEntry & {
  guild_id: string;
  guild_name: string;
};

/** Who asked: our guild offered, or the other one did. */
export type GuildAllianceSide = "outgoing" | "incoming";

export function allianceSide(row: GuildAllianceRow, guildId: string): GuildAllianceSide {
  return row.from_guild_id === guildId ? "outgoing" : "incoming";
}

/** The other guild in the pair, seen from `guildId`. */
export function alliancePartnerId(row: GuildAllianceRow, guildId: string): string {
  return row.from_guild_id === guildId ? row.to_guild_id : row.from_guild_id;
}

/** The accepted alliance for this event, if there is one. */
export function acceptedAlliance(
  rows: readonly GuildAllianceRow[],
  guildId: string,
): GuildAllianceRow | null {
  return (
    rows.find(
      (row) =>
        row.status === "accepted"
        && (row.from_guild_id === guildId || row.to_guild_id === guildId),
    ) ?? null
  );
}

/** Offers still waiting for an answer, newest first. */
export function openOffers(
  rows: readonly GuildAllianceRow[],
  guildId: string,
): GuildAllianceRow[] {
  return rows
    .filter(
      (row) =>
        row.status === "pending"
        && (row.from_guild_id === guildId || row.to_guild_id === guildId),
    )
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Only the invited guild answers an offer, and only while it is pending. */
export function canAnswerAlliance(row: GuildAllianceRow, guildId: string): boolean {
  return row.status === "pending" && row.to_guild_id === guildId;
}

/** Guilds that may still be asked: not us, and not already in a live pair. */
export function offerableGuilds<T extends { id: string }>(
  guilds: readonly T[],
  guildId: string,
  rows: readonly GuildAllianceRow[],
): T[] {
  const taken = new Set(
    rows
      .filter((row) => row.status !== "declined")
      .flatMap((row) => [row.from_guild_id, row.to_guild_id]),
  );
  return guilds.filter((guild) => guild.id !== guildId && !taken.has(guild.id));
}
