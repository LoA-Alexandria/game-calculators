"use client";

import { useMemo, useState } from "react";
import { calculateMaterials } from "../../lib/calculators/event-materials";

type Material = { key: string; name: string; pointsEach: number };

export function MaterialsCalculator({ materials, resultLabel = "Total points" }: { materials: readonly Material[]; resultLabel?: string }) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(materials.map((item) => [item.key, "0"])));
  const result = useMemo(() => calculateMaterials(materials.map((item) => ({ ...item, quantity: Number(quantities[item.key]) }))), [materials, quantities]);

  return (
    <section className="calculator-panel" aria-label="Materials calculator">
      <div className="calculator-form">
        {materials.map((material) => (
          <div className="field" key={material.key}>
            <label htmlFor={material.key}>{material.name} <span className="label-note">× {material.pointsEach.toLocaleString()} points</span></label>
            <input id={material.key} min="0" step="1" inputMode="numeric" type="number" value={quantities[material.key]} onChange={(event) => setQuantities((current) => ({ ...current, [material.key]: event.target.value }))} />
          </div>
        ))}
      </div>
      <div className="result-panel" aria-live="polite">
        <span className="result-label">{resultLabel}</span>
        <strong className="result-number">{result.total.toLocaleString()}</strong>
        <div className="result-breakdown">
          {result.lines.filter((line) => line.quantity > 0).map((line) => <span key={line.name}>{line.quantity.toLocaleString()} {line.name} = {line.points.toLocaleString()}</span>)}
          {result.total === 0 && <span>Enter your materials to calculate their value.</span>}
        </div>
      </div>
    </section>
  );
}
