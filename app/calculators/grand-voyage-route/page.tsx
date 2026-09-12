"use client";

import { useMemo, useState } from "react";
import { CalculatorHeader } from "../../components/CalculatorHeader";
import { useLocale } from "../../components/LocaleProvider";
import {
  calculateRoute,
  formatDuration,
  MAX_ROUTE_CITIES,
  MIN_ROUTE_CITIES,
  ROUTE_CITIES,
} from "../../../lib/calculators/grand-voyage-route";

export default function GrandVoyageRoutePage() {
  const { t, tf, n } = useLocale();
  const [route, setRoute] = useState<string[]>([ROUTE_CITIES[0], ROUTE_CITIES[1]]);

  const result = useMemo(() => {
    try {
      return calculateRoute(route);
    } catch {
      return null;
    }
  }, [route]);

  const units = { hour: t.units.hour, minute: t.units.minute };
  const updateCity = (index: number, city: string) =>
    setRoute((current) => current.map((value, itemIndex) => (itemIndex === index ? city : value)));

  return (
    <>
      <CalculatorHeader
        eyebrow={t.calculator.routeEyebrow}
        title={t.tools.route.name}
        description={t.calculator.routeIntro}
      />
      <section className="route-builder surface">
        <div className="route-controls">
          <div className="section-heading compact-heading">
            <h2>{t.calculator.routeOrder}</h2>
            <button
              type="button"
              className="small-button"
              disabled={route.length >= MAX_ROUTE_CITIES}
              onClick={() =>
                setRoute((current) => [
                  ...current,
                  ROUTE_CITIES.find((city) => !current.includes(city)) ?? ROUTE_CITIES[0],
                ])
              }
            >
              {t.calculator.routeAddCity}
            </button>
          </div>
          {route.map((city, index) => (
            <div className="route-row" key={`${index}-${city}`}>
              <span>{index + 1}</span>
              <select
                aria-label={tf(t.calculator.routeCityLabel, { index: index + 1 })}
                value={city}
                onChange={(event) => updateCity(index, event.target.value)}
              >
                {ROUTE_CITIES.map((option) => (
                  <option disabled={option !== city && route.includes(option)} key={option}>
                    {option}
                  </option>
                ))}
              </select>
              {route.length > MIN_ROUTE_CITIES && (
                <button
                  type="button"
                  aria-label={tf(t.calculator.routeRemove, { city })}
                  onClick={() =>
                    setRoute((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {result && (
          <div className="route-results" aria-live="polite">
            <div className="metric-grid">
              <div>
                <span>{t.calculator.routeTravelTime}</span>
                <strong>{formatDuration(result.totalTravelHours, units)}</strong>
              </div>
              <div>
                <span>{t.calculator.routeTotalProfit}</span>
                <strong>{n(result.totalProfit)}</strong>
              </div>
              <div>
                <span>{t.calculator.routeProfitPerHour}</span>
                <strong>{n(result.profitPerHour, { maximumFractionDigits: 0 })}</strong>
              </div>
            </div>
            <h3>{result.completeRoute.join(" → ")}</h3>
            <div className="leg-list">
              {result.legs.map((leg) => (
                <div key={`${leg.origin}-${leg.destination}`}>
                  <span>
                    {leg.origin} → {leg.destination}
                  </span>
                  <span>
                    {formatDuration(leg.travelHours, units)} · {leg.profit >= 0 ? "+" : ""}
                    {n(leg.profit)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <details className="assumption">
        <summary>{t.calculator.routeAssumptionsTitle}</summary>
        <ul>
          {t.routeAssumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
        <p>{t.calculator.routeNote}</p>
      </details>
    </>
  );
}
