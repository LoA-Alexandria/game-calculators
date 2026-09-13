import type { Dictionary } from "../i18n/index.ts";
import tierData from "../data/hero-tiers.json" with { type: "json" };

/**
 * Types and helpers for the Hero tier list guide. The rows themselves (hero
 * names, grades, resources, bonuses) are in `lib/data/hero-tiers.json`, which the
 * tier list editor exports as a whole. Everything readable lives in
 * `guideEntries.heroTierList` and is referenced from the rows by key, so a tier
 * moves in one place for all three languages.
 *
 * Source: Autumn's (Ice, S12) tier lists on Discord, 8 September 2026. Names
 * are spelled as in the Hero layouts guide, so both guides point at the same
 * hero. All ratings are for a hero at 0 stars without items or skins unless an
 * entry says otherwise.
 */

type TierListText = Dictionary["guideEntries"]["heroTierList"];
export type RoleKey = keyof TierListText["roles"];
export type EffectKey = keyof TierListText["effects"];
export type ResourceKey = keyof TierListText["resources"];
export type NoteKey = keyof TierListText["notes"];
export type VariantKey = keyof TierListText["variants"];
export type ReasonKey = keyof TierListText["reasons"];

export const TIER_IDS = ["SS", "S", "A", "B", "C", "D"] as const;
export type TierId = (typeof TIER_IDS)[number];

/**
 * A grade as the source writes it: `A`, `A>S` (between the two), `SS(S+)`
 * (with a finer grade in brackets), or `C*` (see the entry's note).
 */
export type Grade = string;

const GRADE = /^(SS|S|A|B|C|D)(?:>(SS|S|A|B|C|D))?(?:\((SS\+|S\+)\))?(\*)?$/;

export type ParsedGrade = { tier: TierId; to: TierId | null; fine: string; flagged: boolean };

export function parseGrade(grade: Grade): ParsedGrade | null {
  const match = GRADE.exec(grade);
  if (!match) return null;
  return {
    tier: match[1] as TierId,
    to: (match[2] as TierId | undefined) ?? null,
    fine: match[3] ?? "",
    flagged: Boolean(match[4]),
  };
}

type Tagged = { hero: string; variant?: VariantKey; note?: NoteKey };

export type OverallEntry = Tagged & {
  battle?: Grade;
  /** Missing for SR and R heroes, which have no utility skill. */
  utility?: Grade;
  productivity?: Grade;
  linker?: boolean;
  /** Autumn's explanation for the placement, shown behind a "Why?" toggle. */
  reason?: ReasonKey;
};
export type BattleEntry = Tagged & { roles: readonly RoleKey[]; linker?: boolean };
export type UtilityEntry = Tagged & { effect: EffectKey; situational?: boolean };
export type ProductivityEntry = Tagged & { bonus: readonly number[] };
export type ProductivityGroup = { resource: ResourceKey; entries: readonly ProductivityEntry[] };

export type TierRow<Entry> = { tier: TierId; ordered?: boolean; entries: readonly Entry[] };

export type ProductivityRow = { tier: TierId; groups: readonly ProductivityGroup[] };

export type TierListData = {
  overall: readonly TierRow<OverallEntry>[];
  battle: readonly TierRow<BattleEntry>[];
  utility: readonly TierRow<UtilityEntry>[];
  productivity: readonly ProductivityRow[];
};

/**
 * JSON has no string literal types, so the keys are only as good as the file.
 * `tests/hero-tiers.test.mjs` checks every key against every dictionary.
 */
export const TIER_DATA = tierData as unknown as TierListData;
export const OVERALL_TIERS = TIER_DATA.overall;
export const BATTLE_TIERS = TIER_DATA.battle;
export const UTILITY_TIERS = TIER_DATA.utility;
export const PRODUCTIVITY_TIERS = TIER_DATA.productivity;


/** Lower-case, accent-free text for the hero filter. */
export function searchable(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

export function matchesHero(hero: string, query: string): boolean {
  const needle = searchable(query);
  return needle === "" || searchable(hero).includes(needle);
}
