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
 * The first 25 items come from German client screenshots taken on
 * 16 September 2026. Hero-exclusive UR items were added from screenshots
 * taken on 18 September 2026; those cards use the St. 1 battle skill.
 * German is the game's wording; English and French are translations. Each effect text is written for the skill level stored next
 * to it, because the numbers change with the level. Rarity follows the colour
 * of the item name in the game: red UR, gold SSR, purple SR.
 *
 * Exclusive items are keyed to a roster hero in `EXCLUSIVE_COLLECTION_HEROES`
 * from the hero named on the skill card. The Heroes guide shows that item as
 * the artifact, using these translations instead of duplicating them in
 * `heroTexts`.
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

/**
 * Exclusive UR collection → roster hero id. Taken from the hero named on each
 * 18 September 2026 skill card; not from a separate exclusive flag in JSON.
 */
export const EXCLUSIVE_COLLECTION_HEROES: Readonly<Record<string, string>> = {
  "aeolus-bag-of-winds": "odysseus",
  "golden-throne": "caesar",
  "sin-and-redemption": "billy-the-kid",
  "winged-sandals": "hermes",
  "divine-greaves": "achilles",
  "broken-shackles": "spartacus",
  "eagle-scepter": "pompey",
  "nemean-lion-pelt": "heracles",
  "circes-enchanted-chalice": "circe",
  "pearl-earrings": "cleopatra",
  "mona-lisa": "da-vinci",
  "augustus-coin": "augustus",
  "donkey-mask": "william-shakespeare",
  "tutankhamun-mask": "tutankhamun",
  "bucephalus-golden-bridle": "alexander-the-great",
  "grimoire-of-gravity": "isaac-newton",
  "queens-crown": "queen-victoria",
  "napoleons-bicorne": "napoleon-bonaparte",
};

const EXCLUSIVE_BY_HERO = new Map(
  Object.entries(EXCLUSIVE_COLLECTION_HEROES).map(([itemId, heroId]) => [heroId, itemId]),
);

/** The exclusive collection of a roster hero, if that hero has one. */
export function exclusiveCollectionForHero(
  heroId: string,
  items: readonly CollectionItem[] = COLLECTION_ITEMS,
): CollectionItem | undefined {
  const itemId = EXCLUSIVE_BY_HERO.get(heroId);
  return itemId ? items.find((item) => item.id === itemId) : undefined;
}

/** Name, skill, and effect of a hero's exclusive collection in every catalog. */
export function exclusiveCollectionSearchText(
  heroId: string,
  catalogs: readonly CollectionTexts[],
  items: readonly CollectionItem[] = COLLECTION_ITEMS,
): string {
  const item = exclusiveCollectionForHero(heroId, items);
  if (!item) return "";
  return catalogs
    .flatMap((texts) => {
      const local = localizedItem(item, texts);
      return [local.name, local.skillName, local.skillText];
    })
    .join(" ");
}

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
