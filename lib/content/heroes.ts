/**
 * Hero roster from the community wiki rarity pages (UR+ / UR / SSR / SR / R
 * "Hereos" slugs) as of 13 September 2026, merged with the Pop Epoch Wiki Hero
 * page (title, troop, age, bio, and missing portraits) on 18 September 2026.
 * Skill, buff, and production tables for 37 heroes come from German client
 * screenshots on 18 September 2026; English is a translation of that German
 * text. Joan of Arc had no skill tables in that dump, so her abilities stay
 * empty. Five wiki heroes (Billy the Kid, Guan Yu, Miyamoto Musashi, Yi
 * Sun-sin, Lü Bu) were added from the Hero page without skill tables.
 *
 * Production mid-levels that were not photographed are interpolated as noted
 * in the source files: UR/UR+ +4% per level, SSR 30% + 3% × (n−1). Do not
 * treat those interpolated rows as photographed values.
 *
 * Rows live in `lib/data/heroes.json`; the roster editor exports a replacement
 * for that file. A missing `skill`, `buff`, or `production` means nobody has
 * added the text yet. Do not invent it. The "Lv. N" skill cards became the
 * levels of one ability. The fragment table is copied as printed on every
 * rarity page (identical). The wording in the JSON is English;
 * `guideEntries.heroes.heroTexts` can override the obtain note, title, bio,
 * ability names, level texts, and artifact per language. Title and bio
 * translations also live in `lib/data/hero-lore-de.json` and
 * `hero-lore-fr.json`, merged at read time so skill catalogs stay separate.
 *
 * Portraits are in `public/heroes/`, saved from the wiki pages on 14 and 18
 * September 2026. The first file in `images` is the portrait, any others are
 * skins. The artwork belongs to the game's publisher; the roster credits it,
 * and removing the folder plus the `images` lists takes it out again.
 */

import roster from "../data/heroes.json" with { type: "json" };
import loreDe from "../data/hero-lore-de.json" with { type: "json" };
import loreFr from "../data/hero-lore-fr.json" with { type: "json" };
import { ROSTER_SPELLING } from "./hero-names.ts";
import { asset } from "../site.ts";
import type { Locale } from "../i18n";

export const HERO_RARITIES = ["UR+", "UR", "SSR", "SR", "R"] as const;
export type HeroRarity = (typeof HERO_RARITIES)[number];

export const HERO_TROOPS = ["Pikeman", "Archer", "Shieldman", "Cavalry"] as const;
export type HeroTroop = (typeof HERO_TROOPS)[number];

export const HERO_AGES = [
  "Ice Age",
  "Stone Age",
  "Bronze Age",
  "Classical Age",
  "Medieval Age",
  "Renaissance Age",
  "Exploration Age",
  "Enlightenment Age",
  "Steam Age",
] as const;
export type HeroAge = (typeof HERO_AGES)[number];

/** An artifact: one effect, no levels. */
export type HeroSkill = {
  name: string;
  text: string;
};

/**
 * Every hero has three abilities: a battle skill, a buff, and a production
 * bonus. `levels[0]` is the text at Lv. 1; an empty string marks a level whose
 * text is not known yet.
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
  /** Short epithet from the wiki card, e.g. "Lever Master". */
  title?: string;
  troop?: HeroTroop;
  age?: HeroAge;
  /** Encyclopedia blurb from the wiki Hero page. */
  bio?: string;
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
 * Translated hero text, keyed by hero id. Names, rarities, troops, ages, and
 * portraits are the same in every language and stay in `lib/data/heroes.json`;
 * the wording the game shows lives here so it can be translated.
 */
export type HeroTexts = Record<
  string,
  {
    obtain?: string;
    title?: string;
    bio?: string;
    skill?: HeroAbilityText;
    buff?: HeroAbilityText;
    production?: HeroAbilityText;
    artifact?: { name?: string; text?: string };
  }
>;

const HERO_LORE: Partial<Record<Locale, HeroTexts>> = {
  de: loreDe as HeroTexts,
  fr: loreFr as HeroTexts,
};

/** Title/bio overrides for a language, or an empty catalog for English. */
export function heroLoreTexts(locale: Locale): HeroTexts {
  return HERO_LORE[locale] ?? {};
}

/**
 * Dictionary skill/obtain texts plus title/bio from the lore files. Lore wins
 * on title and bio so a skill-only dictionary entry still picks up the story.
 */
export function mergeHeroTexts(skills: HeroTexts, lore: HeroTexts): HeroTexts {
  const ids = new Set([...Object.keys(skills), ...Object.keys(lore)]);
  const out: HeroTexts = {};
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
  if (local.title?.trim()) next.title = local.title.trim();
  if (local.bio?.trim()) next.bio = local.bio.trim();
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
  return [
    hero.obtain,
    hero.title ?? "",
    hero.troop ?? "",
    hero.age ?? "",
    hero.bio ?? "",
    ...abilities,
    hero.artifact?.name ?? "",
    hero.artifact?.text ?? "",
  ];
}

/** `catalogs` lets a search also match the wording a reader sees in their language. */
export function searchHeroes(
  query: string,
  rarity: HeroRarity | "all",
  catalogs: readonly HeroTexts[] = [],
  extra: (hero: Hero) => string = () => "",
): Hero[] {
  const needle = query.trim().toLowerCase();
  const pool = heroesByRarity(rarity);
  if (!needle) return pool;
  return pool.filter((hero) => {
    const translated = catalogs.flatMap((texts) => (texts[hero.id] ? textOf(localizedHero(hero, texts)) : []));
    const hay = [hero.name, ...textOf(hero), ...translated, extra(hero)].join(" ").toLowerCase();
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
