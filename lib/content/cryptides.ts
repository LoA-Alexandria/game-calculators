/**
 * Cryptides bestiary: portraits, skills, feed foods, and Cryptid Tower talent
 * materials. Rows live in `lib/data/cryptides.json`; readable names and skill
 * text live in `guideEntries.cryptides.cryptideTexts` per language.
 *
 * Portraits and icons are cropped from in-game screenshots into
 * `public/cryptides/`. Source screenshots: Fabian, 16 September 2026.
 */

import data from "../data/cryptides.json" with { type: "json" };
import { asset } from "../site.ts";

export const CRYPTID_TOWERS = ["pike", "bow", "shield", "horse"] as const;
export type CryptidTower = (typeof CRYPTID_TOWERS)[number];

export const TALENT_MATERIALS = ["bell", "branch", "potion", "grass"] as const;
export type TalentMaterial = (typeof TALENT_MATERIALS)[number];

export type CryptidSkill = { id: string; image: string };
export type CryptidFood = { id: string; growth: number; image: string };

export type Cryptide = {
  id: string;
  name: string;
  rarity: string;
  tower: CryptidTower;
  talentMaterial: TalentMaterial;
  image: string;
  skills: CryptidSkill[];
  foods: CryptidFood[];
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

export function searchCryptides(query: string, texts: CryptideTexts): Cryptide[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...CRYPTIDES];
  return CRYPTIDES.filter((cryptide) => {
    const local = localizedCryptideName(cryptide, texts);
    const skillNames = cryptide.skills.map((skill) => skillText(cryptide.id, skill.id, texts).name ?? "");
    const foodNames = cryptide.foods.map((food) => foodText(cryptide.id, food.id, texts).name ?? "");
    const hay = [cryptide.name, local, cryptide.tower, cryptide.talentMaterial, ...skillNames, ...foodNames]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}
