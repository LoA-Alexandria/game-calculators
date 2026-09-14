/**
 * Hero roster from the community wiki rarity pages (UR+ / UR / SSR / SR / R
 * "Hereos" slugs) as of 13 September 2026, plus in-game skill text for Merlin,
 * Morgana, Cleopatra, Heracles, Lagertha, Circe, and Bjorn Ironside from
 * screenshots the same day.
 *
 * Rows live in `lib/data/heroes.json`; the roster editor exports a replacement
 * for that file. Empty `skills` means the wiki card had no ability text yet. Do
 * not invent it. The fragment table is copied as printed on every rarity page
 * (identical).
 *
 * Portraits are in `public/heroes/`, saved from the same wiki pages on 14
 * September 2026 (Cleopatra had none). The first file in `images` is the
 * portrait, any others are skins. The artwork belongs to the game's publisher;
 * the roster credits it, and removing the folder plus the `images` lists takes
 * it out again.
 */

import roster from "../data/heroes.json" with { type: "json" };
import { ROSTER_SPELLING } from "./hero-names.ts";
import { asset } from "../site.ts";

export const HERO_RARITIES = ["UR+", "UR", "SSR", "SR", "R"] as const;
export type HeroRarity = (typeof HERO_RARITIES)[number];

export type HeroSkill = {
  name: string;
  text: string;
};

export type Hero = {
  id: string;
  name: string;
  rarity: HeroRarity;
  obtain: string;
  /** File names in `public/heroes/`; the first is the portrait. */
  images: string[];
  skills: HeroSkill[];
  artifact?: HeroSkill;
};

export type HeroData = { heroes: Hero[] };

export const HERO_FRAGMENT_KEYS = [
  "green",
  "blue",
  "purple",
  "gold",
  "red",
  "goldShiny",
  "blueShiny",
  "shiny",
] as const;

export type HeroFragmentKey = (typeof HERO_FRAGMENT_KEYS)[number];

export const HERO_STAR_COSTS: { star: number; costs: number[] }[] = [
  { star: 1, costs: [25, 50, 100, 100, 200, 300, 400, 500] },
  { star: 2, costs: [25, 50, 100, 200, 200, 300, 400, 500] },
  { star: 3, costs: [25, 100, 100, 200, 300, 300, 400, 500] },
  { star: 4, costs: [25, 100, 100, 200, 300, 400, 400, 500] },
  { star: 5, costs: [50, 100, 100, 200, 300, 400, 500, 600] },
];

/** JSON has no string literal types; `tests/heroes.test.mjs` checks the rarities. */
export const HERO_DATA = roster as HeroData;
export const HEROES: Hero[] = HERO_DATA.heroes;

export function heroesByRarity(rarity: HeroRarity | "all"): Hero[] {
  if (rarity === "all") return HEROES;
  return HEROES.filter((hero) => hero.rarity === rarity);
}

export function searchHeroes(query: string, rarity: HeroRarity | "all"): Hero[] {
  const needle = query.trim().toLowerCase();
  const pool = heroesByRarity(rarity);
  if (!needle) return pool;
  return pool.filter((hero) => {
    const hay = [hero.name, hero.obtain, ...hero.skills.map((skill) => `${skill.name} ${skill.text}`), hero.artifact?.name ?? "", hero.artifact?.text ?? ""]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}

/** URL of a file in `public/heroes/`, under the GitHub Pages base path. */
export function heroImageUrl(file: string): string {
  return asset(`/heroes/${file}`);
}

const BY_NAME = new Map(HEROES.map((hero) => [hero.name.toLowerCase(), hero]));

/**
 * The roster hero for a name as any guide writes it: the roster spelling, or
 * the tier list and layouts spelling from `ROSTER_SPELLING`.
 */
export function heroNamed(name: string): Hero | undefined {
  const trimmed = name.trim();
  return BY_NAME.get((ROSTER_SPELLING[trimmed] ?? trimmed).toLowerCase());
}

/** Portrait URL for a hero name, or null when the roster has no picture. */
export function heroPortrait(name: string): string | null {
  const file = heroNamed(name)?.images[0];
  return file ? heroImageUrl(file) : null;
}
