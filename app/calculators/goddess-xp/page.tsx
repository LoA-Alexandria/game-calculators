"use client";

import { useMemo, useState } from "react";
import { CalculatorHeader } from "../../components/CalculatorHeader";
import { calculateGoddessXp, MAX_GODDESS_LEVEL } from "../../../lib/calculators/goddess-xp";

export default function GoddessXpPage() {
  const [current, setCurrent] = useState("1");
  const [intended, setIntended] = useState("12");
  const result = useMemo(() => {
    try { return { value: calculateGoddessXp(Number(current), Number(intended)), error: "" }; }
    catch (error) { return { value: 0, error: error instanceof Error ? error.message : "Invalid levels." }; }
  }, [current, intended]);

  return <main className="calculator-shell"><CalculatorHeader eyebrow="Goddess progression" title="Goddess XP" description={`Calculate the XP needed between two Goddess levels. Levels 1–${MAX_GODDESS_LEVEL} are supported.`} /><section className="calculator-panel" aria-label="Goddess XP calculator"><div className="calculator-form"><div className="field"><label htmlFor="current">Current level</label><input id="current" min="1" max="149" step="1" type="number" value={current} onChange={(event) => setCurrent(event.target.value)} /></div><div className="field"><label htmlFor="intended">Intended level</label><input id="intended" min="2" max="150" step="1" type="number" value={intended} onChange={(event) => setIntended(event.target.value)} /></div></div><div className="result-panel" aria-live="polite"><span className="result-label">Total XP needed</span><strong className="result-number">{result.error ? "—" : result.value.toLocaleString()}</strong><span className={result.error ? "result-error" : "result-note"}>{result.error || `Level ${current} → ${intended}`}</span></div></section><p className="assumption">XP values were copied from Pop Bot’s Goddess level dataset. Update the versioned data and tests together when the source changes.</p></main>;
}
