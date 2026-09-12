"use client";

import { useMemo, useState } from "react";
import { CalculatorHeader } from "../../components/CalculatorHeader";
import { buildUpgradePlan, CITIES } from "../../../lib/calculators/city-upgrades";

export default function CityUpgradePage() {
  const [cityName, setCityName] = useState(CITIES[0].name);
  const city = CITIES.find((item) => item.name === cityName) ?? CITIES[0];
  const [current, setCurrent] = useState("0");
  const [target, setTarget] = useState("1");
  const peers = CITIES.filter((item) => item.group === city.group && item.name !== city.name);
  const [peerLevels, setPeerLevels] = useState<Record<string, string>>({});
  const result = useMemo(() => {
    try { return { plan: buildUpgradePlan(city.name, Number(current), Number(target), Object.fromEntries(peers.map((peer) => [peer.name, Number(peerLevels[peer.name] ?? 0)]))), error: "" }; }
    catch (error) { return { plan: null, error: error instanceof Error ? error.message : "Invalid levels." }; }
  }, [city, current, target, peerLevels, peers]);

  return <main className="calculator-shell calculator-wide"><CalculatorHeader eyebrow="Grand Voyage" title="City upgrade" description="Calculate the Bills of Exchange needed for a target city and any required group milestones." /><section className="upgrade-layout"><div className="calculator-form surface"><div className="field"><label htmlFor="city">Target city</label><select id="city" value={cityName} onChange={(event) => { setCityName(event.target.value); setPeerLevels({}); }}>{CITIES.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.type}</option>)}</select></div><div className="input-row"><div className="field"><label htmlFor="current">Current level</label><input id="current" min="0" max={city.maximumLevel} type="number" value={current} onChange={(event) => setCurrent(event.target.value)} /></div><div className="field"><label htmlFor="target">Desired level</label><input id="target" min="1" max={city.maximumLevel} type="number" value={target} onChange={(event) => setTarget(event.target.value)} /></div></div>{result.plan && result.plan.requiredGroupLevel > 0 && <fieldset><legend>Current group levels <span>Required: {result.plan.requiredGroupLevel}</span></legend>{peers.map((peer) => <div className="field compact" key={peer.name}><label htmlFor={`peer-${peer.name}`}>{peer.name}</label><input id={`peer-${peer.name}`} min="0" max={peer.maximumLevel} type="number" value={peerLevels[peer.name] ?? "0"} onChange={(event) => setPeerLevels((levels) => ({ ...levels, [peer.name]: event.target.value }))} /></div>)}</fieldset>}</div><div className="result-panel" aria-live="polite"><span className="result-label">Total Bills of Exchange</span><strong className="result-number">{result.plan ? result.plan.totalCost.toLocaleString() : "—"}</strong>{result.error && <span className="result-error">{result.error}</span>}{result.plan && <div className="result-breakdown"><span>{city.name}: {result.plan.targetCost.toLocaleString()}</span>{result.plan.prerequisites.map((item) => <span key={item.city.name}>{item.city.name} → level {item.targetLevel}: {item.cost.toLocaleString()}</span>)}{result.plan.prerequisites.length === 0 && <span>No peer-city upgrades required.</span>}</div>}</div></section><p className="assumption">Upgrade prices belong to the destination level. Group gates occur every five levels and do not themselves cost Bills. Towns and Cities support level 30; Metropolises support level 35.</p></main>;
}
