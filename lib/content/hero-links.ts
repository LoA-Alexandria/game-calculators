/**
 * Where a roster hero shows up in the other guides: its overall tier, the Hero
 * layouts builds and utility roles, and the Core Artwork paintings. The Heroes
 * roster uses this for the hero details, and the roster editor warns before a
 * hero that another guide still names is renamed or removed.
 *
 * The tier list and layouts follow Autumn's spelling, so names pass through
 * `ROSTER_SPELLING` first.
 */

import { PAINTING_SETS } from "./artwork.ts";
import { ROSTER_SPELLING } from "./hero-names.ts";
import { BUILD_ZONES, COLLECTION_ITEMS, LAYOUT_DATA, type BuildZone } from "./hero-layouts.ts";
import { TIER_DATA, type TierId, type VariantKey } from "./hero-tiers.ts";

export type HeroReference = "tierList" | "layouts" | "artwork";

export type HeroAppearances = {
  tiers: { tier: TierId; variant?: VariantKey }[];
  builds: { build: string; zone: BuildZone | "counter" }[];
  roles: string[];
  /** English names; `setId` and `paintingId` look up translations in `catalogTexts`. */
  paintings: { setId: string; paintingId: string; set: string; painting: string }[];
};

/** The roster spelling for a name used by the tier list, layouts, or artwork. */
export function rosterName(name: string): string {
  return ROSTER_SPELLING[name] ?? name;
}

let cache: Map<string, HeroAppearances> | null = null;

function index(): Map<string, HeroAppearances> {
  if (cache) return cache;
  const map = new Map<string, HeroAppearances>();
  const entry = (name: string) => {
    const key = rosterName(name);
    let found = map.get(key);
    if (!found) {
      found = { tiers: [], builds: [], roles: [], paintings: [] };
      map.set(key, found);
    }
    return found;
  };

  for (const row of TIER_DATA.overall) {
    for (const hero of row.entries) entry(hero.hero).tiers.push({ tier: row.tier, ...(hero.variant ? { variant: hero.variant } : {}) });
  }

  for (const build of LAYOUT_DATA.builds) {
    const add = (name: string, zone: BuildZone | "counter") => {
      if (COLLECTION_ITEMS.has(name)) return;
      const builds = entry(name).builds;
      if (!builds.some((placed) => placed.build === build.id)) builds.push({ build: build.id, zone });
    };
    for (const zone of BUILD_ZONES) for (const pick of build[zone]) add(pick.hero, zone);
    for (const counter of build.counters) for (const pick of counter.picks) add(pick.hero, "counter");
  }
  for (const role of LAYOUT_DATA.utility) {
    for (const group of role.groups) {
      for (const pick of group.picks) {
        const roles = entry(pick.hero).roles;
        if (!roles.includes(role.id)) roles.push(role.id);
      }
    }
  }

  for (const set of PAINTING_SETS) {
    for (const painting of set.paintings) {
      for (const hero of painting.heroes) {
        entry(hero).paintings.push({ setId: set.id, paintingId: painting.id, set: set.name, painting: painting.name });
      }
    }
  }

  cache = map;
  return map;
}

const NONE: HeroAppearances = { tiers: [], builds: [], roles: [], paintings: [] };

export function heroAppearances(name: string): HeroAppearances {
  return index().get(rosterName(name)) ?? NONE;
}

/** Roster name → the guides that name the hero. */
export function heroReferences(): Map<string, Set<HeroReference>> {
  const references = new Map<string, Set<HeroReference>>();
  for (const [name, found] of index()) {
    const where = new Set<HeroReference>();
    if (found.tiers.length) where.add("tierList");
    if (found.builds.length || found.roles.length) where.add("layouts");
    if (found.paintings.length) where.add("artwork");
    if (where.size) references.set(name, where);
  }
  return references;
}
