import catalogData from "./hero-stat-baselines.json" with { type: "json" };

export type HeldStatPhase = "normal" | "before-ascension" | "after-ascension" | "before-enlightenment" | "after-enlightenment";

export type HeldStatObservation = {
  heroId: string;
  level: number;
  phase: HeldStatPhase | string;
  heldAng: number;
  heldLp: number | null;
  precision: string;
  dataQuality?: "needs-confirmation";
};

const REFERENCE_LEVEL_ONE_ANG = 616;

/**
 * Observed universal held-ANG additions. The level-300 value is currently
 * based on one confirmed example and is an explicit cross-hero assumption.
 */
export const HELD_ANG_MILESTONES = [
  { level: 20, ang: 400 },
  { level: 50, ang: 1600 },
  { level: 100, ang: 1500 },
  { level: 150, ang: 1920 },
  { level: 200, ang: 2400 },
  { level: 300, ang: 9000 },
] as const;

/** Integer growth step fitted to Guan Yu observations, before milestone bonuses. */
export function referenceHeldAng(level: number): number {
  if (!Number.isInteger(level) || level < 1) return 0;
  let ang = REFERENCE_LEVEL_ONE_ANG;
  for (let step = 1; step < level; step += 1) {
    // Integer division: nearest whole-point increment to (975 + 114 × step) / 20.
    ang += Math.floor((985 + 114 * step) / 20);
  }
  return ang;
}

export function heldAngMilestoneBonus(level: number, phase: string): number {
  return HELD_ANG_MILESTONES.reduce((sum, milestone) => {
    if (level > milestone.level) return sum + milestone.ang;
    if (level < milestone.level) return sum;
    return phase === "after-ascension" || phase === "after-enlightenment"
      ? sum + milestone.ang
      : sum;
  }, 0);
}

export function estimatedHeldAngLevelOne(observation: HeldStatObservation): number | null {
  if (observation.dataQuality === "needs-confirmation") return null;
  const baseAtLevel = referenceHeldAng(observation.level);
  const angBeforeBonuses = observation.heldAng - heldAngMilestoneBonus(observation.level, observation.phase);
  if (baseAtLevel <= 0 || angBeforeBonuses <= 0) return null;
  return Math.round((angBeforeBonuses * REFERENCE_LEVEL_ONE_ANG) / baseAtLevel);
}

export const HELD_STAT_OBSERVATIONS = (catalogData as { heldStatObservations: HeldStatObservation[] }).heldStatObservations;

export function heldStatObservationsForHero(heroId: string): HeldStatObservation[] {
  return HELD_STAT_OBSERVATIONS.filter((observation) => observation.heroId === heroId);
}

export function hasHeroStatRecord(heroId: string): boolean {
  return (catalogData as { heroes: Array<{ id: string }> }).heroes.some((hero) => hero.id === heroId);
}
