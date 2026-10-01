import rawBaseValues from "../data/hero-base-values.json" with { type: "json" };
import { HEROES } from "../content/heroes.ts";

export const STAR_COLORS = [
  "Green", "Blue", "Purple", "Yellow", "Red", "Shiny Yellow", "Shiny Blue", "Shiny Purple", "Max",
] as const;

const ACTIVATION_CHANCE: Record<string, number> = { "UR+": 0.4, UR: 0.4, SSR: 0.3, SR: 0.25, R: 0.2 };
const BASE_SKILL_DAMAGE: Record<string, number> = { "UR+": 2, UR: 2, SSR: 1.6, SR: 1.4, R: 1.2 };

type SourceValue = [attack: number | null, sourceStarOrder: number];
const sourceValues = rawBaseValues as unknown as Record<string, SourceValue>;

export type BaseValueInput = { id: string; attack: number | null; starColor: number };
export type BaseValueRow = {
  id: string;
  name: string;
  rarity: string;
  troop: string;
  attack: number;
  starColor: number;
  activationChance: number;
  skillDamage: number;
  score: number;
};

/** The workbook's baseline score is attack × skill proc chance × skill coefficient. */
export function scoreBaseLineup(owned: BaseValueInput[], slots: number) {
  if (!Number.isInteger(slots) || slots < 1 || slots > 25) throw new RangeError("slots");
  if (!Array.isArray(owned) || new Set(owned.map((entry) => entry.id)).size !== owned.length) throw new RangeError("owned");

  const rows: BaseValueRow[] = [];
  for (const entry of owned) {
    const hero = HEROES.find((candidate) => candidate.id === entry.id);
    const source = sourceValues[entry.id];
    if (!hero || !source || !Number.isFinite(entry.attack) || (entry.attack as number) < 0 || (entry.attack as number) > 1e9
      || !Number.isInteger(entry.starColor) || entry.starColor < 1 || entry.starColor > STAR_COLORS.length) throw new RangeError("hero");
    const activationChance = ACTIVATION_CHANCE[hero.rarity];
    const baseDamage = BASE_SKILL_DAMAGE[hero.rarity];
    if (activationChance === undefined || baseDamage === undefined) throw new RangeError("rarity");
    const skillDamage = baseDamage + (entry.starColor - 1) * 0.1;
    rows.push({ id: entry.id, name: hero.name, rarity: hero.rarity, troop: hero.troop ?? "", attack: entry.attack as number, starColor: entry.starColor, activationChance, skillDamage, score: (entry.attack as number) * activationChance * skillDamage });
  }

  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "en"));
  const lineup = rows.slice(0, slots);
  return { rows, lineup, slots, totalScore: lineup.reduce((sum, row) => sum + row.score, 0), excludedCount: owned.length - rows.length };
}

export function baseValueSource(id: string): { attack: number | null; starColor: number } | undefined {
  const value = sourceValues[id];
  return value ? { attack: value[0], starColor: value[1] } : undefined;
}
