/**
 * Hero roster from the community wiki rarity pages (UR+ / UR / SSR / SR / R
 * "Hereos" slugs) as of 13 September 2026, plus in-game skill text for Merlin,
 * Morgana, Cleopatra, Heracles, Lagertha, Circe, and Bjorn Ironside from
 * screenshots the same day.
 *
 * Rows live in `lib/data/heroes.json`; the roster editor exports a replacement
 * for that file. A missing `skill`, `buff`, or `production` means the wiki card
 * had no text for it yet. Do not invent it. The "Lv. N" skill cards became the
 * levels of one ability. The fragment table is copied as printed on every
 * rarity page (identical). The wording in this file is the English wiki text;
 * `guideEntries.heroes.heroTexts` can override the obtain note, ability names,
 * level texts, and artifact per language.
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

/** An artifact: one effect, no levels. */
export type HeroSkill = {
  name: string;
  text: string;
};

/**
 * Every hero has three abilities: a battle skill, a buff, and a production
 * bonus. `levels[0]` is the text at Lv. 1; an empty string marks a level whose
 * text is not known yet (Cleopatra's Lv. 1).
 */
export const HERO_ABILITY_KINDS = ["skill", "buff", "production"] as const;
export type HeroAbilityKind = (typeof HERO_ABILITY_KINDS)[number];
export type HeroAbility = { name: string; levels: string[] };

export type Hero = {
  id: string;
  name: string;
  rarity: HeroRarity;
  obtain: string;
  /** File names in `public/heroes/`; the first is the portrait. */
  images: string[];
  skill?: HeroAbility;
  buff?: HeroAbility;
  production?: HeroAbility;
  artifact?: HeroSkill;
};

/** How many of the three abilities have been filled in. */
export function abilityCount(hero: Hero): number {
  return HERO_ABILITY_KINDS.filter((kind) => hero[kind]).length;
}

export type HeroData = { heroes: Hero[] };

/** Optional translated ability text; a missing or blank entry keeps the English one. */
export type HeroAbilityText = { name?: string; levels?: string[] };

/**
 * Translated hero text, keyed by hero id. Names, rarities, and portraits are
 * the same in every language and stay in `lib/data/heroes.json`; the wording
 * the game shows lives here so it can be translated.
 */
export type HeroTexts = Record<
  string,
  {
    obtain?: string;
    skill?: HeroAbilityText;
    buff?: HeroAbilityText;
    production?: HeroAbilityText;
    artifact?: { name?: string; text?: string };
  }
>;

function localizedAbility(ability: HeroAbility, text: HeroAbilityText | undefined): HeroAbility {
  if (!text) return ability;
  return {
    name: text.name?.trim() || ability.name,
    // A level nobody has translated yet keeps the English text rather than going blank.
    levels: ability.levels.map((level, index) => text.levels?.[index]?.trim() || level),
  };
}

/** The hero with every filled-in translation applied. */
export function localizedHero(hero: Hero, texts: HeroTexts): Hero {
  const local = texts[hero.id];
  if (!local) return hero;
  const next: Hero = { ...hero };
  if (local.obtain?.trim()) next.obtain = local.obtain.trim();
  for (const kind of HERO_ABILITY_KINDS) {
    const ability = hero[kind];
    if (ability) next[kind] = localizedAbility(ability, local[kind]);
  }
  if (hero.artifact) {
    next.artifact = {
      name: local.artifact?.name?.trim() || hero.artifact.name,
      text: local.artifact?.text?.trim() || hero.artifact.text,
    };
  }
  return next;
}

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

/** Every searchable string of one translation of a hero. */
function textOf(hero: Hero): string[] {
  const abilities = HERO_ABILITY_KINDS.flatMap((kind) => [hero[kind]?.name ?? "", ...(hero[kind]?.levels ?? [])]);
  return [hero.obtain, ...abilities, hero.artifact?.name ?? "", hero.artifact?.text ?? ""];
}

/** `catalogs` lets a search also match the wording a reader sees in their language. */
export function searchHeroes(query: string, rarity: HeroRarity | "all", catalogs: readonly HeroTexts[] = []): Hero[] {
  const needle = query.trim().toLowerCase();
  const pool = heroesByRarity(rarity);
  if (!needle) return pool;
  return pool.filter((hero) => {
    const translated = catalogs.flatMap((texts) => (texts[hero.id] ? textOf(localizedHero(hero, texts)) : []));
    const hay = [hero.name, ...textOf(hero), ...translated].join(" ").toLowerCase();
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
