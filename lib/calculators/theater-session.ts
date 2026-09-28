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

/** Probability that a rarity appears at least once across independent offers. */
export function rarityAppearanceChance(perOfferPercent: number, offerCount = 3): number {
  if (!Number.isFinite(perOfferPercent) || perOfferPercent < 0 || perOfferPercent > 100) {
    throw new RangeError("Offer chance must be from 0 to 100 percent.");
  }
  if (!Number.isSafeInteger(offerCount) || offerCount < 1) {
    throw new RangeError("Offer count must be a positive whole number.");
  }
  return 100 * (1 - (1 - perOfferPercent / 100) ** offerCount);
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

export type TheaterTrialPlay = {
  id: string;
  rarity: PlayRarity;
  coins: number;
  redCarpet: RarityReward;
  goddesses: readonly string[];
};
export type TheaterTrialInput = Omit<TheaterRunInput, "startingPlays" | "rewards"> & {
  startingPlays: readonly TheaterTrialPlay[];
  plays: readonly TheaterTrialPlay[];
  rounds: number;
  seed: number;
};
export type TheaterTrialLogPlay = TheaterTrialPlay & {
  slot: number;
  starting: boolean;
  energyBefore: number;
  energyCost: number;
  energyAfter: number;
};
export type TheaterTrial = { points: number; plays: TheaterTrialLogPlay[] };
export type TheaterTrialSlotStart = { slot: number; startingEnergy: number; lipsticks: number; lipstickEnergy: number; totalEnergy: number };
export type TheaterTrialResult = {
  rounds: number;
  slotStarts: TheaterTrialSlotStart[];
  minimum: number;
  average: number;
  maximum: number;
  minimumRun: TheaterTrial;
  averageRun: TheaterTrial;
  maximumRun: TheaterTrial;
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

/**
 * Run reproducible Monte Carlo trials over three rarity offers per choice.
 * The representative log for average is the run nearest the arithmetic mean.
 */
export function simulateTheaterTrials(input: TheaterTrialInput): TheaterTrialResult {
  const building = theaterBuildingForLevel(input.level);
  if (!Number.isSafeInteger(input.rounds) || input.rounds < 1 || input.rounds > 1_000) throw new RangeError("Simulation rounds must be a whole number from 1 to 1,000.");
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffff_ffff) throw new RangeError("Simulation seed must be an unsigned 32-bit whole number.");
  if (input.startingEnergy.length !== building.theaterSlots) throw new RangeError(`Enter the starting energy for all ${building.theaterSlots} theater slots.`);
  if (input.startingPlays.length !== building.theaterSlots) throw new RangeError(`Choose a starting play for all ${building.theaterSlots} theater slots.`);
  if (!Number.isSafeInteger(input.lipsticks) || input.lipsticks < 0 || input.lipsticks > 10_000) throw new RangeError("Lipsticks must be a whole number from 0 to 10,000.");
  if (!Number.isInteger(input.lipstickSlot) || input.lipstickSlot < 0 || input.lipstickSlot >= building.theaterSlots) throw new RangeError("Choose an open theater slot for the lipsticks.");
  for (const energy of input.startingEnergy) if (!Number.isInteger(energy) || energy < 0 || energy > 5_000) throw new RangeError("Starting energy must be a whole number from 0 to 5,000.");
  if (!input.plays.length || input.plays.some((play) => !Number.isFinite(play.coins) || play.coins < 0 || !Number.isFinite(play.redCarpet.average))) throw new RangeError("Simulation needs usable play previews.");
  if (input.startingPlays.some((play) => !input.plays.some((candidate) => candidate.id === play.id))) throw new RangeError("Every starting play must be included in the simulation data.");
  if (input.startingPlays.some((play, index) => input.startingEnergy[index] + (index === input.lipstickSlot ? input.lipsticks * 5 : 0) < PLAY_ENERGY[play.rarity])) throw new RangeError("Starting energy must cover the selected play in every slot.");

  const byRarity = new Map<PlayRarity, TheaterTrialPlay[]>();
  for (const play of input.plays) byRarity.set(play.rarity, [...(byRarity.get(play.rarity) ?? []), play]);
  const rewards = Object.fromEntries([...byRarity].map(([rarity, plays]) => [rarity, plays.reduce((sum, play) => sum + play.redCarpet.average, 0) / plays.length])) as Partial<Record<PlayRarity, number>>;
  const offers = offersFor(building);
  const slotStarts = input.startingEnergy.map((startingEnergy, index) => {
    const lipsticks = index === input.lipstickSlot ? input.lipsticks : 0;
    const lipstickEnergy = lipsticks * 5;
    return { slot: index + 1, startingEnergy, lipsticks, lipstickEnergy, totalEnergy: startingEnergy + lipstickEnergy };
  });
  const maximumEnergy = Math.max(...input.startingEnergy.map((energy, index) => energy + (index === input.lipstickSlot ? input.lipsticks * 5 : 0)));
  const expected = Array.from({ length: maximumEnergy + 1 }, () => 0);
  for (let remaining = 1; remaining <= maximumEnergy; remaining += 1) {
    let points = 0;
    for (const offer of offers) {
      const actions = [...new Set(offer.rarities)]
        .filter((rarity) => byRarity.has(rarity) && PLAY_ENERGY[rarity] <= remaining)
        .map((rarity) => ({ rarity, value: (rewards[rarity] ?? 0) + expected[remaining - PLAY_ENERGY[rarity]] }))
        .sort(compareActions);
      if (actions[0]) points += offer.probability * actions[0].value;
    }
    expected[remaining] = points;
  }

  let state = input.seed || 0x6d2b79f5;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
  const drawPlay = (): TheaterTrialPlay | null => {
    let roll = random() * 100;
    for (const rarity of Object.keys(building.rarityChances) as PlayRarity[]) {
      roll -= building.rarityChances[rarity];
      if (roll < 0) {
        const candidates = byRarity.get(rarity);
        return candidates?.[Math.floor(random() * candidates.length)] ?? null;
      }
    }
    return null;
  };
  const trials: TheaterTrial[] = [];
  for (let round = 0; round < input.rounds; round += 1) {
    const selected: TheaterTrialLogPlay[] = [];
    let points = 0;
    for (let slot = 0; slot < building.theaterSlots; slot += 1) {
      const firstPlay = input.startingPlays[slot];
      let remaining = slotStarts[slot].totalEnergy;
      const startingCost = PLAY_ENERGY[firstPlay.rarity];
      selected.push({ ...firstPlay, slot: slot + 1, starting: true, energyBefore: remaining, energyCost: startingCost, energyAfter: remaining - startingCost });
      points += firstPlay.redCarpet.average;
      remaining -= startingCost;
      while (remaining >= Math.min(...Object.values(PLAY_ENERGY))) {
        const candidates = [drawPlay(), drawPlay(), drawPlay()].filter((play): play is TheaterTrialPlay => play !== null && PLAY_ENERGY[play.rarity] <= remaining);
        const chosen = candidates.sort((a, b) =>
          (b.redCarpet.average + expected[remaining - PLAY_ENERGY[b.rarity]]) - (a.redCarpet.average + expected[remaining - PLAY_ENERGY[a.rarity]]) ||
          PLAY_ENERGY[a.rarity] - PLAY_ENERGY[b.rarity] || a.id.localeCompare(b.id),
        )[0];
        if (!chosen) break;
        const energyBefore = remaining;
        const energyCost = PLAY_ENERGY[chosen.rarity];
        remaining -= energyCost;
        selected.push({ ...chosen, slot: slot + 1, starting: false, energyBefore, energyCost, energyAfter: remaining });
        points += chosen.redCarpet.average;
      }
    }
    trials.push({ points, plays: selected });
  }
  const minimum = Math.min(...trials.map((trial) => trial.points));
  const maximum = Math.max(...trials.map((trial) => trial.points));
  const average = trials.reduce((sum, trial) => sum + trial.points, 0) / trials.length;
  const minimumRun = trials.find((trial) => trial.points === minimum)!;
  const maximumRun = [...trials].reverse().find((trial) => trial.points === maximum)!;
  const averageRun = trials.reduce((best, trial) => Math.abs(trial.points - average) < Math.abs(best.points - average) ? trial : best, trials[0]);
  return { rounds: input.rounds, slotStarts, minimum, average, maximum, minimumRun, averageRun, maximumRun };
}
