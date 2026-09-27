import routeData from "../data/grand-voyage-routes.json" with { type: "json" };
import shipwreckData from "../data/grand-voyage-shipwreck-observation.json" with { type: "json" };
import { CITIES, CITY_GROUPS, UPGRADE_COSTS } from "./city-upgrades.ts";

/** The old workbook is a reference scenario, not a price model for a player's ship. */
export const VOYAGE_CITIES = CITIES;
export const VOYAGE_REGIONS = Object.keys(CITY_GROUPS);
export const DEFAULT_VOYAGE_PROFILE: VoyageProfile = {
  playerLevel: 20,
  ship: { sails: 40, nails: 40, cabin: 40, figurehead: 40 },
  cryptids: { vanguard: "", logistics: "", leftFlank: "", rightFlank: "" },
  unlockedRegions: [],
  regionLevels: {},
  cityLevels: {},
  timeCalibration: 1,
};

export type VoyageProfile = {
  playerLevel: number;
  ship: { sails: number; nails: number; cabin: number; figurehead: number };
  cryptids: { vanguard: string; logistics: string; leftFlank: string; rightFlank: string };
  unlockedRegions: string[];
  regionLevels: Record<string, number>;
  cityLevels: Record<string, number>;
  /** Measured travel duration / old workbook travel duration for the same leg. */
  timeCalibration: number;
};

export type SimulatedLeg = { from: string; to: string; hours: number; referenceProfit: number };
export type SimulatedRoute = { cities: string[]; legs: SimulatedLeg[]; hours: number; referenceProfit: number; referencePerHour: number };
export type ObservedShipment = { destination: string; profit: number; hours: number; profitPerHour: number };

function requireProfile(profile: VoyageProfile): void {
  if (!Number.isInteger(profile.playerLevel) || profile.playerLevel < 1) throw new Error("Player level must be a positive integer.");
  if (!Number.isFinite(profile.timeCalibration) || profile.timeCalibration <= 0 || profile.timeCalibration > 10) throw new Error("Travel time factor must be above zero and at most 10.");
  if (new Set(profile.unlockedRegions).size !== profile.unlockedRegions.length || profile.unlockedRegions.some((region) => !VOYAGE_REGIONS.includes(region))) throw new Error("Unknown or duplicate region.");
  for (const level of Object.values(profile.ship)) {
    if (!Number.isSafeInteger(level) || level < 0) throw new Error("Ship part levels must be nonnegative whole numbers.");
  }
  for (const region of VOYAGE_REGIONS) {
    const level = profile.regionLevels[region] ?? 0;
    if (!Number.isInteger(level) || level < 0 || level > 30 || level % 5 !== 0) throw new Error("Region base levels must be 0, 5, …, 30.");
  }
  for (const city of VOYAGE_CITIES) {
    const level = profile.cityLevels[city.name];
    if (level !== undefined && (!Number.isInteger(level) || level < 0 || level > city.maximumLevel)) throw new Error("Invalid city level.");
  }
}

export function levelForCity(profile: VoyageProfile, cityName: string): number {
  const city = VOYAGE_CITIES.find((item) => item.name === cityName);
  if (!city) throw new Error(`Unknown city: ${cityName}`);
  return profile.cityLevels[cityName] ?? (profile.regionLevels[city.group] ?? 0);
}

/** The next known *cost* only. There is no measured level-to-profit rule yet. */
export function nextCityUpgrade(profile: VoyageProfile, cityName: string) {
  requireProfile(profile);
  const city = VOYAGE_CITIES.find((item) => item.name === cityName);
  if (!city) throw new Error(`Unknown city: ${cityName}`);
  const current = levelForCity(profile, cityName);
  if (current >= city.maximumLevel) return null;
  const requiredPeerLevel = Math.floor(current / 5) * 5;
  const peers = VOYAGE_CITIES.filter((peer) => peer.group === city.group && peer.name !== cityName);
  const missingPeers = peers.filter((peer) => levelForCity(profile, peer.name) < requiredPeerLevel);
  return {
    city: cityName,
    from: current,
    to: current + 1,
    cost: UPGRADE_COSTS[city.type][current],
    requiredPeerLevel,
    missingPeers: missingPeers.map((peer) => peer.name),
  };
}

function routeFromIndexes(indexes: number[], timeCalibration: number): SimulatedRoute {
  const cycle = [...indexes, indexes[0]];
  const legs = cycle.slice(0, -1).map((fromIndex, index) => {
    const toIndex = cycle[index + 1];
    return {
      from: routeData.cities[fromIndex],
      to: routeData.cities[toIndex],
      hours: routeData.time_days[fromIndex][toIndex] * 24 * timeCalibration,
      referenceProfit: Math.trunc(routeData.profits[fromIndex][toIndex]),
    };
  });
  const hours = legs.reduce((sum, leg) => sum + leg.hours, 0);
  const referenceProfit = legs.reduce((sum, leg) => sum + leg.referenceProfit, 0);
  return { cities: indexes.map((index) => routeData.cities[index]), legs, hours, referenceProfit, referencePerHour: referenceProfit / hours };
}

/** Exhaustive search of all accessible two- and three-port cycles, not a preset build list. */
export function optimizeVoyageRoutes(profile: VoyageProfile, maxStops: 2 | 3 = 3, limit = 5): SimulatedRoute[] {
  requireProfile(profile);
  if (maxStops !== 2 && maxStops !== 3) throw new Error("Choose two or three ports.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("Limit must be 1–20.");
  const regions = new Set(profile.unlockedRegions);
  const available = routeData.cities.flatMap((name, index) => {
    const city = VOYAGE_CITIES.find((entry) => entry.name === name);
    return city && regions.has(city.group) ? [index] : [];
  });
  const results: SimulatedRoute[] = [];
  for (let a = 0; a < available.length; a++) {
    for (let b = a + 1; b < available.length; b++) {
      results.push(routeFromIndexes([available[a], available[b]], profile.timeCalibration));
      if (maxStops === 2) continue;
      for (let c = b + 1; c < available.length; c++) {
        results.push(routeFromIndexes([available[a], available[b], available[c]], profile.timeCalibration));
        results.push(routeFromIndexes([available[a], available[c], available[b]], profile.timeCalibration));
      }
    }
  }
  return results.sort((a, b) => b.referencePerHour - a.referencePerHour || b.referenceProfit - a.referenceProfit || a.cities.join().localeCompare(b.cities.join())).slice(0, limit);
}

/** One observed cargo, one-way only; no restocking or return cargo is implied. */
export function observedShipwreckShipments(profile: VoyageProfile): ObservedShipment[] {
  requireProfile(profile);
  const regions = new Set(profile.unlockedRegions);
  if (!regions.has("North Atlantic Islands")) return [];
  const fromIndex = routeData.cities.indexOf(shipwreckData.origin);
  const cargo = shipwreckData.cargo;
  const buy = Object.entries(cargo).reduce((sum, [, item]) => sum + item.quantity * item.buy, 0);
  return Object.entries(shipwreckData.salePrices).flatMap(([destination, prices]) => {
    const city = VOYAGE_CITIES.find((item) => item.name === destination);
    const toIndex = routeData.cities.indexOf(destination);
    if (!city || !regions.has(city.group) || toIndex < 0) return [];
    const sale = Object.entries(cargo).reduce((sum, [good, item]) => sum + item.quantity * (prices as Record<string, number>)[good], 0);
    const profit = sale - buy;
    const hours = routeData.time_days[fromIndex][toIndex] * 24 * profile.timeCalibration;
    return [{ destination, profit, hours, profitPerHour: profit / hours }];
  }).sort((a, b) => b.profitPerHour - a.profitPerHour);
}
