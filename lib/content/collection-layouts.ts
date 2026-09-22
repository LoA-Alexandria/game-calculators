/**
 * Collection layouts: which collection to equip in each of the six age slots,
 * as published setups, plus what every active collection does. Edited at
 * `/guides/collection-layouts/edit/`.
 *
 * Rows live in `lib/data/collection-layouts.json`. A slot and an option name a
 * collection by its id in `lib/data/collection.json`, so the picture and the
 * translated name come from the Collection guide; `name` in this file is the
 * fallback for a collection nobody has added there yet. English setup titles,
 * ledes, and notes are in the JSON; other languages override them in
 * `guideEntries.collectionLayouts.setupTexts` and `optionTexts`, keyed by
 * setup id and by collection id.
 *
 * Setup ids are stable, so Hero layouts can point at a setup later: this guide
 * stays the general one, while a hero build can carry its own collection line.
 *
 * Source: Boah's and Autumn's (Ice, S12) Discord guides, August and September
 * 2026.
 */

import data from "../data/collection-layouts.json" with { type: "json" };
import { COLLECTION_ITEMS, collectionImageUrl, localizedItem, type CollectionItem, type CollectionTexts } from "./collection.ts";

/** One equip slot per age, in the order the game shows them. */
export const COLLECTION_AGES = ["iceAge", "stoneAge", "bronzeAge", "classical", "medieval", "renaissance"] as const;
export type CollectionAge = (typeof COLLECTION_AGES)[number];

/** What a setup is for, and what a collection is good at. */
export const COLLECTION_LAYOUT_TAGS = [
  "allRound",
  "deep",
  "wide",
  "crit",
  "dot",
  "pursuit",
  "seal",
  "antiSeal",
  "antiCrit",
  "heal",
  "shield",
  "situational",
  "mandatory",
  "notInBoss",
  "pvp",
  "pve",
  "tower",
  "guildBoss",
  "invasion",
  "mirage",
] as const;
export type CollectionLayoutTag = (typeof COLLECTION_LAYOUT_TAGS)[number];

export type CollectionSetup = {
  id: string;
  credit: string;
  tags: CollectionLayoutTag[];
  title: string;
  lede: string;
  notes: string[];
  /** Collection id per age slot; an empty string leaves the slot open. */
  slots: Record<CollectionAge, string>;
};

export type CollectionOption = {
  age: CollectionAge;
  /** Collection id, the same id the Collection guide uses. */
  item: string;
  /** English name, shown until the Collection guide has that item. */
  name: string;
  tags: CollectionLayoutTag[];
  note: string;
};

export type CollectionLayoutsData = { setups: CollectionSetup[]; options: CollectionOption[] };

export type SetupText = { title?: string; lede?: string; notes?: string[] };
export type SetupTexts = Record<string, SetupText>;
export type OptionTexts = Record<string, { note?: string }>;

export const COLLECTION_LAYOUTS_DATA = data as CollectionLayoutsData;

const ITEM_BY_ID = new Map(COLLECTION_ITEMS.map((item) => [item.id, item]));

export function collectionItemById(id: string): CollectionItem | undefined {
  return ITEM_BY_ID.get(id);
}

/** Name, picture, and rarity of a slot or option; the picture is null until the Collection guide has it. */
export function layoutItem(
  id: string,
  fallbackName: string,
  texts: CollectionTexts,
): { id: string; name: string; image: string | null; rarity: string | null; known: boolean } {
  const item = collectionItemById(id);
  if (!item) return { id, name: fallbackName, image: null, rarity: null, known: false };
  return {
    id,
    name: localizedItem(item, texts).name,
    image: collectionImageUrl(item.image),
    rarity: item.rarity,
    known: true,
  };
}

/** Setup title, lede, and notes in the reader's language, falling back to English per field. */
export function localizedSetup(setup: CollectionSetup, texts: SetupTexts): { title: string; lede: string; notes: string[] } {
  const local = texts[setup.id];
  const notes = local?.notes?.map((note, index) => note?.trim() || setup.notes[index] || "").filter(Boolean);
  return {
    title: local?.title?.trim() || setup.title,
    lede: local?.lede?.trim() || setup.lede,
    notes: notes?.length ? notes : setup.notes,
  };
}

export function localizedOptionNote(option: CollectionOption, texts: OptionTexts): string {
  return texts[option.item]?.note?.trim() || option.note;
}

export function optionsForAge(age: CollectionAge, options: readonly CollectionOption[] = COLLECTION_LAYOUTS_DATA.options): CollectionOption[] {
  return options.filter((option) => option.age === age);
}

/** The option row for a collection, so a setup slot can show what that pick does. */
export function optionForItem(id: string, options: readonly CollectionOption[] = COLLECTION_LAYOUTS_DATA.options): CollectionOption | undefined {
  return options.find((option) => option.item === id);
}

export function isCollectionAge(value: string): value is CollectionAge {
  return (COLLECTION_AGES as readonly string[]).includes(value);
}

export function isCollectionLayoutTag(value: string): value is CollectionLayoutTag {
  return (COLLECTION_LAYOUT_TAGS as readonly string[]).includes(value);
}
