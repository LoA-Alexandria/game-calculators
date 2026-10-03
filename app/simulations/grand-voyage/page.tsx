"use client";

import { useEffect, useMemo, useState } from "react";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { BackLink, PageHead } from "../../components/Ui";
import { formatDuration } from "../../../lib/calculators/grand-voyage-route";
import { type RouteData } from "../../../lib/calculators/grand-voyage-route";
import { useGuideData } from "../../guides/GuideOverrides";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import { PenIcon } from "../../components/Icons";
import {
  DEFAULT_VOYAGE_PROFILE, levelForCity, nextCityUpgrade, observedShipwreckShipments, optimizeVoyageRoutes,
  VOYAGE_CITIES, VOYAGE_REGIONS, type VoyageData, type VoyageProfile,
} from "../../../lib/calculators/grand-voyage-simulator";

const STORAGE_KEY = "popepoch-grand-voyage-profile-v1";
const cryptidOptions = ["", "Dreiköpfiger Hund", "Weißer Vogel", "Blaues Pony"];

function restoreProfile(raw: string | null): VoyageProfile {
  if (!raw) return DEFAULT_VOYAGE_PROFILE;
  try {
    const saved = JSON.parse(raw) as Partial<VoyageProfile>;
    return {
      ...DEFAULT_VOYAGE_PROFILE, ...saved,
      ship: { ...DEFAULT_VOYAGE_PROFILE.ship, ...saved.ship },
      cryptids: { ...DEFAULT_VOYAGE_PROFILE.cryptids, ...saved.cryptids },
      unlockedRegions: Array.isArray(saved.unlockedRegions) ? saved.unlockedRegions : DEFAULT_VOYAGE_PROFILE.unlockedRegions,
      regionLevels: saved.regionLevels && typeof saved.regionLevels === "object" ? saved.regionLevels : {},
      cityLevels: saved.cityLevels && typeof saved.cityLevels === "object" ? saved.cityLevels : {},
    };
  } catch { return DEFAULT_VOYAGE_PROFILE; }
}

export default function GrandVoyageSimulationPage() {
  const { t, n } = useLocale();
  const s = t.voyageSimulator;
  useDocumentTitle(s.title);
  const [profile, setProfile] = useState<VoyageProfile>(DEFAULT_VOYAGE_PROFILE);
  const [ready, setReady] = useState(false);
  const [maxStops, setMaxStops] = useState<2 | 3>(3);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(restoreProfile(localStorage.getItem(STORAGE_KEY)));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }, [profile, ready]);
  // The build carries the numbers; a published edit lies over them a moment later.
  const { allows } = useAuth();
  const routes = useGuideData<RouteData>("grand-voyage-routes");
  const shipwreck = useGuideData<VoyageData["shipwreck"]>("grand-voyage-shipwreck-observation");
  const voyage: VoyageData = useMemo(() => ({ routes, shipwreck }), [routes, shipwreck]);
  const calculation = useMemo(() => {
    try { return { routes: optimizeVoyageRoutes(profile, maxStops, 5, voyage), shipments: observedShipwreckShipments(profile, voyage), error: "" }; }
    catch (error) { return { routes: [], shipments: [], error: error instanceof Error ? error.message : String(error) }; }
  }, [profile, maxStops, voyage]);
  const update = (patch: Partial<VoyageProfile>) => setProfile((old) => ({ ...old, ...patch }));
  const best = calculation.routes[0];
  const upgrades = best?.cities.map((city) => nextCityUpgrade(profile, city)).filter((item) => item !== null) ?? [];
  return (
    <>
      <BackLink href="/simulations/" label={t.nav.simulations} />
      <PageHead eyebrow="Grand Voyage" title={s.title} lede={s.intro} />
      {allows("guides.draft") ? (
        <p className="tier-small">
          <Link className="button" href="/simulations/grand-voyage/edit/">
            <PenIcon className="icon icon-sm" />
            {t.voyageEditor.openEditor}
          </Link>
        </p>
      ) : null}
      <div className="voyage-sim-layout">
        <section className="surface voyage-sim-panel" aria-labelledby="voyage-profile-title">
          <h2 id="voyage-profile-title">{s.profile}</h2>
          <label className="voyage-sim-field">{s.player}<input type="number" min="1" step="1" value={profile.playerLevel} onChange={(event) => update({ playerLevel: Number(event.target.value) })} /></label>
          <h3>{s.regions}</h3><p>{s.regionNote}</p>
          <div className="voyage-sim-checks">{VOYAGE_REGIONS.map((region) => <label key={region}><input type="checkbox" checked={profile.unlockedRegions.includes(region)} onChange={(event) => update({ unlockedRegions: event.target.checked ? [...profile.unlockedRegions, region] : profile.unlockedRegions.filter((item) => item !== region) })} /> {t.cityGroups[region as keyof typeof t.cityGroups]}</label>)}</div>
          <h3>{s.ship}</h3><div className="voyage-sim-four">{(["sails", "nails", "cabin", "figurehead"] as const).map((part) => <label className="voyage-sim-field" key={part}>{s[part]}<input type="number" min="0" step="1" value={profile.ship[part]} onChange={(event) => update({ ship: { ...profile.ship, [part]: Number(event.target.value) } })} /></label>)}</div>
          <h3>{s.cryptids}</h3><div className="voyage-sim-four">{(["vanguard", "logistics", "leftFlank", "rightFlank"] as const).map((position) => <label className="voyage-sim-field" key={position}>{s[position]}<select value={profile.cryptids[position]} onChange={(event) => update({ cryptids: { ...profile.cryptids, [position]: event.target.value } })}>{cryptidOptions.map((name) => <option key={name} value={name}>{name || s.unknown}</option>)}</select></label>)}</div>
          <h3>{s.ports}</h3><p>{s.portNote}</p>
          <div className="voyage-sim-four">{VOYAGE_REGIONS.map((region) => <label className="voyage-sim-field" key={region}>{t.cityGroups[region as keyof typeof t.cityGroups]}<select value={profile.regionLevels[region] ?? 0} onChange={(event) => update({ regionLevels: { ...profile.regionLevels, [region]: Number(event.target.value) } })}>{[0, 5, 10, 15, 20, 25, 30].map((level) => <option key={level} value={level}>{level}</option>)}</select></label>)}</div>
          <details><summary>{s.correction}</summary><div className="voyage-sim-four">{VOYAGE_CITIES.map((city) => <label className="voyage-sim-field" key={city.name}>{city.name} ({levelForCity(profile, city.name)})<select value={profile.cityLevels[city.name] ?? ""} onChange={(event) => { const cityLevels = { ...profile.cityLevels }; if (event.target.value === "") delete cityLevels[city.name]; else cityLevels[city.name] = Number(event.target.value); update({ cityLevels }); }}><option value="">{s.same}</option>{Array.from({ length: city.maximumLevel + 1 }, (_, level) => <option key={level} value={level}>{level}</option>)}</select></label>)}</div></details>
          <label className="voyage-sim-field">{s.factor}<input type="number" min="0.01" max="10" step="0.01" value={profile.timeCalibration} onChange={(event) => update({ timeCalibration: Number(event.target.value) })} /></label><p>{s.factorNote}</p>
          <p>{s.saved}</p><button className="small-button" type="button" onClick={() => setProfile(DEFAULT_VOYAGE_PROFILE)}>{s.reset}</button>
        </section>
        <section className="surface voyage-sim-panel" aria-labelledby="voyage-results-title">
          <h2 id="voyage-results-title">{s.search}</h2>
          <label className="voyage-sim-field">{s.stops}<select value={maxStops} onChange={(event) => setMaxStops(Number(event.target.value) as 2 | 3)}><option value="2">2</option><option value="3">3</option></select></label>
          {calculation.error ? <p role="alert">{calculation.error}</p> : calculation.routes.length === 0 ? <p>{s.empty}</p> : <div aria-live="polite"><h3>{s.result}</h3><ol className="voyage-sim-routes">{calculation.routes.map((route) => <li key={route.cities.join("-")}><strong>{route.cities.join(" → ")} → {route.cities[0]}</strong><div className="voyage-sim-metrics"><span>{s.rate}: <b>{n(route.referencePerHour, { maximumFractionDigits: 0 })}</b></span><span>{s.profit}: <b>{n(route.referenceProfit)}</b></span><span>{s.time}: <b>{formatDuration(route.hours, { hour: t.units.hour, minute: t.units.minute })}</b></span></div></li>)}</ol>
            <h3>{s.upgrades}</h3><p>{s.upgradeNote}</p><ul>{upgrades.map((item) => <li key={item.city}>{item.city}: {item.from} → {item.to} · {n(item.cost)} {s.bills}{item.missingPeers.length ? ` · ${s.gate} ${item.missingPeers.join(", ")} → ${item.requiredPeerLevel}` : ""}</li>)}</ul>
          </div>}
          {!calculation.error && <div aria-live="polite"><h3>{s.observed}</h3><p>{s.observedNote}</p>{calculation.shipments.length ? <ol className="voyage-sim-routes">{calculation.shipments.slice(0, 5).map((shipment) => <li key={shipment.destination}><strong>Shipwreck Cove → {shipment.destination}</strong><div className="voyage-sim-metrics"><span>{s.shipmentRate}: <b>{n(shipment.profitPerHour, { maximumFractionDigits: 0 })}</b></span><span>{s.shipmentProfit}: <b>{n(shipment.profit)}</b></span><span>{s.time}: <b>{formatDuration(shipment.hours, { hour: t.units.hour, minute: t.units.minute })}</b></span></div></li>)}</ol> : <p>{s.observedEmpty}</p>}</div>}
        </section>
      </div>
      <details className="assumption"><summary>{s.caveatTitle}</summary><p>{s.caveat}</p></details>
    </>
  );
}
