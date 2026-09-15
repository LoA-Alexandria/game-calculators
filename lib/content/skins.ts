/**
 * Named skins for the Heroes and Goddesses rosters, from Autumn's skin guide
 * shared on Discord on 7 August 2026.
 *
 * A skin is not the extra picture on a roster card. Those files have no names,
 * so they cannot be matched to this list; the portrait switcher and this list
 * sit next to each other. Rows live in `lib/data/hero-skins.json` and
 * `lib/data/goddess-skins.json`. English names and obtain lines are in those
 * files; `skinTexts` in each dictionary can translate them. Missable and
 * unconfirmed are flags, not wording, so they stay in the JSON.
 *
 * Avatar skins, mount skins, and frames from the same guide are not here:
 * they are not heroes or goddesses.
 */

import heroRoster from "../data/hero-skins.json" with { type: "json" };
import goddessRoster from "../data/goddess-skins.json" with { type: "json" };

export const HERO_SKIN_GROUPS = [
  "epochPass",
  "ringToss",
  "roadToTheCup",
  "genie",
  "holyGrail",
  "nile",
  "odin",
  "atlantis",
  "unknown",
] as const;

export const GODDESS_SKIN_GROUPS = [
  "consecutiveTopUp",
  "firstTopUp",
  "roadToTheCup",
  "unknown",
] as const;

export type HeroSkinGroup = (typeof HERO_SKIN_GROUPS)[number];
export type GoddessSkinGroup = (typeof GODDESS_SKIN_GROUPS)[number];

export type SkinRecord = {
  id: string;
  /** Heroes or Goddesses roster spelling. */
  owner: string;
  name: string;
  group: string;
  obtain: string;
  missable?: boolean;
  unconfirmed?: boolean;
};

export type SkinTexts = Record<string, { name?: string; obtain?: string }>;

export type SkinData = { skins: SkinRecord[] };

export const HERO_SKINS: SkinRecord[] = (heroRoster as SkinData).skins;
export const GODDESS_SKINS: SkinRecord[] = (goddessRoster as SkinData).skins;

const HERO_GROUP_SET = new Set<string>(HERO_SKIN_GROUPS);
const GODDESS_GROUP_SET = new Set<string>(GODDESS_SKIN_GROUPS);

export function isHeroSkinGroup(value: string): value is HeroSkinGroup {
  return HERO_GROUP_SET.has(value);
}

export function isGoddessSkinGroup(value: string): value is GoddessSkinGroup {
  return GODDESS_GROUP_SET.has(value);
}

/** The English skin with every filled-in translation applied. */
export function localizedSkin(skin: SkinRecord, texts: SkinTexts): SkinRecord {
  const local = texts[skin.id];
  if (!local) return skin;
  return {
    ...skin,
    name: local.name?.trim() || skin.name,
    obtain: local.obtain?.trim() || skin.obtain,
  };
}

export function skinsFor(skins: readonly SkinRecord[], owner: string): SkinRecord[] {
  const name = owner.trim().toLowerCase();
  return skins.filter((skin) => skin.owner.toLowerCase() === name);
}

export function skinsInGroup(skins: readonly SkinRecord[], group: string): SkinRecord[] {
  return skins.filter((skin) => skin.group === group);
}

/**
 * Names and obtain lines a search can match, including translations. A blank
 * catalog contributes nothing, so English is always in the haystack via `skins`.
 */
export function skinSearchText(
  owner: string,
  skins: readonly SkinRecord[],
  catalogs: readonly SkinTexts[] = [],
): string {
  const own = skinsFor(skins, owner);
  const translated = catalogs.flatMap((texts) =>
    own.flatMap((skin) => {
      const local = texts[skin.id];
      return local ? [local.name ?? "", local.obtain ?? ""] : [];
    }),
  );
  return [...own.flatMap((skin) => [skin.name, skin.obtain]), ...translated].join(" ");
}
