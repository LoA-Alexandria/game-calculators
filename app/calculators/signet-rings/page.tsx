"use client";

import { useMemo, useState } from "react";
import { CalculatorHeader } from "../../components/CalculatorHeader";
import { useLocale } from "../../components/LocaleProvider";
import { useCalculatorError } from "../../components/useCalculatorError";
import { calculateSignetRingCost, MAXIMUM_SIGNET_LEVEL } from "../../../lib/calculators/signet-ring-cost";

export default function SignetRingsPage() {
  const { t, n } = useLocale();
  const describeError = useCalculatorError();
  const [current, setCurrent] = useState("1");
  const [target, setTarget] = useState("20");

  const result = useMemo(() => {
    try {
      return { value: calculateSignetRingCost(Number(current), Number(target)), error: "" };
    } catch (error) {
      return { value: null, error: describeError(error) };
    }
  }, [current, target, describeError]);

  return (
    <>
      <CalculatorHeader
        eyebrow={t.calculator.signetEyebrow}
        title={t.tools.signetRings.name}
        description={t.calculator.signetIntro}
      />
      <section className="upgrade-layout surface">
        <div className="calculator-form">
          <div className="input-row">
            <div className="field">
              <label htmlFor="signet-current">{t.calculator.signetFrom}</label>
              <input id="signet-current" type="number" min="1" max={MAXIMUM_SIGNET_LEVEL} step="1" value={current} onChange={(event) => setCurrent(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="signet-target">{t.calculator.signetTo}</label>
              <input id="signet-target" type="number" min="1" max={MAXIMUM_SIGNET_LEVEL} step="1" value={target} onChange={(event) => setTarget(event.target.value)} />
            </div>
          </div>
          <p className="assumption">{t.calculator.signetRange}</p>
        </div>
        <div className="result-panel" aria-live="polite">
          <span className="result-label">{t.calculator.signetCoins}</span>
          <strong className="result-number">{result.value ? n(result.value.coins) : "—"}</strong>
          <div className="result-breakdown signet-results">
            <span><strong>{result.value ? n(result.value.signetRings) : "—"}</strong> {t.calculator.signetRings}</span>
            {result.value?.ascensions.length ? result.value.ascensions.map((ascension) => (
              <span key={ascension.afterLevel}>
                {t.calculator.signetAscension.replace("{level}", n(ascension.afterLevel))}: {n(ascension.rings)}
              </span>
            )) : <span>{t.calculator.signetNoAscensions}</span>}
          </div>
          {result.error && <span className="result-error">{result.error}</span>}
        </div>
      </section>
      <p className="assumption">{t.calculator.signetNote}</p>
    </>
  );
}
