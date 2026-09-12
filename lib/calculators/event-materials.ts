export type MaterialLine = {
  name: string;
  quantity: number;
  pointsEach: number;
  points: number;
};

function wholeNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function calculateMaterials(
  materials: Array<{ name: string; quantity: number; pointsEach: number }>,
) {
  const lines: MaterialLine[] = materials.map((material) => {
    const quantity = wholeNonNegative(material.quantity);
    return { ...material, quantity, points: quantity * material.pointsEach };
  });
  return { lines, total: lines.reduce((sum, line) => sum + line.points, 0) };
}

export const GODDESS_MATERIALS = [
  { key: "olive", name: "Olive Branch", pointsEach: 1 },
  { key: "corolla", name: "Corolla", pointsEach: 3 },
  { key: "tribute", name: "Tribute Plate", pointsEach: 10 },
] as const;

export const RED_CARPET_MATERIALS = [
  { key: "cheer", name: "Cheer Stick", pointsEach: 100 },
  { key: "clapper", name: "Clapper", pointsEach: 200 },
  { key: "camera", name: "Vintage Camera", pointsEach: 500 },
] as const;
