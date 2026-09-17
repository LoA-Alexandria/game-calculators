/**
 * Collection items and the battle skill each one brings, edited at
 * `/guides/collection/edit/`.
 *
 * Rows live in `lib/data/collection.json`: id, English name, rarity, the item
 * cut-out and the round skill icon in `public/collection/`, and the skill's
 * English name, level, and effect text. Other languages override the name,
 * skill name, and effect in `guideEntries.collection.collectionTexts`, keyed
 * by id; an empty translation shows the English text.
 *
 * The first 19 items come from German client screenshots taken on
 * 16 September 2026. German is the game's wording; English and French are
 * translations. Each effect text is written for the skill level stored next
 * to it, because the numbers change with the level. Rarity follows the colour
 * of the item name in the game: red UR, gold SSR, purple SR.
 */

import data from "../data/collection.json" with { type: "json" };
import { asset } from "../site.ts";

export const COLLECTION_RARITIES = ["UR", "SSR", "SR", "R"] as const;
export type CollectionRarity = (typeof COLLECTION_RARITIES)[number];

export type CollectionSkill = {
  name: string;
  /** The skill level `text` is written for. */
  level: number;
  text: string;
  /** Round skill icon in `public/collection/`, without the type badge or level number. */
  icon: string;
};

export type CollectionItem = {
  id: string;
  name: string;
  rarity: CollectionRarity;
  /** Cut-out on a transparent background in `public/collection/`. */
  image: string;
  skill: CollectionSkill;
};

export type CollectionData = { items: CollectionItem[] };

export type CollectionTexts = Record<string, { name?: string; skillName?: string; skillText?: string }>;

/** JSON has no string literal types; `tests/collection.test.mjs` checks rarities. */
export const COLLECTION_DATA = data as CollectionData;
export const COLLECTION_ITEMS: CollectionItem[] = COLLECTION_DATA.items;

export function collectionImageUrl(file: string): string {
  return asset(`/collection/${file}`);
}

/** Name, skill name, and effect in the reader's language, falling back to English per field. */
export function localizedItem(item: CollectionItem, texts: CollectionTexts): { name: string; skillName: string; skillText: string } {
  const local = texts[item.id];
  return {
    name: local?.name?.trim() || item.name,
    skillName: local?.skillName?.trim() || item.skill.name,
    skillText: local?.skillText?.trim() || item.skill.text,
  };
}

function fold(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Items of a rarity whose name, skill, or effect contains the query, in the
 * reader's language or in English, ignoring accents.
 */
export function searchCollection(
  query: string,
  rarity: CollectionRarity | "all",
  texts: CollectionTexts,
  items: readonly CollectionItem[] = COLLECTION_ITEMS,
): CollectionItem[] {
  const pool = rarity === "all" ? [...items] : items.filter((item) => item.rarity === rarity);
  const needle = fold(query.trim());
  if (!needle) return pool;
  return pool.filter((item) => {
    const local = localizedItem(item, texts);
    const hay = fold([local.name, local.skillName, local.skillText, item.name, item.skill.name].join(" "));
    return hay.includes(needle);
  });
}

export function itemsByRarity(rarity: CollectionRarity, items: readonly CollectionItem[] = COLLECTION_ITEMS): CollectionItem[] {
  return items.filter((item) => item.rarity === rarity);
}
