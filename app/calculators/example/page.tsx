"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateResourceValue } from "../../../lib/calculators/resource-value";

export default function ExampleCalculator() {
  const [items, setItems] = useState("25");
  const [value, setValue] = useState("4");
  const total = useMemo(() => {
    return calculateResourceValue(Number(items), Number(value));
  }, [items, value]);

  return (
    <main className="calculator-shell">
      <Link className="back-link" href="/">← All calculators</Link>
      <header>
        <div className="eyebrow">Reference implementation</div>
        <h1>Resource value</h1>
        <p>Multiply an item quantity by its point value. Copy this page when adding a calculator, then replace the example inputs and formula.</p>
      </header>
      <section className="calculator-panel" aria-label="Resource value calculator">
        <div className="calculator-form">
          <div className="field">
            <label htmlFor="items">Number of items</label>
            <input id="items" min="0" inputMode="numeric" type="number" value={items} onChange={(event) => setItems(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="value">Points per item</label>
            <input id="value" min="0" inputMode="numeric" type="number" value={value} onChange={(event) => setValue(event.target.value)} />
          </div>
        </div>
        <div className="result-panel" aria-live="polite">
          <span className="result-label">Total value</span>
          <strong className="result-number">{total.toLocaleString()}</strong>
          <span className="result-note">{items || 0} items × {value || 0} points</span>
        </div>
      </section>
    </main>
  );
}
