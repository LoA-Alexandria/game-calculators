import costs from "./signet-ring-costs.json" with { type: "json" };
import { CalculatorError } from "./errors.ts";

export const MAXIMUM_SIGNET_LEVEL = costs.maximumLevel;

export type SignetRingCost = {
  currentLevel: number;
  targetLevel: number;
  coins: number;
  signetRings: number;
  ascensions: Array<{ afterLevel: number; rings: number }>;
};

/** Sums destination-level costs; an ASCEND marker is charged only if the target passes it. */
export function calculateSignetRingCost(currentLevel: number, targetLevel: number): SignetRingCost {
  for (const level of [currentLevel, targetLevel]) {
    if (!Number.isInteger(level)) {
      throw new CalculatorError("wholeNumbers", "Levels must be whole numbers.");
    }
    if (level < 1 || level > MAXIMUM_SIGNET_LEVEL) {
      throw new CalculatorError("levelRange", `Levels must be between 1 and ${MAXIMUM_SIGNET_LEVEL}.`, {
        min: 1,
        max: MAXIMUM_SIGNET_LEVEL,
      });
    }
  }
  if (targetLevel < currentLevel) {
    throw new CalculatorError("targetNotLower", "The target level cannot be lower than the current level.");
  }

  const coins = costs.levelCosts.slice(currentLevel, targetLevel).reduce((total, cost) => total + cost, 0);
  const ascensions = Object.entries(costs.ascensionRings)
    .map(([afterLevel, rings]) => ({ afterLevel: Number(afterLevel), rings }))
    .filter(({ afterLevel }) => currentLevel <= afterLevel && afterLevel < targetLevel)
    .sort((a, b) => a.afterLevel - b.afterLevel);

  return {
    currentLevel,
    targetLevel,
    coins,
    signetRings: ascensions.reduce((total, ascension) => total + ascension.rings, 0),
    ascensions,
  };
}
