"use client";

import { useMemo, useState } from "react";
import { CalculatorHeader } from "../../components/CalculatorHeader";
import { useLocale } from "../../components/LocaleProvider";
import { useCalculatorError } from "../../components/useCalculatorError";
import { buildUpgradePlan, CITIES } from "../../../lib/calculators/city-upgrades";

export default function CityUpgradePage() {
  const { t, tf, n } = useLocale();
  const describeError = useCalculatorError();
  const [cityName, setCityName] = useState(CITIES[0].name);
  const [current, setCurrent] = useState("0");
  const [target, setTarget] = useState("1");
  const [peerLevels, setPeerLevels] = useState<Record<string, string>>({});

  const city = CITIES.find((item) => item.name === cityName) ?? CITIES[0];
  const peers = useMemo(
    () => CITIES.filter((item) => item.group === city.group && item.name !== city.name),
    [city],
  );

  /** City names are proper nouns and stay as they are; the type is translated. */
  const cityTypes = t.cityTypes as Record<string, string>;

  const result = useMemo(() => {
    try {
      return {
        plan: buildUpgradePlan(
          city.name,
          Number(current),
          Number(target),
          Object.fromEntries(peers.map((peer) => [peer.name, Number(peerLevels[peer.name] ?? 0)])),
        ),
        error: "",
      };
    } catch (error) {
      return { plan: null, error: describeError(error) };
    }
  }, [city, current, target, peerLevels, peers, describeError]);

  return (
    <>
      <CalculatorHeader
        eyebrow={t.calculator.cityEyebrow}
        title={t.tools.cityUpgrade.name}
        description={t.calculator.cityIntro}
      />
      <section className="upgrade-layout surface">
        <div className="calculator-form">
          <div className="field">
            <label htmlFor="city">{t.calculator.cityTarget}</label>
            <select
              id="city"
              value={cityName}
              onChange={(event) => {
                setCityName(event.target.value);
                setPeerLevels({});
              }}
            >
              {CITIES.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} · {cityTypes[item.type]}
                </option>
              ))}
            </select>
          </div>
          <div className="input-row">
            <div className="field">
              <label htmlFor="current">{t.calculator.cityCurrent}</label>
              <input
                id="current"
                min="0"
                max={city.maximumLevel}
                type="number"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="target">{t.calculator.cityDesired}</label>
              <input
                id="target"
                min="1"
                max={city.maximumLevel}
                type="number"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </div>
          </div>
          {result.plan && result.plan.requiredGroupLevel > 0 && (
            <fieldset>
              <legend>
                {t.calculator.cityGroupLevels}
                <span>
                  {tf(t.calculator.cityGroupRequired, { level: result.plan.requiredGroupLevel })}
                </span>
              </legend>
              {peers.map((peer) => (
                <div className="field compact" key={peer.name}>
                  <label htmlFor={`peer-${peer.name}`}>{peer.name}</label>
                  <input
                    id={`peer-${peer.name}`}
                    min="0"
                    max={peer.maximumLevel}
                    type="number"
                    value={peerLevels[peer.name] ?? "0"}
                    onChange={(event) =>
                      setPeerLevels((levels) => ({ ...levels, [peer.name]: event.target.value }))
                    }
                  />
                </div>
              ))}
            </fieldset>
          )}
        </div>
        <div className="result-panel" aria-live="polite">
          <span className="result-label">{t.calculator.cityResult}</span>
          <strong className="result-number">{result.plan ? n(result.plan.totalCost) : "—"}</strong>
          {result.error && <span className="result-error">{result.error}</span>}
          {result.plan && (
            <div className="result-breakdown">
              <span>
                {city.name}: {n(result.plan.targetCost)}
              </span>
              {result.plan.prerequisites.map((item) => (
                <span key={item.city.name}>
                  {item.city.name} {tf(t.calculator.cityToLevel, { level: item.targetLevel })}:{" "}
                  {n(item.cost)}
                </span>
              ))}
              {result.plan.prerequisites.length === 0 && <span>{t.calculator.cityNoPeers}</span>}
            </div>
          )}
        </div>
      </section>
      <p className="assumption">{t.calculator.cityNote}</p>
    </>
  );
}
