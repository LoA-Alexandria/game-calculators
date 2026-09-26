import { HEROES, heroNamed, type Hero } from "../content/heroes.ts";
import { LAYOUT_DATA, type LayoutPick } from "../content/hero-layouts.ts";
import { COLLECTION_ITEMS, exclusiveCollectionForHero } from "../content/collection.ts";

/** Planning metadata only: no invented star unlocks or stat scaling. */
export type OwnedHero = { id: string; level?: number; stars?: number; productionLevel?: number };
export type TeamInput = {
  heroes: OwnedHero[];
  items: string[];
  collection: string[];
  size: number;
  mode: "combat" | "production";
  building: string;
};
export type Member = { id: string; points: number; zone?: string; roles: string[]; conditions: string[]; production?: number; requiredStars?: number };
export type TeamResult = { id: string; members: Member[]; score: number; collection: string[]; missing: string[]; unmodeled: string[] };

// Guide aliases, deliberately explicit rather than fuzzy text matching.
export const LAYOUT_COLLECTION: Readonly<Record<string, readonly string[]>> = {
  Grenade: ["holy-hand-grenade"], Dagger: ["brutus-dagger"], Wings: ["wings-of-icarus"],
  "David/Adam": ["david", "the-creation-of-adam"], Replica: ["notre-dame-de-paris-replica"],
  "Noah’s Ark": ["model-of-noahs-ark"],
};
export function resolveLayoutHero(name: string): Hero | undefined {
  const aliases: Record<string, string> = { Gawain: "garwain", "Sun-Sin": "yi-sun-sin", Drake: "francis-drake", Andersen: "hans-christian-andersen" };
  return HEROES.find((hero) => hero.id === aliases[name]) ?? heroNamed(name);
}

export function productionValue(hero: Hero, level = 1): { building: string; percent: number; requiredStars?: number } | null {
  if (!Number.isInteger(level) || level < 1) return null;
  const text = hero.production?.levels[level - 1];
  const match = text?.match(/^(?:Activates at (\d+)-Star\. )?Assign to (any building|the (.+)) for Resource Productivity \+(\d+(?:\.\d+)?)%\.$/);
  return match ? { building: match[3] ?? "*", percent: Number(match[4]), requiredStars: match[1] ? Number(match[1]) : undefined } : null;
}
export const PRODUCTION_BUILDINGS = [...new Set(HEROES.flatMap((hero) => {
  const value = productionValue(hero);
  return value && value.building !== "*" ? [value.building] : [];
}))].sort();

function conditions(pick: LayoutPick, hero: Hero, items: Set<string>): string[] {
  if (!pick.note) return [];
  if (pick.note === "withItem" || pick.note === "item") {
    const item = exclusiveCollectionForHero(hero.id);
    return item && items.has(item.id) ? [] : [pick.note];
  }
  // Rarity, age and Nidhogg are not inferred from unknown player progression.
  return [pick.note];
}

/** Exact top-N for each additive guide profile; no combat outcome prediction. */
export function planHeroTeams(input: TeamInput): TeamResult[] {
  if (!Number.isInteger(input.size) || input.size < 1 || input.size > 25) throw new RangeError("size");
  if (input.mode !== "combat" && input.mode !== "production") throw new RangeError("mode");
  if (input.mode === "production" && !PRODUCTION_BUILDINGS.includes(input.building)) throw new RangeError("building");
  const byId = new Map(HEROES.map((hero) => [hero.id, hero]));
  const owned = [...new Map(input.heroes.map((hero) => [hero.id, hero])).values()].filter((hero) => byId.has(hero.id)).sort((a, b) => a.id.localeCompare(b.id, "en"));
  for (const hero of owned) {
    if (hero.level !== undefined && (!Number.isInteger(hero.level) || hero.level < 1)) throw new RangeError("level");
    if (hero.stars !== undefined && (!Number.isInteger(hero.stars) || hero.stars < 0)) throw new RangeError("stars");
    if (hero.productionLevel !== undefined && (!Number.isInteger(hero.productionLevel) || hero.productionLevel < 1 || hero.productionLevel > (byId.get(hero.id)?.production?.levels.length ?? 0))) throw new RangeError("productionLevel");
  }
  const knownItems = new Set(COLLECTION_ITEMS.map((item) => item.id));
  const items = new Set([...input.items, ...input.collection].filter((id) => knownItems.has(id)));
  const selected = [...new Set(input.collection)].filter((id) => knownItems.has(id));
  const rank = (members: Member[]) => members.sort((a, b) => b.points - a.points || a.id.localeCompare(b.id, "en")).slice(0, input.size);
  if (input.mode === "production") {
    const members: Member[] = [];
    const unmodeled: string[] = [];
    for (const own of owned) {
      const value = productionValue(byId.get(own.id)!, own.productionLevel ?? 1);
      if (!value) { unmodeled.push(own.id); continue; }
      if (value.building !== "*" && value.building !== input.building) continue;
      if (value.requiredStars !== undefined && own.stars !== undefined && own.stars < value.requiredStars) { unmodeled.push(own.id); continue; }
      members.push({ id: own.id, points: value.percent, production: value.percent, roles: [], conditions: [], requiredStars: own.stars === undefined ? value.requiredStars : undefined });
    }
    // Individual bonuses are comparable; their sum is NOT a stacking formula.
    return [{ id: "production", members: rank(members), score: 0, collection: [], missing: [], unmodeled }];
  }
  return LAYOUT_DATA.builds.map((build): TeamResult => {
    const members: Member[] = owned.map((own) => {
      const hero = byId.get(own.id)!;
      let points = 0;
      let zone: string | undefined;
      const pending: string[] = [];
      for (const [name, weight] of [["key", 12], ["important", 6], ["other", 2]] as const) {
        const pick = build[name].find((entry) => resolveLayoutHero(entry.hero)?.id === hero.id);
        if (pick) {
          const needs = conditions(pick, hero, items);
          pending.push(...needs);
          if (!needs.length) { points = weight; zone = name; }
          break;
        }
      }
      const roles = LAYOUT_DATA.utility.filter((role) => role.groups.some((group) => group.picks.some((pick) => resolveLayoutHero(pick.hero)?.id === hero.id && !conditions(pick, hero, items).length))).map((role) => role.id);
      const utility = build.id === "dot" ? 3 : build.id === "crit" ? 1 : 2;
      points += roles.length * utility;
      return { id: hero.id, points, zone, roles, conditions: pending };
    });
    const team = rank(members.filter((member) => member.points > 0));
    const matches = selected.filter((id) => build.collection.some((pick) => LAYOUT_COLLECTION[pick.hero]?.includes(id)));
    const missing = build.key.filter((pick) => !team.some((member) => member.id === resolveLayoutHero(pick.hero)?.id && member.zone === "key")).map((pick) => pick.hero);
    return { id: build.id, members: team, score: team.length ? team.reduce((sum, hero) => sum + hero.points, 0) + matches.length * 3 : 0, collection: matches, missing, unmodeled: members.filter((member) => member.points === 0).map((member) => member.id) };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, "en"));
}
