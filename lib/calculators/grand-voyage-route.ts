import routeData from "../data/grand-voyage-routes.json" with { type: "json" };
import { CalculatorError } from "./errors.ts";

export const MIN_ROUTE_CITIES = 2;
export const MAX_ROUTE_CITIES = 6;
export const ROUTE_CITIES = routeData.cities;
export const ROUTE_ASSUMPTIONS = routeData.assumptions;

export type RouteLeg = { origin: string; destination: string; travelHours: number; profit: number };

export function calculateRoute(selectedCities: string[]) {
  if (selectedCities.length < MIN_ROUTE_CITIES || selectedCities.length > MAX_ROUTE_CITIES) throw new CalculatorError("routeCount", `Choose between ${MIN_ROUTE_CITIES} and ${MAX_ROUTE_CITIES} cities.`, { min: MIN_ROUTE_CITIES, max: MAX_ROUTE_CITIES });
  if (new Set(selectedCities).size !== selectedCities.length) throw new CalculatorError("routeDuplicate", "Each city can appear only once.");
  const indexes = selectedCities.map((city) => {
    const index = ROUTE_CITIES.indexOf(city);
    if (index < 0) throw new CalculatorError("unknownCity", `Unknown city: ${city}`, { city });
    return index;
  });
  const completeRoute = [...selectedCities, selectedCities[0]];
  const completeIndexes = [...indexes, indexes[0]];
  const legs: RouteLeg[] = completeIndexes.slice(0, -1).map((originIndex, index) => {
    const destinationIndex = completeIndexes[index + 1];
    return {
      origin: completeRoute[index], destination: completeRoute[index + 1],
      travelHours: routeData.time_days[originIndex][destinationIndex] * 24,
      profit: Math.trunc(routeData.profits[originIndex][destinationIndex]),
    };
  });
  const totalTravelHours = legs.reduce((sum, leg) => sum + leg.travelHours, 0);
  const totalProfit = legs.reduce((sum, leg) => sum + leg.profit, 0);
  return { selectedCities, completeRoute, legs, totalTravelHours, totalProfit, profitPerHour: totalProfit / totalTravelHours };
}

/**
 * `units` lets the interface pass localised abbreviations. The defaults keep the
 * original English output ("2h 01m"), which the tests pin.
 */
export function formatDuration(
  hours: number,
  units: { hour: string; minute: string } = { hour: "h", minute: "m" },
): string {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return wholeHours
    ? `${wholeHours}${units.hour} ${String(minutes).padStart(2, "0")}${units.minute}`
    : `${minutes}${units.minute}`;
}
