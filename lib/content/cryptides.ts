/**
 * Cryptides bestiary: portraits, skills, feed foods, and Cryptid Tower talent
 * materials. Rows live in `lib/data/cryptides.json`; readable names and skill
 * text live in `guideEntries.cryptides.cryptideTexts` per language.
 *
 * Portraits, icons and the evolution art are cut from in-game screenshots into
 * `public/cryptides/`. Source screenshots: Fabian, 16 and 17 September 2026.
 */

import data from "../data/cryptides.json" with { type: "json" };
import { asset } from "../site.ts";

export const CRYPTID_TOWERS = ["pike", "bow", "shield", "horse"] as const;
export type CryptidTower = (typeof CRYPTID_TOWERS)[number];

export const TALENT_MATERIALS = ["bell", "branch", "potion", "grass"] as const;
export type TalentMaterial = (typeof TALENT_MATERIALS)[number];

/**
 * The six shapes a Cryptide grows through, in the order the Evolve tab stacks
 * them. Every Cryptide walks the same ladder, so the names are shared
 * vocabulary on the guide entry rather than something written per creature.
 */
export const CRYPTID_STAGES = ["childhood", "youth", "growth", "adult", "commander", "mythic"] as const;
export type CryptidStage = (typeof CRYPTID_STAGES)[number];

export function isCryptidStage(value: string): value is CryptidStage {
  return (CRYPTID_STAGES as readonly string[]).includes(value);
}

export type CryptidSkill = { id: string; image: string };
export type CryptidFood = { id: string; growth: number; image: string };
/** One rung of the ladder that has a picture. A rung without one is left out. */
export type CryptidStageArt = { stage: CryptidStage; image: string };

export type Cryptide = {
  id: string;
  name: string;
  rarity: string;
  tower: CryptidTower;
  talentMaterial: TalentMaterial;
  image: string;
  skills: CryptidSkill[];
  foods: CryptidFood[];
  stages: CryptidStageArt[];
};

export type CryptidesData = {
  talent: { unlockCost: number; dropAmount: number; dropEveryLevels: number };
  cryptides: Cryptide[];
};

export type CryptideSkillText = { name?: string; body?: string };
export type CryptideFoodText = { name?: string };
export type CryptideText = {
  name?: string;
  skills?: Record<string, CryptideSkillText>;
  foods?: Record<string, CryptideFoodText>;
};
export type CryptideTexts = Record<string, CryptideText>;

export const CRYPTIDES_DATA = data as CryptidesData;
export const CRYPTIDES: readonly Cryptide[] = CRYPTIDES_DATA.cryptides;

export function cryptideImageUrl(file: string): string {
  return asset(`/cryptides/${file.replace(/^\//, "")}`);
}

export function localizedCryptideName(cryptide: Cryptide, texts: CryptideTexts): string {
  return texts[cryptide.id]?.name?.trim() || cryptide.name;
}

export function skillText(cryptideId: string, skillId: string, texts: CryptideTexts): CryptideSkillText {
  return texts[cryptideId]?.skills?.[skillId] ?? {};
}

export function foodText(cryptideId: string, foodId: string, texts: CryptideTexts): CryptideFoodText {
  return texts[cryptideId]?.foods?.[foodId] ?? {};
}

/** The stage art a Cryptide has, always in ladder order however the row is written. */
export function orderedStages(cryptide: Cryptide): CryptidStageArt[] {
  return CRYPTID_STAGES.map((stage) => cryptide.stages.find((art) => art.stage === stage)).filter(
    (art): art is CryptidStageArt => Boolean(art && art.image),
  );
}

/** `items` defaults to the committed bestiary; the guide passes the published one. */
export function searchCryptides(
  query: string,
  texts: CryptideTexts,
  items: readonly Cryptide[] = CRYPTIDES,
): Cryptide[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((cryptide) => {
    const local = localizedCryptideName(cryptide, texts);
    const skillNames = cryptide.skills.map((skill) => skillText(cryptide.id, skill.id, texts).name ?? "");
    const foodNames = cryptide.foods.map((food) => foodText(cryptide.id, food.id, texts).name ?? "");
    const hay = [cryptide.name, local, cryptide.tower, cryptide.talentMaterial, ...skillNames, ...foodNames]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}
