/**
 * Pure state logic for the Grand Voyage data editor.
 *
 * Two files: the route matrix — every city against every other, in travel days
 * and reference profit — and one observed shipwreck cargo with the prices it
 * sold for. Both came out of spreadsheets, and that is still where the numbers
 * are gathered, so the editor can take a pasted block as readily as a single
 * corrected cell.
 *
 * Numbers stay strings while they are edited, because a half-typed "0.08" is
 * not a number yet and turning it into one would eat the keystroke.
 */

import routeData from "../data/grand-voyage-routes.json" with { type: "json" };
import shipwreckData from "../data/grand-voyage-shipwreck-observation.json" with { type: "json" };

export type RouteData = {
  source: string;
  assumptions: string[];
  cities: string[];
  time_days: number[][];
  profits: number[][];
};

export type ShipwreckData = {
  source: string;
  effectiveDate: string;
  origin: string;
  cargo: Record<string, { quantity: number; buy: number }>;
  salePrices: Record<string, Record<string, number>>;
};

export const ROUTE_DATA = routeData as RouteData;
export const SHIPWRECK_DATA = shipwreckData as ShipwreckData;

export type VoyageEditorState = {
  version: 1;
  source: string;
  assumptions: string;
  cities: string[];
  /** Same shape as the file, one string per cell. */
  days: string[][];
  profits: string[][];
  shipwreck: {
    source: string;
    effectiveDate: string;
    origin: string;
    cargo: { good: string; quantity: string; buy: string }[];
    /** City, then one price per cargo good, in the order the cargo is listed. */
    prices: { city: string; prices: string[] }[];
  };
};

const text = (value: number): string => String(value);

export function fromVoyageData(routes: RouteData, shipwreck: ShipwreckData): VoyageEditorState {
  const goods = Object.keys(shipwreck.cargo);
  return {
    version: 1,
    source: routes.source,
    assumptions: routes.assumptions.join("\n"),
    cities: [...routes.cities],
    days: routes.time_days.map((row) => row.map(text)),
    profits: routes.profits.map((row) => row.map(text)),
    shipwreck: {
      source: shipwreck.source,
      effectiveDate: shipwreck.effectiveDate,
      origin: shipwreck.origin,
      cargo: goods.map((good) => ({
        good,
        quantity: text(shipwreck.cargo[good].quantity),
        buy: text(shipwreck.cargo[good].buy),
      })),
      prices: Object.entries(shipwreck.salePrices).map(([city, prices]) => ({
        city,
        prices: goods.map((good) => text(prices[good] ?? 0)),
      })),
    },
  };
}

/**
 * A number from a box, or `null` when the box does not hold one. Negatives are
 * numbers here: a leg can lose money, and the workbook says so.
 */
export function readCell(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setCell(
  state: VoyageEditorState,
  table: "days" | "profits",
  from: number,
  to: number,
  value: string,
): VoyageEditorState {
  return {
    ...state,
    [table]: state[table].map((row, index) =>
      index === from ? row.map((cell, column) => (column === to ? value : cell)) : row,
    ),
  };
}

export function setCity(state: VoyageEditorState, index: number, name: string): VoyageEditorState {
  const cities = state.cities.map((city, at) => (at === index ? name : city));
  const renamed = state.cities[index];
  const shipwreck = {
    ...state.shipwreck,
    origin: state.shipwreck.origin === renamed ? name : state.shipwreck.origin,
    prices: state.shipwreck.prices.map((row) => (row.city === renamed ? { ...row, city: name } : row)),
  };
  return { ...state, cities, shipwreck };
}

/** A new city is a new row and a new column, empty until somebody fills them. */
export function addCity(state: VoyageEditorState, name: string): VoyageEditorState {
  const size = state.cities.length + 1;
  const grow = (table: string[][]) => [
    ...table.map((row) => [...row, "0"]),
    Array.from({ length: size }, () => "0"),
  ];
  return { ...state, cities: [...state.cities, name], days: grow(state.days), profits: grow(state.profits) };
}

export function removeCity(state: VoyageEditorState, index: number): VoyageEditorState {
  const gone = state.cities[index];
  const shrink = (table: string[][]) =>
    table.filter((_, at) => at !== index).map((row) => row.filter((_, column) => column !== index));
  return {
    ...state,
    cities: state.cities.filter((_, at) => at !== index),
    days: shrink(state.days),
    profits: shrink(state.profits),
    shipwreck: {
      ...state.shipwreck,
      prices: state.shipwreck.prices.filter((row) => row.city !== gone),
    },
  };
}

export type PasteResult =
  | { ok: true; rows: string[][] }
  | { ok: false; reason: "empty" | "size"; rows: number; columns: number };

/**
 * A block pasted from a spreadsheet: rows on lines, cells between tabs or
 * semicolons. It has to be exactly as wide and as tall as the matrix, because
 * a block that is not is a block from somewhere else.
 */
export function parseMatrix(text: string, size: number): PasteResult {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, reason: "empty", rows: 0, columns: 0 };
  const rows = lines.map((line) => line.split(/[\t;]|\s{2,}/).map((cell) => cell.trim()).filter(Boolean));
  const columns = Math.max(...rows.map((row) => row.length));
  if (rows.length !== size || rows.some((row) => row.length !== size)) {
    return { ok: false, reason: "size", rows: rows.length, columns };
  }
  return { ok: true, rows };
}

export function setMatrix(state: VoyageEditorState, table: "days" | "profits", rows: string[][]): VoyageEditorState {
  return { ...state, [table]: rows.map((row) => [...row]) };
}

export function setShipwreck(
  state: VoyageEditorState,
  patch: Partial<Pick<VoyageEditorState["shipwreck"], "source" | "effectiveDate" | "origin">>,
): VoyageEditorState {
  return { ...state, shipwreck: { ...state.shipwreck, ...patch } };
}

export function setCargo(
  state: VoyageEditorState,
  index: number,
  patch: Partial<{ good: string; quantity: string; buy: string }>,
): VoyageEditorState {
  return {
    ...state,
    shipwreck: {
      ...state.shipwreck,
      cargo: state.shipwreck.cargo.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    },
  };
}

export function setPrice(state: VoyageEditorState, city: string, good: number, value: string): VoyageEditorState {
  return {
    ...state,
    shipwreck: {
      ...state.shipwreck,
      prices: state.shipwreck.prices.map((row) =>
        row.city === city ? { ...row, prices: row.prices.map((price, at) => (at === good ? value : price)) } : row,
      ),
    },
  };
}

/** The route file as it would be committed. A cell nobody filled counts as nothing. */
export function exportRoutes(state: VoyageEditorState): RouteData {
  const numbers = (table: string[][]) => table.map((row) => row.map((cell) => readCell(cell) ?? 0));
  return {
    source: state.source.trim(),
    assumptions: state.assumptions.split("\n").map((line) => line.trim()).filter(Boolean),
    cities: state.cities.map((city) => city.trim()),
    time_days: numbers(state.days),
    profits: numbers(state.profits),
  };
}

export function exportShipwreck(state: VoyageEditorState): ShipwreckData {
  const goods = state.shipwreck.cargo.map((row) => row.good.trim()).filter(Boolean);
  const cargo: ShipwreckData["cargo"] = {};
  state.shipwreck.cargo.forEach((row) => {
    const good = row.good.trim();
    if (!good) return;
    cargo[good] = { quantity: readCell(row.quantity) ?? 0, buy: readCell(row.buy) ?? 0 };
  });
  const salePrices: ShipwreckData["salePrices"] = {};
  for (const row of state.shipwreck.prices) {
    const city = row.city.trim();
    if (!city) continue;
    const prices: Record<string, number> = {};
    goods.forEach((good, index) => {
      prices[good] = readCell(row.prices[index] ?? "") ?? 0;
    });
    salePrices[city] = prices;
  }
  return {
    source: state.shipwreck.source.trim(),
    effectiveDate: state.shipwreck.effectiveDate.trim(),
    origin: state.shipwreck.origin.trim(),
    cargo,
    salePrices,
  };
}

export function countVoyageChanges(published: VoyageEditorState, draft: VoyageEditorState): number {
  const before = exportRoutes(published);
  const after = exportRoutes(draft);
  let changes = 0;
  if (before.source !== after.source) changes += 1;
  if (JSON.stringify(before.assumptions) !== JSON.stringify(after.assumptions)) changes += 1;
  if (JSON.stringify(before.cities) !== JSON.stringify(after.cities)) changes += 1;
  for (const table of ["time_days", "profits"] as const) {
    for (let row = 0; row < after[table].length; row++) {
      for (let column = 0; column < after[table][row].length; column++) {
        if (before[table][row]?.[column] !== after[table][row][column]) changes += 1;
      }
    }
  }
  if (JSON.stringify(exportShipwreck(published)) !== JSON.stringify(exportShipwreck(draft))) changes += 1;
  return changes;
}

export type VoyageProblem =
  | { code: "noCity"; index: number }
  | { code: "duplicateCity"; city: string }
  | { code: "badCell"; table: "days" | "profits"; from: string; to: string }
  | { code: "negativeDays"; from: string; to: string }
  | { code: "selfLeg"; city: string }
  | { code: "unknownOrigin"; city: string }
  | { code: "unknownPriceCity"; city: string };

export function findVoyageProblems(state: VoyageEditorState): VoyageProblem[] {
  const problems: VoyageProblem[] = [];
  const seen = new Set<string>();
  state.cities.forEach((city, index) => {
    const name = city.trim();
    if (!name) problems.push({ code: "noCity", index });
    else if (seen.has(name)) problems.push({ code: "duplicateCity", city: name });
    seen.add(name);
  });

  for (const table of ["days", "profits"] as const) {
    state[table].forEach((row, from) => {
      row.forEach((cell, to) => {
        const value = readCell(cell);
        if (value === null) {
          problems.push({
            code: "badCell",
            table,
            from: state.cities[from] ?? String(from),
            to: state.cities[to] ?? String(to),
          });
          return;
        }
        // A leg may lose money; it may not take less than no time.
        if (table === "days" && value < 0) {
          problems.push({
            code: "negativeDays",
            from: state.cities[from] ?? String(from),
            to: state.cities[to] ?? String(to),
          });
        }
        // A city cannot sail to itself; the workbook keeps those at nothing.
        if (from === to && readCell(cell) !== 0) {
          problems.push({ code: "selfLeg", city: state.cities[from] ?? String(from) });
        }
      });
    });
  }

  const known = new Set(state.cities.map((city) => city.trim()));
  if (state.shipwreck.origin.trim() && !known.has(state.shipwreck.origin.trim())) {
    problems.push({ code: "unknownOrigin", city: state.shipwreck.origin.trim() });
  }
  for (const row of state.shipwreck.prices) {
    if (row.city.trim() && !known.has(row.city.trim())) {
      problems.push({ code: "unknownPriceCity", city: row.city.trim() });
    }
  }
  return problems;
}

export function serializeVoyage(data: RouteData | ShipwreckData): string {
  return `${JSON.stringify(data)}\n`;
}

export function parseVoyageDraft(raw: string | null): VoyageEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as VoyageEditorState;
    if (value?.version !== 1 || !Array.isArray(value.cities)) return null;
    if (typeof value.source !== "string" || typeof value.assumptions !== "string") return null;
    for (const table of ["days", "profits"] as const) {
      if (!Array.isArray(value[table]) || value[table].length !== value.cities.length) return null;
      for (const row of value[table]) {
        if (!Array.isArray(row) || row.length !== value.cities.length) return null;
        if (row.some((cell) => typeof cell !== "string")) return null;
      }
    }
    const wreck = value.shipwreck;
    if (!wreck || typeof wreck.origin !== "string" || !Array.isArray(wreck.cargo) || !Array.isArray(wreck.prices)) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** The numbers as they are published right now. */
export const PUBLISHED_VOYAGE = fromVoyageData(ROUTE_DATA, SHIPWRECK_DATA);
