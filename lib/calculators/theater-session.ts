/**
 * Red Carpet projection from player-supplied theater levels and stamina.
 * Building unlocks and rarity odds are from the three player screenshots
 * supplied on 27 September 2026; missing SSR/UR chances for Royal/Civic were
 * confirmed as 40%/10% by the player. The offer model assumes three
 * independent rarity draws with replacement, then the player picks the best
 * option for the remaining energy.
 */
import type { PlayRarity } from "./theater-income.ts";

export type TheaterBuilding = {
  id: "parade" | "openAir" | "art" | "royal" | "civic";
  name: string;
  minLevel: number;
  maxLevel: number | null;
  tier: number;
  theaterSlots: number;
  goddessSlots: number;
  rarityChances: Record<PlayRarity, number>;
};

const ZERO = { "UR+": 0, UR: 0, SSR: 0, SR: 0, R: 0 } as const;

export const THEATER_BUILDINGS: readonly TheaterBuilding[] = [
  { id: "parade", name: "Parade Wagon", minLevel: 1, maxLevel: 2, tier: 1, theaterSlots: 1, goddessSlots: 1, rarityChances: { ...ZERO, R: 80, SR: 20 } },
  { id: "openAir", name: "Open-Air Theater", minLevel: 3, maxLevel: 14, tier: 2, theaterSlots: 2, goddessSlots: 2, rarityChances: { ...ZERO, R: 40, SR: 50, SSR: 10 } },
  { id: "art", name: "Art Theater", minLevel: 15, maxLevel: 26, tier: 3, theaterSlots: 3, goddessSlots: 3, rarityChances: { ...ZERO, R: 20, SR: 35, SSR: 35, UR: 10 } },
  { id: "royal", name: "Royal Theater", minLevel: 27, maxLevel: 39, tier: 4, theaterSlots: 4, goddessSlots: 4, rarityChances: { ...ZERO, R: 10, SR: 30, SSR: 40, UR: 10, "UR+": 10 } },
  // Civic's five goddess slots are inferred from its five parallel theaters and the five-role UR+ scripts.
  { id: "civic", name: "Civic Theater", minLevel: 40, maxLevel: null, tier: 1, theaterSlots: 5, goddessSlots: 5, rarityChances: { ...ZERO, R: 5, SR: 25, SSR: 40, UR: 10, "UR+": 20 } },
];

export const PLAY_ENERGY: Readonly<Record<PlayRarity, number>> = {
  "UR+": 600,
  UR: 300,
  SSR: 160,
  SR: 60,
  R: 30,
};

export function theaterBuildingForLevel(level: number): TheaterBuilding {
  if (!Number.isSafeInteger(level) || level < 1) throw new RangeError("Theater level must be a positive whole number.");
  return THEATER_BUILDINGS.find((building) => level >= building.minLevel && (building.maxLevel === null || level <= building.maxLevel))!;
}

export function theaterTierForLevel(level: number): number {
  const building = theaterBuildingForLevel(level);
  return level - building.minLevel + 1;
}

export type RarityReward = { low: number; average: number; high: number };
export type TheaterRunInput = {
  level: number;
  startingEnergy: readonly number[];
  startingPlays: readonly { rarity: PlayRarity; reward: RarityReward }[];
  lipsticks: number;
  lipstickSlot: number;
  rewards: Partial<Record<PlayRarity, RarityReward>>;
};
export type TheaterSlotProjection = {
  slot: number;
  energy: number;
  minimum: number;
  average: number;
  maximum: number;
};
export type TheaterRunProjection = {
  building: TheaterBuilding;
  slots: TheaterSlotProjection[];
  minimum: number;
  average: number;
  maximum: number;
  unpricedRarities: PlayRarity[];
};

type ExpectedValue = { points: number };
type RangeValue = { low: number; high: number };
type Offer = { rarities: readonly PlayRarity[]; probability: number };

function offersFor(building: TheaterBuilding): Offer[] {
  const rarities = (Object.keys(building.rarityChances) as PlayRarity[]).filter((rarity) => building.rarityChances[rarity] > 0);
  const offers: Offer[] = [];
  for (let first = 0; first < rarities.length; first += 1) {
    for (let second = first; second < rarities.length; second += 1) {
      for (let third = second; third < rarities.length; third += 1) {
        const selected = [rarities[first], rarities[second], rarities[third]];
        const distinct = new Set(selected).size;
        const permutations = distinct === 1 ? 1 : distinct === 2 ? 3 : 6;
        offers.push({
          rarities: selected,
          probability: permutations * selected.reduce((probability, rarity) => probability * building.rarityChances[rarity], 1) / 1_000_000,
        });
      }
    }
  }
  return offers;
}

function compareActions(a: { rarity: PlayRarity; value: number }, b: { rarity: PlayRarity; value: number }): number {
  return b.value - a.value || PLAY_ENERGY[a.rarity] - PLAY_ENERGY[b.rarity] || a.rarity.localeCompare(b.rarity);
}

function projectSlot(building: TheaterBuilding, energy: number, offers: readonly Offer[], rewards: TheaterRunInput["rewards"]): Omit<TheaterSlotProjection, "slot" | "energy"> {
  // Energy only decreases, so fill tables from 0 upward. This avoids deep and
  // repeated recursion when a player enters thousands of energy.
  const expected: ExpectedValue[] = Array.from({ length: energy + 1 }, () => ({ points: 0 }));
  const ranges: RangeValue[] = Array.from({ length: energy + 1 }, () => ({ low: 0, high: 0 }));
  for (let remaining = 1; remaining <= energy; remaining += 1) {
    let points = 0;
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (const offer of offers) {
      const actions = [...new Set(offer.rarities)]
        .filter((rarity) => PLAY_ENERGY[rarity] <= remaining)
        .map((rarity) => ({ rarity, value: (rewards[rarity]?.average ?? 0) + expected[remaining - PLAY_ENERGY[rarity]].points }))
        .sort(compareActions);
      const chosen = actions[0];
      if (!chosen) {
        low = Math.min(low, 0);
        high = Math.max(high, 0);
        continue;
      }
      const nextRemaining = remaining - PLAY_ENERGY[chosen.rarity];
      const next = expected[nextRemaining];
      points += offer.probability * ((rewards[chosen.rarity]?.average ?? 0) + next.points);
      const nextRange = ranges[nextRemaining];
      low = Math.min(low, (rewards[chosen.rarity]?.low ?? 0) + nextRange.low);
      high = Math.max(high, (rewards[chosen.rarity]?.high ?? 0) + nextRange.high);
    }
    expected[remaining] = { points };
    ranges[remaining] = { low: Number.isFinite(low) ? low : 0, high: Number.isFinite(high) ? high : 0 };
  }

  const expectation = expected[energy];
  const range = ranges[energy];
  return { minimum: range.low, average: expectation.points, maximum: range.high };
}

export function simulateTheaterRun(input: TheaterRunInput): TheaterRunProjection {
  const building = theaterBuildingForLevel(input.level);
  if (input.startingEnergy.length !== building.theaterSlots) throw new RangeError(`Enter the starting energy for all ${building.theaterSlots} theater slots.`);
  if (input.startingPlays.length !== building.theaterSlots) throw new RangeError(`Choose a starting play for all ${building.theaterSlots} theater slots.`);
  if (!Number.isSafeInteger(input.lipsticks) || input.lipsticks < 0 || input.lipsticks > 10_000) throw new RangeError("Lipsticks must be a whole number from 0 to 10,000.");
  if (!Number.isInteger(input.lipstickSlot) || input.lipstickSlot < 0 || input.lipstickSlot >= building.theaterSlots) throw new RangeError("Choose an open theater slot for the lipsticks.");
  for (const energy of input.startingEnergy) if (!Number.isInteger(energy) || energy < 0 || energy > 5_000) throw new RangeError("Starting energy must be a whole number from 0 to 5,000.");

  const offers = offersFor(building);
  const slots = input.startingEnergy.map((start, index) => {
    const energy = start + (index === input.lipstickSlot ? input.lipsticks * 5 : 0);
    const startingPlay = input.startingPlays[index];
    const remaining = energy - PLAY_ENERGY[startingPlay.rarity];
    if (remaining < 0) throw new RangeError(`The starting energy in slot ${index + 1} does not cover its selected play.`);
    const range = projectSlot(building, remaining, offers, input.rewards);
    return {
      slot: index + 1,
      energy,
      minimum: startingPlay.reward.low + range.minimum,
      average: startingPlay.reward.average + range.average,
      maximum: startingPlay.reward.high + range.maximum,
    };
  });
  const rarityChances = Object.keys(building.rarityChances) as PlayRarity[];
  return {
    building,
    slots,
    minimum: slots.reduce((sum, slot) => sum + slot.minimum, 0),
    average: slots.reduce((sum, slot) => sum + slot.average, 0),
    maximum: slots.reduce((sum, slot) => sum + slot.maximum, 0),
    unpricedRarities: rarityChances.filter((rarity) => building.rarityChances[rarity] > 0 && !input.rewards[rarity]),
  };
}
