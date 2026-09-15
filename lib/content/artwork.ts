/**
 * Painting sets from Autumn (Ice, S12) on Discord, 4 September 2026.
 * Short Discord names are expanded to the Heroes roster spelling where the
 * match is unambiguous. Incomplete lines are stored as printed: missing heroes
 * and stats are omitted, not invented.
 *
 * Rows live in `lib/data/paintings.json`. The catalogue editor exports a
 * replacement for that file.
 */

import catalogue from "../data/paintings.json" with { type: "json" };

export const PAINTING_RARITIES = ["SSR", "SR", "R"] as const;
export type PaintingRarity = (typeof PAINTING_RARITIES)[number];

export const PAINTING_STATS = ["heroAtk", "heroHp", "allAtk", "allHp", "fs", "res"] as const;
export type PaintingStat = (typeof PAINTING_STATS)[number];

export type Painting = {
  id: string;
  name: string;
  heroes: string[];
  stats: readonly PaintingStat[];
  starStats?: readonly PaintingStat[];
  productivity: string;
};

export type PaintingSet = {
  id: string;
  name: string;
  rarity: PaintingRarity;
  effect: string;
  paintings: Painting[];
};

type RawPainting = {
  id: string;
  name: string;
  heroes: string[];
  stats: string[];
  starStats?: string[];
  productivity?: string;
};

type RawSet = {
  id: string;
  name: string;
  rarity: PaintingRarity;
  effect: string;
  paintings: RawPainting[];
};

function asPainting(canvas: RawPainting): Painting {
  return {
    id: canvas.id,
    name: canvas.name,
    heroes: canvas.heroes,
    stats: canvas.stats as PaintingStat[],
    productivity: canvas.productivity ?? "",
    ...(canvas.starStats?.length ? { starStats: canvas.starStats as PaintingStat[] } : {}),
  };
}

export const PAINTING_SETS: PaintingSet[] = (catalogue.sets as RawSet[]).map((set) => ({
  ...set,
  paintings: set.paintings.map(asPainting),
}));

/** A set's wording in another language; a missing or blank part keeps the English text. */
export type PaintingSetText = { name?: string; effect?: string };
export type PaintingText = { name?: string; productivity?: string };

/**
 * The catalogue's wording in one language, keyed by set id and painting id.
 * `lib/data/paintings.json` holds English; `guideEntries.artwork.catalogTexts`
 * in each dictionary holds the translations. A language added later starts
 * with `{}` and shows English.
 */
export type PaintingTexts = {
  sets?: Record<string, PaintingSetText>;
  paintings?: Record<string, PaintingText>;
};

export function localizedPainting(canvas: Painting, texts: PaintingTexts): Painting {
  const local = texts.paintings?.[canvas.id];
  if (!local) return canvas;
  return {
    ...canvas,
    name: local.name?.trim() || canvas.name,
    productivity: local.productivity?.trim() || canvas.productivity,
  };
}

/** The set, and its paintings, with every filled-in translation applied. */
export function localizedSet(set: PaintingSet, texts: PaintingTexts): PaintingSet {
  const local = texts.sets?.[set.id];
  return {
    ...set,
    name: local?.name?.trim() || set.name,
    effect: local?.effect?.trim() || set.effect,
    paintings: set.paintings.map((canvas) => localizedPainting(canvas, texts)),
  };
}

/** Short Discord forms that should still match a roster name in the hero filter. */
const HERO_ALIASES: Record<string, string[]> = {
  "Alexander the Great": ["alexander"],
  "Alfred the Great": ["alfred"],
  "Anne Bonny": ["anne bonnie", "annie bonnie"],
  "Catherine de'Medici": ["catherine de medici"],
  "Charles Darwin": ["darwin"],
  "Charles the Great": ["charles"],
  "Eleanor of Aquitaine": ["eleanor"],
  "Elizabeth I": ["elizabeth"],
  "Galileo Galilei": ["galileo"],
  "Gawain": ["garwain"],
  "Hatshepsut": ["hatsheput"],
  "Isaac Newton": ["newton"],
  "Isabella I": ["isabella"],
  "Joan of Arc": ["joan"],
  "Livia Drusilla": ["livia"],
  "Napoleon Bonaparte": ["napoleon"],
  "Nikola Tesla": ["tesla"],
  "Richard I": ["richard"],
  "Thomas Edison": ["edison"],
  "Tutankhamun": ["tut"],
  "Victor Hugo": ["victor huge"],
  "William Shakespeare": ["shakespeare"],
};

function heroHaystack(name: string): string {
  return [name, ...(HERO_ALIASES[name] ?? [])].join(" ").toLowerCase();
}

export function setsByRarity(rarity: PaintingRarity): PaintingSet[] {
  return PAINTING_SETS.filter((entry) => entry.rarity === rarity);
}

export function paintingSetById(id: string): PaintingSet | undefined {
  return PAINTING_SETS.find((entry) => entry.id === id);
}

export type PaintingHit = {
  set: PaintingSet;
  painting: Painting;
};

export function searchPaintings(query: string): PaintingHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: PaintingHit[] = [];
  for (const entry of PAINTING_SETS) {
    for (const canvas of entry.paintings) {
      const hay = [
        canvas.name,
        entry.name,
        canvas.productivity,
        ...canvas.heroes.map(heroHaystack),
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(needle)) hits.push({ set: entry, painting: canvas });
    }
  }
  return hits;
}

export function paintingsForHero(query: string): PaintingHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: PaintingHit[] = [];
  for (const entry of PAINTING_SETS) {
    for (const canvas of entry.paintings) {
      if (canvas.heroes.some((hero) => heroHaystack(hero).includes(needle))) {
        hits.push({ set: entry, painting: canvas });
      }
    }
  }
  return hits;
}
