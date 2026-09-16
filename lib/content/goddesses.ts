/**
 * Goddess roster from the Pop Epoch Wiki Goddess page
 * (https://pop-epochmobile.fandom.com/wiki/Goddess) as of 14 September 2026.
 *
 * Rows live in `lib/data/goddesses.json`, edited at `/guides/goddesses/edit/`.
 * Names are the same in every language. Affinity and obtain are English in
 * the JSON; other languages override them in
 * `guideEntries.goddesses.goddessTexts`, keyed by id. Rarity follows the wiki
 * card colours: gold SSR, purple SR, blue R. Portraits are in
 * `public/goddesses/`. Bastet's wiki card is a placeholder, so she has no
 * picture. The artwork belongs to the game's publisher; the roster credits it.
 *
 * The upgrade order is its own guide (`lib/content/goddess-leveling.ts`).
 *
 * Where each goddess comes from is Autumn's obtain guide, shared on Discord on
 * 9 August 2026. It also named Isis and Calypso, who are not on the wiki page;
 * they are listed here without a portrait until someone sends one.
 */

import roster from "../data/goddesses.json" with { type: "json" };
import { asset } from "../site.ts";

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

/** Per-language overrides of the English affinity and obtain, keyed by goddess id. */
export type GoddessTexts = Record<string, { affinity?: string; obtain?: string }>;

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
    const hay = [goddess.name, extra(goddess)].join(" ").toLowerCase();
    return hay.includes(needle);
  });
}

/** Affinity and obtain in the reader's language, falling back to English per field. */
export function localizedGoddess(goddess: Goddess, texts: GoddessTexts): { affinity: string; obtain: string } {
  const local = texts[goddess.id];
  return {
    affinity: local?.affinity?.trim() || goddess.affinity,
    obtain: local?.obtain?.trim() || goddess.obtain,
  };
}

export function goddessById(id: string): Goddess | undefined {
  return GODDESSES.find((goddess) => goddess.id === id);
}

export function goddessImageUrl(file: string): string {
  return asset(`/goddesses/${file}`);
}

const BY_NAME = new Map(GODDESSES.map((goddess) => [goddess.name.toLowerCase(), goddess]));

export function goddessNamed(name: string): Goddess | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

export function goddessPortrait(name: string): string | null {
  const file = goddessNamed(name)?.images[0];
  return file ? goddessImageUrl(file) : null;
}
