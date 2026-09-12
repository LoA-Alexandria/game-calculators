import routeData from "../data/grand-voyage-routes.json" with { type: "json" };

export const MIN_ROUTE_CITIES = 2;
export const MAX_ROUTE_CITIES = 6;
export const ROUTE_CITIES = routeData.cities;
export const ROUTE_ASSUMPTIONS = routeData.assumptions;

export type RouteLeg = { origin: string; destination: string; travelHours: number; profit: number };

export function calculateRoute(selectedCities: string[]) {
  if (selectedCities.length < MIN_ROUTE_CITIES || selectedCities.length > MAX_ROUTE_CITIES) throw new Error(`Choose between ${MIN_ROUTE_CITIES} and ${MAX_ROUTE_CITIES} cities.`);
  if (new Set(selectedCities).size !== selectedCities.length) throw new Error("Each city can appear only once.");
  const indexes = selectedCities.map((city) => {
    const index = ROUTE_CITIES.indexOf(city);
    if (index < 0) throw new Error(`Unknown city: ${city}`);
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

export function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return wholeHours ? `${wholeHours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}
