/**
 * Goddess roster from the Pop Epoch Wiki Goddess page
 * (https://pop-epoch-help.fandom.com/wiki/Goddess), last merged on 18 September
 * 2026. Titles, bios, and missing portraits (Bastet, Isis, Calypso, Lilith)
 * come from that page. Game rarities and obtain lines stay as Autumn recorded
 * them; the wiki cards paint everyone gold, which is not the roster rarity.
 *
 * Rows live in `lib/data/goddesses.json`, edited at `/guides/goddesses/edit/`.
 * Names are the same in every language. Affinity, obtain, title, and bio are
 * English in the JSON; other languages override affinity/obtain in
 * `guideEntries.goddesses.goddessTexts`, and title/bio in
 * `lib/data/goddess-lore-de.json` / `goddess-lore-fr.json`, merged at read time.
 * Rarity follows the wiki card colours for the filter chips (gold SSR, purple
 * SR, blue R) but the values themselves are the game rarities. Portraits are
 * in `public/goddesses/`. The artwork belongs to the game's publisher; the
 * roster credits it.
 *
 * The upgrade order is its own guide (`lib/content/goddess-leveling.ts`).
 *
 * Where each goddess comes from is Autumn's obtain guide, shared on Discord on
 * 9 August 2026. Lilith was added from the wiki without an obtain line, so she
 * is marked unconfirmed.
 */

import roster from "../data/goddesses.json" with { type: "json" };
import loreDe from "../data/goddess-lore-de.json" with { type: "json" };
import loreFr from "../data/goddess-lore-fr.json" with { type: "json" };
import { asset } from "../site.ts";
import type { Locale } from "../i18n";

export const GODDESS_RARITIES = ["SSR", "SR", "R"] as const;
export type GoddessRarity = (typeof GODDESS_RARITIES)[number];

export type Goddess = {
  id: string;
  name: string;
  rarity: GoddessRarity;
  /** English affinity bonus; empty while nobody has written it down. */
  affinity: string;
  /** English note on where she comes from. */
  obtain: string;
  /** File names in `public/goddesses/`; the first is the portrait. */
  images: string[];
  /** Short epithet from the wiki card, e.g. "Primeval Lady". */
  title?: string;
  /** Encyclopedia blurb from the wiki Goddess page. */
  bio?: string;
  /** Wiki sidenote: this skin raises her to SSR. */
  skinRaisesTo?: "SSR";
  /**
   * Her source has been and gone, so a new account cannot reach her. Language
   * independent, which is why it is here and not in the `obtain` text.
   */
  missable?: boolean;
  /** Nobody has confirmed where she comes from; the `obtain` text says what is suspected. */
  unconfirmed?: boolean;
};

export type GoddessData = { goddesses: Goddess[] };

/** Per-language overrides of the English wording, keyed by goddess id. */
export type GoddessTexts = Record<
  string,
  { affinity?: string; obtain?: string; title?: string; bio?: string }
>;

const GODDESS_LORE: Partial<Record<Locale, GoddessTexts>> = {
  de: loreDe as GoddessTexts,
  fr: loreFr as GoddessTexts,
};

/** Title/bio overrides for a language, or an empty catalog for English. */
export function goddessLoreTexts(locale: Locale): GoddessTexts {
  return GODDESS_LORE[locale] ?? {};
}

/**
 * Dictionary affinity/obtain texts plus title/bio from the lore files. Lore
 * wins on title and bio so a skill-only dictionary entry still picks up the story.
 */
export function mergeGoddessTexts(skills: GoddessTexts, lore: GoddessTexts): GoddessTexts {
  const ids = new Set([...Object.keys(skills), ...Object.keys(lore)]);
  const out: GoddessTexts = {};
  for (const id of ids) {
    const skill = skills[id];
    const story = lore[id];
    if (!skill && !story) continue;
    out[id] = {
      ...skill,
      ...(story?.title?.trim() ? { title: story.title.trim() } : {}),
      ...(story?.bio?.trim() ? { bio: story.bio.trim() } : {}),
    };
  }
  return out;
}

/** JSON has no string literal types; `tests/goddesses.test.mjs` checks rarities. */
export const GODDESS_DATA = roster as GoddessData;
export const GODDESSES: Goddess[] = GODDESS_DATA.goddesses;

export function goddessesByRarity(rarity: GoddessRarity | "all"): Goddess[] {
  if (rarity === "all") return GODDESSES;
  return GODDESSES.filter((goddess) => goddess.rarity === rarity);
}

export function searchGoddesses(
  query: string,
  rarity: GoddessRarity | "all",
  extra: (goddess: Goddess) => string,
): Goddess[] {
  const needle = query.trim().toLowerCase();
  const pool = goddessesByRarity(rarity);
  if (!needle) return pool;
  return pool.filter((goddess) => {
    const hay = [goddess.name, goddess.title ?? "", goddess.bio ?? "", extra(goddess)].join(" ").toLowerCase();
    return hay.includes(needle);
  });
}

/** Affinity, obtain, title, and bio in the reader's language, falling back to English per field. */
export function localizedGoddess(
  goddess: Goddess,
  texts: GoddessTexts,
): { affinity: string; obtain: string; title: string; bio: string } {
  const local = texts[goddess.id];
  return {
    affinity: local?.affinity?.trim() || goddess.affinity,
    obtain: local?.obtain?.trim() || goddess.obtain,
    title: local?.title?.trim() || goddess.title || "",
    bio: local?.bio?.trim() || goddess.bio || "",
  };
}

/** URL of a file in `public/goddesses/`, under the GitHub Pages base path. */
export function goddessImageUrl(file: string): string {
  return asset(`/goddesses/${file}`);
}

export function goddessById(id: string): Goddess | undefined {
  return GODDESSES.find((goddess) => goddess.id === id);
}

const BY_NAME = new Map(GODDESSES.map((goddess) => [goddess.name.toLowerCase(), goddess]));

export function goddessNamed(name: string): Goddess | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

/** Portrait URL for a goddess name, or null when the roster has no picture. */
export function goddessPortrait(name: string): string | null {
  const file = goddessNamed(name)?.images[0];
  return file ? goddessImageUrl(file) : null;
}
