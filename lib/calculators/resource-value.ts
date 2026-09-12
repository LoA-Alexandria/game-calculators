export function calculateResourceValue(items: number, pointsPerItem: number): number {
  if (!Number.isFinite(items) || !Number.isFinite(pointsPerItem)) return 0;
  return Math.max(0, items) * Math.max(0, pointsPerItem);
}
