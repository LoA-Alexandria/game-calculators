import { CalculatorError } from "./errors.ts";

const XP_BY_CURRENT_LEVEL = [
  7,11,15,19,23,27,31,35,39,9,13,17,21,25,29,33,37,41,45,19,23,27,31,35,39,43,47,51,55,29,
  33,37,41,45,49,53,57,61,65,69,73,77,81,85,59,63,67,71,75,49,53,57,61,65,69,73,77,81,85,59,
  63,67,71,75,79,83,87,91,95,69,73,77,81,85,89,93,97,101,105,79,83,87,91,95,99,103,107,111,115,89,
  93,97,101,105,109,113,117,121,125,99,103,107,111,115,119,123,127,131,135,109,113,117,121,125,129,133,137,141,145,119,
  123,127,131,135,139,143,147,151,155,129,133,137,141,145,149,153,157,161,162,163,164,165,166,167,168,169,170,171,172,
] as const;

export const MIN_GODDESS_LEVEL = 1;
export const MAX_GODDESS_LEVEL = 150;

export function calculateGoddessXp(currentLevel: number, intendedLevel: number): number {
  if (!Number.isInteger(currentLevel) || !Number.isInteger(intendedLevel)) {
    throw new CalculatorError("wholeNumbers", "Levels must be whole numbers.");
  }
  if (currentLevel < MIN_GODDESS_LEVEL || intendedLevel > MAX_GODDESS_LEVEL) {
    throw new CalculatorError("levelRange", `Levels must be between ${MIN_GODDESS_LEVEL} and ${MAX_GODDESS_LEVEL}.`, { min: MIN_GODDESS_LEVEL, max: MAX_GODDESS_LEVEL });
  }
  if (intendedLevel <= currentLevel) {
    throw new CalculatorError("intendedHigher", "Intended level must be higher than the current level.");
  }
  return XP_BY_CURRENT_LEVEL.slice(currentLevel - 1, intendedLevel - 1).reduce((sum, xp) => sum + xp, 0);
}
