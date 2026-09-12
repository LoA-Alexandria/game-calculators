"use client";

import { useMemo, useState } from "react";
import { CalculatorHeader } from "../../components/CalculatorHeader";
import { useLocale } from "../../components/LocaleProvider";
import { useCalculatorError } from "../../components/useCalculatorError";
import {
  calculateGoddessXp,
  MAX_GODDESS_LEVEL,
  MIN_GODDESS_LEVEL,
} from "../../../lib/calculators/goddess-xp";

export default function GoddessXpPage() {
  const { t, tf, n } = useLocale();
  const describeError = useCalculatorError();
  const [current, setCurrent] = useState("1");
  const [intended, setIntended] = useState("12");

  const result = useMemo(() => {
    try {
      return { value: calculateGoddessXp(Number(current), Number(intended)), error: "" };
    } catch (error) {
      return { value: 0, error: describeError(error) };
    }
    // `describeError` is rebuilt whenever the language changes, which is exactly
    // when the message needs recomputing.
  }, [current, intended, describeError]);

  return (
    <>
      <CalculatorHeader
        eyebrow={t.calculator.goddessXpEyebrow}
        title={t.tools.goddessXp.name}
        description={tf(t.calculator.goddessXpIntro, {
          min: MIN_GODDESS_LEVEL,
          max: MAX_GODDESS_LEVEL,
        })}
      />
      <section className="calculator-panel" aria-label={t.tools.goddessXp.name}>
        <div className="calculator-form">
          <div className="field">
            <label htmlFor="current">{t.calculator.goddessXpFrom}</label>
            <input
              id="current"
              min={MIN_GODDESS_LEVEL}
              max={MAX_GODDESS_LEVEL - 1}
              step="1"
              type="number"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="intended">{t.calculator.goddessXpTo}</label>
            <input
              id="intended"
              min={MIN_GODDESS_LEVEL + 1}
              max={MAX_GODDESS_LEVEL}
              step="1"
              type="number"
              value={intended}
              onChange={(event) => setIntended(event.target.value)}
            />
          </div>
        </div>
        <div className="result-panel" aria-live="polite">
          <span className="result-label">{t.calculator.goddessXpResult}</span>
          <strong className="result-number">{result.error ? "—" : n(result.value)}</strong>
          <span className={result.error ? "result-error" : "result-note"}>
            {result.error || tf(t.calculator.goddessXpRange, { from: current, to: intended })}
          </span>
        </div>
      </section>
      <p className="assumption">{t.calculator.goddessXpNote}</p>
    </>
  );
}
