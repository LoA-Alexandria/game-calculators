"use client";

import { useMemo, useState } from "react";
import { calculateMaterials } from "../../lib/calculators/event-materials";
import { useLocale } from "./LocaleProvider";

type Material = { key: string; pointsEach: number };

/**
 * A material's `key` is also its lookup in `materials.<key>` in the dictionary,
 * so item names follow the reader's language while the point values stay
 * versioned code.
 */
export function MaterialsCalculator({
  materials,
  resultLabel,
}: {
  materials: readonly Material[];
  resultLabel?: string;
}) {
  const { t, tf, n } = useLocale();
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(materials.map((item) => [item.key, "0"])),
  );

  const names = t.materials as Record<string, string>;
  const result = useMemo(
    () =>
      calculateMaterials(
        materials.map((item) => ({
          name: item.key,
          pointsEach: item.pointsEach,
          quantity: Number(quantities[item.key]),
        })),
      ),
    [materials, quantities],
  );

  return (
    <section className="calculator-panel" aria-label={resultLabel ?? t.calculator.materialsResult}>
      <div className="calculator-form">
        {materials.map((material) => (
          <div className="field" key={material.key}>
            <label htmlFor={material.key}>
              {names[material.key]}{" "}
              <span className="label-note">
                {tf(t.calculator.materialsPointsEach, { points: n(material.pointsEach) })}
              </span>
            </label>
            <input
              id={material.key}
              min="0"
              step="1"
              inputMode="numeric"
              type="number"
              value={quantities[material.key]}
              onChange={(event) =>
                setQuantities((current) => ({ ...current, [material.key]: event.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <div className="result-panel" aria-live="polite">
        <span className="result-label">{resultLabel ?? t.calculator.materialsResult}</span>
        <strong className="result-number">{n(result.total)}</strong>
        <div className="result-breakdown">
          {result.lines
            .filter((line) => line.quantity > 0)
            .map((line) => (
              <span key={line.name}>
                {n(line.quantity)} {names[line.name]} = {n(line.points)}
              </span>
            ))}
          {result.total === 0 && <span>{t.calculator.materialsPrompt}</span>}
        </div>
      </div>
    </section>
  );
}
