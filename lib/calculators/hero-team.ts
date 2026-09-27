import { HEROES, type Hero } from "../content/heroes.ts";

export function productionValue(hero: Hero, level = 1): { building: string; percent: number; requiredStars?: number } | null {
  if (!Number.isInteger(level) || level < 1) return null;
  const text = hero.production?.levels[level - 1];
  const match = text?.match(/^(?:Activates at (\d+)-Star\. )?Assign to (any building|the (.+)) for Resource Productivity \+(\d+(?:\.\d+)?)%\.$/);
  return match ? { building: match[3] ?? "*", percent: Number(match[4]), requiredStars: match[1] ? Number(match[1]) : undefined } : null;
}
export const PRODUCTION_BUILDINGS = [...new Set(HEROES.flatMap((hero) => {
  const value = productionValue(hero);
  return value && value.building !== "*" ? [value.building] : [];
}))].sort();
export type Producer = { id: string; stars: number; productionLevel: number };
export type ProductionSlot = { building: string; baseRate: number };

/** Maximum-weight one-to-one assignment; dummy columns leave a building unstaffed. */
export function simulateProduction(heroes: Producer[], slots: ProductionSlot[], hours: number) {
  if (!slots.length || slots.length > 25 || !Number.isFinite(hours) || hours < 0 || hours > 168 || new Set(heroes.map((hero) => hero.id)).size !== heroes.length) throw new RangeError("production");
  if (slots.some((slot) => !PRODUCTION_BUILDINGS.includes(slot.building) || !Number.isFinite(slot.baseRate) || slot.baseRate < 0 || slot.baseRate > 1e12)) throw new RangeError("production");
  const pool = [...heroes].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const values = pool.map((own) => {
    const hero = HEROES.find((entry) => entry.id === own.id);
    if (!hero || !Number.isInteger(own.stars) || own.stars < 0 || !Number.isInteger(own.productionLevel) || own.productionLevel < 1 || own.productionLevel > (hero.production?.levels.length ?? 0)) throw new RangeError("production");
    const value = productionValue(hero, own.productionLevel);
    return value && (value.requiredStars ?? 0) <= own.stars ? value : null;
  });
  const n = slots.length, m = pool.length + n;
  const gain = slots.map((slot) => Array.from({ length: m }, (_, j) => j >= pool.length ? 0 : values[j] && (values[j]!.building === "*" || values[j]!.building === slot.building) ? slot.baseRate * values[j]!.percent / 100 : -1e15));
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), match = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    match[0] = i;
    let j0 = 0;
    const min = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = match[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const current = -gain[i0 - 1][j - 1] - u[i0] - v[j];
        if (current < min[j]) { min[j] = current; way[j] = j0; }
        if (min[j] < delta) { delta = min[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) { if (used[j]) { u[match[j]] += delta; v[j] -= delta; } else min[j] -= delta; }
      j0 = j1;
    } while (match[j0] !== 0);
    do { const j1 = way[j0]; match[j0] = match[j1]; j0 = j1; } while (j0);
  }
  const assigned = Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (match[j]) assigned[match[j] - 1] = j - 1;
  const assignments = slots.map((slot, i) => {
    const j = assigned[i], valid = j >= 0 && j < pool.length && gain[i][j] > 0;
    return { ...slot, hero: valid ? pool[j].id : null, bonus: valid ? values[j]!.percent : 0, rate: slot.baseRate + (valid ? gain[i][j] : 0) };
  });
  const rate = assignments.reduce((sum, slot) => sum + slot.rate, 0);
  const baseline = slots.reduce((sum, slot) => sum + slot.baseRate, 0);
  const timeline = Array.from({ length: Math.ceil(hours) + 1 }, (_, i) => ({ hour: Math.min(i, hours), total: Math.min(i, hours) * rate, baseline: Math.min(i, hours) * baseline }));
  return { assignments, rate, total: hours * rate, baseline: hours * baseline, timeline };
}
