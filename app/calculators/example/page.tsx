"use client";

import { useMemo, useState } from "react";
import { CalculatorHeader } from "../../components/CalculatorHeader";
import { useLocale } from "../../components/LocaleProvider";
import { calculateResourceValue } from "../../../lib/calculators/resource-value";

/**
 * Reference implementation. Copy this file when adding a calculator: it shows
 * the header, the panel layout, and how text is read from the dictionary
 * rather than written inline.
 */
export default function ExampleCalculator() {
  const { t, tf, n } = useLocale();
  const [items, setItems] = useState("25");
  const [value, setValue] = useState("4");
  const total = useMemo(() => calculateResourceValue(Number(items), Number(value)), [items, value]);

  return (
    <>
      <CalculatorHeader
        eyebrow={t.calculator.exampleEyebrow}
        title={t.tools.example.name}
        description={t.calculator.exampleIntro}
      />
      <section className="calculator-panel" aria-label={t.tools.example.name}>
        <div className="calculator-form">
          <div className="field">
            <label htmlFor="items">{t.calculator.exampleItems}</label>
            <input
              id="items"
              min="0"
              inputMode="numeric"
              type="number"
              value={items}
              onChange={(event) => setItems(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="value">{t.calculator.exampleValue}</label>
            <input
              id="value"
              min="0"
              inputMode="numeric"
              type="number"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        </div>
        <div className="result-panel" aria-live="polite">
          <span className="result-label">{t.calculator.exampleResult}</span>
          <strong className="result-number">{n(total)}</strong>
          <span className="result-note">
            {tf(t.calculator.exampleNote, { items: items || 0, value: value || 0 })}
          </span>
        </div>
      </section>
    </>
  );
}
