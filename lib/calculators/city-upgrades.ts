export type CityType = "Town" | "City" | "Metropolis";

export const CITY_GROUPS = {
  "Iberian Domain": [["Gibraltar", "Town"], ["Lisbon", "City"], ["Madrid", "Metropolis"]],
  "French Waters": [["Bordeaux", "Town"], ["Saint-Malo", "City"], ["Paris", "Metropolis"]],
  "North Sea States": [["Hamburg", "Town"], ["Amsterdam", "City"], ["London", "Metropolis"], ["Plymouth", "Town"], ["Dublin", "Town"]],
  "North Atlantic Islands": [["Azores", "Town"], ["Shipwreck Cove", "Town"], ["Nuuk", "City"], ["Toronto", "Metropolis"]],
  "North American East Coast Islands": [["Boston", "City"], ["New York", "Metropolis"], ["Jamestown", "Town"], ["St. Augustine", "City"], ["Washington", "Town"]],
  "Gulf of Mexico Waters": [["Nassau", "City"], ["Havana", "Metropolis"], ["Veracruz", "Town"], ["Gulf of Mexico", "Town"]],
  "Caribbean Pirate Territory": [["San Juan", "Town"], ["Tortuga", "Metropolis"], ["Port Royal", "Town"], ["Curacao", "City"], ["Cartagena", "Town"]],
  "Mediterranean City-State League": [["Munich", "City"], ["Venice", "Metropolis"], ["Genoa", "Town"], ["Naples", "Town"]],
} as const satisfies Record<string, readonly (readonly [string, CityType])[]>;

export const UPGRADE_COSTS: Record<CityType, readonly number[]> = {
  Town: [300,1550,2800,4500,18000,24700,32500,42900,91500,111100,132700,156300,171300,329400,376400,426700,480600,552700,1450000,1610000,1780000,1950000,2010000,2640000,2880000,3120000,3370000,3640000,3910000,4200000],
  City: [400,2200,3900,6300,25200,34500,45400,58550,128100,155500,185700,218800,237500,461100,526800,597400,672800,767400,2040000,2260000,2490000,2740000,2800000,3700000,4030000,4370000,4720000,5090000,5480000,5880000],
  Metropolis: [600,1400,5200,8400,33600,46100,60500,78100,170800,207400,247700,291800,316700,614800,702500,796500,897100,1020000,2720000,3010000,3320000,3650000,3740000,4940000,5370000,5820000,6300000,6790000,7300000,7840000,9950000,10640000,11350000,12100000,12870000],
};

export type City = { name: string; type: CityType; group: string; maximumLevel: number };

export const CITIES: City[] = Object.entries(CITY_GROUPS).flatMap(([group, entries]) =>
  entries.map(([name, type]) => ({ name, type, group, maximumLevel: UPGRADE_COSTS[type].length })),
);

export function requiredGroupLevel(targetLevel: number): number {
  if (targetLevel < 1 || targetLevel > 35) throw new Error("Target level must be between 1 and 35.");
  return Math.floor((targetLevel - 1) / 5) * 5;
}

export function upgradeCost(city: City, currentLevel: number, targetLevel: number): number {
  if (!Number.isInteger(currentLevel) || !Number.isInteger(targetLevel)) throw new Error("Levels must be whole numbers.");
  if (currentLevel < 0) throw new Error("Current level cannot be negative.");
  if (currentLevel > city.maximumLevel || targetLevel > city.maximumLevel) throw new Error(`${city.name} supports levels up to ${city.maximumLevel}.`);
  if (targetLevel < currentLevel) throw new Error("Target level cannot be lower than the current level.");
  return UPGRADE_COSTS[city.type].slice(currentLevel, targetLevel).reduce((sum, cost) => sum + cost, 0);
}

export type UpgradePlan = {
  city: City;
  targetCost: number;
  requiredGroupLevel: number;
  prerequisites: Array<{ city: City; currentLevel: number; targetLevel: number; cost: number }>;
  totalCost: number;
};

export function buildUpgradePlan(cityName: string, currentLevel: number, targetLevel: number, groupLevels: Record<string, number>): UpgradePlan {
  const city = CITIES.find((candidate) => candidate.name === cityName);
  if (!city) throw new Error(`Unknown city: ${cityName}`);
  if (targetLevel <= currentLevel) throw new Error("Target level must be higher than the current level.");
  const targetCost = upgradeCost(city, currentLevel, targetLevel);
  const groupLevel = requiredGroupLevel(targetLevel);
  const peers = CITIES.filter((candidate) => candidate.group === city.group && candidate.name !== city.name);
  const prerequisites = groupLevel === 0 ? [] : peers.flatMap((peer) => {
    const peerLevel = groupLevels[peer.name];
    if (!Number.isInteger(peerLevel) || peerLevel < 0 || peerLevel > peer.maximumLevel) throw new Error(`${peer.name}'s current level must be between 0 and ${peer.maximumLevel}.`);
    return peerLevel < groupLevel ? [{ city: peer, currentLevel: peerLevel, targetLevel: groupLevel, cost: upgradeCost(peer, peerLevel, groupLevel) }] : [];
  });
  return { city, targetCost, requiredGroupLevel: groupLevel, prerequisites, totalCost: targetCost + prerequisites.reduce((sum, item) => sum + item.cost, 0) };
}
