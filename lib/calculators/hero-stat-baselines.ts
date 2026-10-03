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

export type HeroStarRarity = "UR+" | "UR" | "SSR" | "SR" | "R";

const REFERENCE_LEVEL_ONE_ANG = 616;
export const MAX_HELD_LEVEL = 500;
export const MAX_HERO_STAR_LEVEL = 13;

/** Fixed bonus added by each star level; LP and ANG use the same percentage. */
export const HELD_STAR_BONUS_PER_LEVEL: Readonly<Record<HeroStarRarity, number>> = Object.freeze({
  "UR+": 15,
  UR: 15,
  SSR: 12,
  SR: 8,
  R: 5,
});

export function maxHeroStarLevelAtLevel(heroLevel: number): number {
  if (!Number.isInteger(heroLevel) || heroLevel < 1 || heroLevel > MAX_HELD_LEVEL) return 0;
  return Math.min(MAX_HERO_STAR_LEVEL, Math.floor(heroLevel / 5));
}

/**
 * Observed universal held-ANG additions. The level-300 value is currently
 * based on one confirmed example and is an explicit cross-hero assumption.
 */
export const HELD_ANG_MILESTONES = [
  { level: 20, ang: 400, lp: 4_000 },
  { level: 50, ang: 1_600, lp: 16_000 },
  { level: 100, ang: 1_500, lp: 15_000 },
  { level: 150, ang: 1_920, lp: 19_200 },
  { level: 200, ang: 2_400, lp: 20_000 },
  { level: 300, ang: 9_000, lp: 90_000 },
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

export function heldLpMilestoneBonus(level: number, phase: string): number {
  return HELD_ANG_MILESTONES.reduce((sum, milestone) => {
    if (level > milestone.level) return sum + milestone.lp;
    if (level < milestone.level) return sum;
    return phase === "after-ascension" || phase === "after-enlightenment"
      ? sum + milestone.lp
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

/** Estimates a hero's level-one LP from its chat-supplied level reading. */
export function estimatedHeldLpLevelOne(observation: HeldStatObservation): number | null {
  if (observation.dataQuality === "needs-confirmation" || observation.heldLp == null) return null;
  const baseAtLevel = referenceHeldAng(observation.level);
  const lpBeforeBonuses = observation.heldLp - heldLpMilestoneBonus(observation.level, observation.phase);
  if (baseAtLevel <= 0 || lpBeforeBonuses <= 0) return null;
  return Math.round((lpBeforeBonuses * REFERENCE_LEVEL_ONE_ANG) / baseAtLevel);
}

export function heldStarBonusPercent(starLevel: number, rarity: HeroStarRarity): number | null {
  if (!Number.isInteger(starLevel) || starLevel < 0 || starLevel > MAX_HERO_STAR_LEVEL) return null;
  return starLevel * HELD_STAR_BONUS_PER_LEVEL[rarity];
}

export function heldAngAfterStarBonus(levelAng: number | null, starLevel: number, rarity: HeroStarRarity): number | null {
  if (levelAng == null) return null;
  const bonusPercent = heldStarBonusPercent(starLevel, rarity);
  if (bonusPercent == null) return null;
  return Math.round(levelAng * (1 + bonusPercent / 100));
}

export function heldLpAfterStarBonus(levelLp: number | null, starLevel: number, rarity: HeroStarRarity): number | null {
  if (levelLp == null) return null;
  const bonusPercent = heldStarBonusPercent(starLevel, rarity);
  if (bonusPercent == null) return null;
  return Math.round(levelLp * (1 + bonusPercent / 100));
}

/** Scales chat-derived level-one ANG and LP to the requested level. */
export function heldStatsAtLevel(
  levelOne: { heldAng: number | null; heldLp: number | null },
  level: number,
  currentMilestonePhase: "normal" | "after-ascension" = "normal",
) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_HELD_LEVEL) {
    return { heldAng: null, heldLp: null };
  }
  const referenceAtLevel = referenceHeldAng(level);
  const multiplier = referenceAtLevel / REFERENCE_LEVEL_ONE_ANG;
  return {
    heldAng: levelOne.heldAng == null
      ? null
      : Math.round(levelOne.heldAng * multiplier) + heldAngMilestoneBonus(level, currentMilestonePhase),
    heldLp: levelOne.heldLp == null
      ? null
      : Math.round(levelOne.heldLp * multiplier) + heldLpMilestoneBonus(level, currentMilestonePhase),
  };
}

export const HELD_STAT_OBSERVATIONS = (catalogData as { heldStatObservations: HeldStatObservation[] }).heldStatObservations;

export type HeroStatBaseline = (typeof catalogData.heroes)[number];

export function heroStatBaselineForHero(heroId: string): HeroStatBaseline | null {
  return (catalogData as { heroes: HeroStatBaseline[] }).heroes.find((hero) => hero.id === heroId) ?? null;
}

export function heldStatObservationsForHero(heroId: string): HeldStatObservation[] {
  return HELD_STAT_OBSERVATIONS.filter((observation) => observation.heroId === heroId);
}

export function heroBasicStatsForHero(heroId: string) {
  const hero = heroStatBaselineForHero(heroId);
  if (!hero) return null;

  const observations = heldStatObservationsForHero(heroId);
  const levelOne = observations.find((observation) => observation.level === 1 && observation.phase === "normal");
  const estimateFrom = observations
    .filter((observation) => estimatedHeldAngLevelOne(observation) !== null)
    .sort((a, b) => b.level - a.level || Number(b.phase === "after-ascension" || b.phase === "after-enlightenment") - Number(a.phase === "after-ascension" || a.phase === "after-enlightenment"))[0];
  const estimatedAng = estimateFrom ? estimatedHeldAngLevelOne(estimateFrom) : null;
  const lpEstimates = observations
    .map(estimatedHeldLpLevelOne)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const estimatedLp = lpEstimates.length
    ? lpEstimates.length % 2
      ? lpEstimates[(lpEstimates.length - 1) / 2]
      : Math.round((lpEstimates[lpEstimates.length / 2 - 1] + lpEstimates[lpEstimates.length / 2]) / 2)
    : null;
  const levelOneLp = observations.find((observation) => observation.level === 1 && observation.phase === "normal")?.heldLp ?? null;

  return {
    baseAttack: hero.combatBaseAttack.value,
    heldAng: hero.heldStatStart?.ang ?? levelOne?.heldAng ?? estimatedAng,
    heldAngEstimated: hero.heldStatStart?.ang == null && levelOne?.heldAng == null && estimatedAng !== null,
    heldLp: hero.heldStatStart?.lp ?? levelOneLp ?? estimatedLp,
    heldLpEstimated: hero.heldStatStart?.lp == null && levelOneLp == null && estimatedLp !== null,
  };
}
