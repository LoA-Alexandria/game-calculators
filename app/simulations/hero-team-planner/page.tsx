"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { HEROES, localizedHero, heroImageUrl } from "../../../lib/content/heroes";
import { COLLECTION_ITEMS, EXCLUSIVE_COLLECTION_HEROES, localizedItem } from "../../../lib/content/collection";
import { BUILDINGS, localizedBuildingName } from "../../../lib/content/buildings";
import { MODELED_HEROES, MODELED_ITEMS, skillFor, validateBattle, type Fighter, type BattleOptions, type SearchResult } from "../../../lib/calculators/hero-battle";
import { simulateProduction, PRODUCTION_BUILDINGS, type ProductionSlot } from "../../../lib/calculators/hero-team";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PageHead } from "../../components/Ui";
import { createPersistentStore } from "../../components/persistentStore";
import styles from "./planner.module.css";

type Owned = Fighter & { productionLevel: number };
type Saved = { heroes: Owned[]; options: BattleOptions; mode: "combat" | "production"; opponent: "dummy" | "standard" | "custom"; slots: ProductionSlot[]; hours: number };
const fighter = (id: string): Owned => ({ id, atk: 100, hp: 1000, stars: 0, productionLevel: 1 });
const standard = ["achilles", "caesar", "da-vinci"].map(fighter);
const initial: Saved = {
  heroes: [], mode: "combat", opponent: "dummy", hours: 24,
  slots: [{ building: "Coal Plant", baseRate: 100 }, { building: "Farm", baseRate: 100 }],
  options: { rounds: 20, seed: 42, trials: 16, budget: 200, size: 3, enemyFirst: false, repeatSkills: false, objective: "damage", enemy: standard, dummy: true, enemyReduction: 0, items: [], collection: ["", "", ""] },
};
const store = createPersistentStore<Saved>({
  key: "popepoch-hero-simulator-v2", serverValue: initial, fallback: () => initial, serialize: JSON.stringify,
  parse: (raw) => {
    try {
      const value = JSON.parse(raw ?? "null") as Saved;
      if (!value || !["combat", "production"].includes(value.mode) || !["dummy", "standard", "custom"].includes(value.opponent)) return null;
      if (!Array.isArray(value.heroes) || !Array.isArray(value.slots) || !value.slots.length || value.slots.length > 25 || !value.options) return null;
      const valid = (hero: Fighter) => hero && typeof hero.id === "string" && HEROES.some((entry) => entry.id === hero.id) && [hero.atk, hero.hp, hero.stars].every(Number.isFinite);
      if (!value.heroes.every(valid) || !Array.isArray(value.options.enemy) || !value.options.enemy.every(valid)) return null;
      if (!Array.isArray(value.options.items) || !Array.isArray(value.options.collection) || value.options.collection.length > 25 || ![...value.options.items, ...value.options.collection].every((id) => typeof id === "string")) return null;
      if (![value.hours, value.options.rounds, value.options.seed, value.options.size, value.options.trials, value.options.budget, value.options.enemyReduction].every(Number.isFinite)) return null;
      if (!value.slots.every((slot) => slot && typeof slot.building === "string" && Number.isFinite(slot.baseRate))) return null;
      return value;
    } catch { return null; }
  },
});

function FighterNumbers({ unit, onChange, prefix, labels }: { unit: Fighter; onChange: (patch: Partial<Fighter>) => void; prefix: string; labels: { atk: string; hp: string; stars: string } }) {
  return <div className={styles.heroFields}>{(["atk", "hp", "stars"] as const).map((key) => <label key={key}>{labels[key]}<input aria-label={prefix + ": " + labels[key]} type="number" min={key === "hp" ? 1 : 0} step={key === "stars" ? 1 : "any"} value={Number.isNaN(unit[key]) ? "" : unit[key]} onChange={(event) => onChange({ [key]: event.target.valueAsNumber })} /></label>)}</div>;
}

export default function HeroSimulator() {
  const { t, locale } = useLocale();
  const text = t.heroTeamPlanner, sim = t.heroBattle;
  const input = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<{ data: SearchResult; key: string; rounds: number; dummy: boolean } | null>(null);
  const [production, setProduction] = useState<{ data: ReturnType<typeof simulateProduction>; key: string } | null>(null);
  const worker = useRef<Worker | null>(null);
  const signature = JSON.stringify(input);
  useDocumentTitle(sim.title);
  useEffect(() => () => worker.current?.terminate(), []);
  const stop = () => { worker.current?.terminate(); worker.current = null; setRunning(false); };
  const update = (patch: Partial<Saved>) => { stop(); setError(false); store.set({ ...input, ...patch }); };
  const options = (patch: Partial<BattleOptions>) => update({ options: { ...input.options, ...patch } });
  const editHero = (id: string, patch: Partial<Owned>) => update({ heroes: input.heroes.map((hero) => hero.id === id ? { ...hero, ...patch } : hero) });
  const heroName = (id: string) => HEROES.find((hero) => hero.id === id)?.name ?? id;
  const itemName = (id: string) => { const item = COLLECTION_ITEMS.find((item) => item.id === id); return item ? localizedItem(item, t.guideEntries.collection.collectionTexts).name : id; };
  const buildingName = (name: string) => { const building = BUILDINGS.find((entry) => entry.name === name); return building ? localizedBuildingName(building, t.guideEntries.buildings.buildingTexts) : name === "Forge" ? text.forge : name === "Masonry Workshop" ? text.masonry : name; };
  const fmt = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const eligible = (id: string) => input.mode === "combat" ? MODELED_HEROES.has(id) : Boolean(HEROES.find((hero) => hero.id === id)?.production);
  const run = () => {
    stop(); setError(false);
    if (input.mode === "production") {
      try { setProduction({ data: simulateProduction(input.heroes.filter((hero) => eligible(hero.id)), input.slots, input.hours), key: signature }); }
      catch { setError(true); }
      return;
    }
    const config = { ...input.options, dummy: input.opponent === "dummy", enemy: input.opponent === "standard" ? standard : input.options.enemy, collection: input.options.collection.filter(Boolean) };
    const pool = input.heroes.filter((hero) => MODELED_HEROES.has(hero.id));
    try {
      validateBattle(pool, config);
      const next = new Worker(new URL("./battle.worker.ts", import.meta.url));
      worker.current = next;
      setProgress(0); setRunning(true); setResult(null);
      next.onmessage = (event: MessageEvent<{ done?: number; error?: boolean; result?: SearchResult }>) => {
        if (event.data.done !== undefined) setProgress(event.data.done);
        if (event.data.error) { setError(true); stop(); }
        if (event.data.result) { setResult({ data: event.data.result, key: signature, rounds: config.rounds, dummy: config.dummy }); stop(); }
      };
      next.onerror = () => { setError(true); stop(); };
      next.postMessage({ pool, options: config });
    } catch { setError(true); }
  };
  const chart = (rows: { x: number; y: number }[], label: string) => {
    const maxX = Math.max(1, ...rows.map((row) => row.x)), maxY = Math.max(1, ...rows.map((row) => row.y));
    return <svg className={styles.chart} viewBox="0 0 600 180" role="img" aria-label={label}><title>{label}</title><path d="M40 10 V150 H590" fill="none" stroke="currentColor" opacity=".4" /><polyline points={rows.map((row) => (40 + row.x / maxX * 550) + "," + (150 - row.y / maxY * 130)).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="3" /><text x="40" y="175">0</text><text x="560" y="175">{maxX}</text><text x="45" y="20">{fmt(maxY)}</text></svg>;
  };
  return <div className={styles.planner}>
    <PageHead eyebrow={t.nav.simulations} title={sim.title} lede={sim.intro} />
    <div className={styles.controls}><label>{text.mode}<select value={input.mode} onChange={(event) => update({ mode: event.target.value as Saved["mode"] })}><option value="combat">{text.combat}</option><option value="production">{text.production}</option></select></label></div>
    <aside className={styles.notice}><p>{input.mode === "combat" ? sim.stats : sim.productionIntro}</p><details><summary>{text.details}</summary><p>{sim.model}</p><p>{sim.searchNote}</p></details></aside>
    {input.mode === "combat" ? <section className="panel">
      <h2>{sim.opponent}</h2>
      <div className={styles.controls}>
        <label>{sim.opponent}<select value={input.opponent} onChange={(event) => update({ opponent: event.target.value as Saved["opponent"], options: { ...input.options, objective: event.target.value === "dummy" ? "damage" : input.options.objective } })}><option value="dummy">{sim.dummy}</option><option value="standard">{sim.standard}</option><option value="custom">{sim.custom}</option></select></label>
        <label>{text.size}<input type="number" min={1} max={25} value={Number.isNaN(input.options.size) ? "" : input.options.size} onChange={(event) => options({ size: event.target.valueAsNumber })} /></label>
        {(["rounds", "trials", "budget", "seed"] as const).map((key) => <label key={key}>{sim[key]}<input type="number" min={key === "seed" ? 0 : 1} max={{ rounds: 100, trials: 128, budget: 1000, seed: 2147483647 }[key]} value={Number.isNaN(input.options[key]) ? "" : input.options[key]} onChange={(event) => options({ [key]: event.target.valueAsNumber })} /></label>)}
        <label>{sim.objective}<select value={input.options.objective} onChange={(event) => options({ objective: event.target.value as BattleOptions["objective"] })}><option value="damage">{sim.damageGoal}</option><option value="wins" disabled={input.opponent === "dummy"}>{sim.winGoal}</option></select></label>
        <label>{sim.reduction}<input type="number" min={0} max={.9} step={.05} value={input.options.enemyReduction} onChange={(event) => options({ enemyReduction: event.target.valueAsNumber })} /></label>
      </div>
      <div className={styles.items}><label><input type="checkbox" checked={input.options.enemyFirst} onChange={(event) => options({ enemyFirst: event.target.checked })} />{sim.enemyFirst}</label><label><input type="checkbox" checked={input.options.repeatSkills} onChange={(event) => options({ repeatSkills: event.target.checked })} />{sim.repeat}</label></div>
      {input.opponent === "standard" && <p>{standard.map((hero) => heroName(hero.id) + " · " + hero.atk + " ATK / " + hero.hp + " HP").join(" — ")}</p>}
      {input.opponent === "custom" && <><h3>{sim.enemyTeam}</h3><div className={styles.roster}>{input.options.enemy.map((enemy, index) => <div className={styles.hero} key={enemy.id}><strong>{index + 1}. {heroName(enemy.id)}</strong>{<FighterNumbers unit={enemy} labels={sim} prefix={sim.enemy + " " + heroName(enemy.id)} onChange={(patch) => options({ enemy: input.options.enemy.map((entry, slot) => slot === index ? { ...entry, ...patch } : entry) })} />}<div className={styles.controls}><button className="button" disabled={index === 0} onClick={() => { const list = [...input.options.enemy]; [list[index - 1], list[index]] = [list[index], list[index - 1]]; options({ enemy: list }); }}>{sim.up}</button><button className="button" onClick={() => options({ enemy: input.options.enemy.filter((_, slot) => slot !== index) })}>{sim.remove}</button></div></div>)}</div><label>{sim.addEnemy}<select value="" disabled={input.options.enemy.length >= 25} onChange={(event) => { if (event.target.value) options({ enemy: [...input.options.enemy, fighter(event.target.value)] }); }}><option value="">{text.empty}</option>{HEROES.filter((hero) => MODELED_HEROES.has(hero.id) && !input.options.enemy.some((enemy) => enemy.id === hero.id)).map((hero) => <option key={hero.id} value={hero.id}>{hero.name}</option>)}</select></label></>}
    </section> : <section className="panel"><h2>{text.production}</h2><label>{sim.hours}<input type="number" min={0} max={168} step="any" value={input.hours} onChange={(event) => update({ hours: event.target.valueAsNumber })} /></label>{input.slots.map((slot, index) => <div className={styles.controls} key={index}><label>{text.building} {index + 1}<select value={slot.building} onChange={(event) => update({ slots: input.slots.map((entry, i) => i === index ? { ...entry, building: event.target.value } : entry) })}>{PRODUCTION_BUILDINGS.map((building) => <option key={building} value={building}>{buildingName(building)}</option>)}</select></label><label>{sim.baseRate} {index + 1}<input type="number" min={0} step="any" value={slot.baseRate} onChange={(event) => update({ slots: input.slots.map((entry, i) => i === index ? { ...entry, baseRate: event.target.valueAsNumber } : entry) })} /></label><button className="button" disabled={input.slots.length === 1} onClick={() => update({ slots: input.slots.filter((_, i) => i !== index) })}>{sim.remove}</button></div>)}<button className="button" disabled={input.slots.length >= 25} onClick={() => update({ slots: [...input.slots, { building: "Farm", baseRate: 100 }] })}>{sim.addBuilding}</button></section>}
    <section className="panel">
      <h2>{text.heroes} <span className={styles.count}>{input.heroes.filter((hero) => eligible(hero.id)).length} / {HEROES.filter((hero) => eligible(hero.id)).length}</span></h2>
      <div className={styles.controls}><label>{text.search}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="button" onClick={() => update({ heroes: HEROES.filter((hero) => eligible(hero.id)).map((hero) => input.heroes.find((entry) => entry.id === hero.id) ?? fighter(hero.id)) })}>{text.all}</button><button className="button" onClick={() => update({ heroes: [] })}>{text.none}</button></div>
      <div className={styles.roster}>{HEROES.filter((hero) => eligible(hero.id) && hero.name.toLowerCase().includes(search.toLowerCase())).map((hero) => {
        const own = input.heroes.find((entry) => entry.id === hero.id);
        const localized = localizedHero(hero, t.guideEntries.heroes.heroTexts, t.guideEntries.collection.collectionTexts);
        return <div className={styles.hero + (own ? " " + styles.owned : "")} key={hero.id}>
          <label className={styles.heroCheck}><input type="checkbox" checked={Boolean(own)} onChange={(event) => update({ heroes: event.target.checked ? [...input.heroes, fighter(hero.id)] : input.heroes.filter((entry) => entry.id !== hero.id) })} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {hero.images[0] && <img src={heroImageUrl(hero.images[0])} alt="" width={44} height={44} loading="lazy" />}<span>{hero.name}<small>{hero.rarity}</small></span>
          </label>
          {own && <>{input.mode === "combat" ? <FighterNumbers unit={own} labels={sim} prefix={hero.name} onChange={(patch) => editHero(hero.id, patch)} /> : <label>{sim.stars}<input type="number" min={0} value={own.stars} onChange={(event) => editHero(hero.id, { stars: event.target.valueAsNumber })} /></label>}
            <label>{text.level}<input type="number" min={1} placeholder={text.unknown} value={own.level ?? ""} onChange={(event) => editHero(hero.id, { level: event.target.value === "" ? undefined : event.target.valueAsNumber })} /></label>
            {input.mode === "production" && hero.production && <label>{text.ability}<select value={own.productionLevel} onChange={(event) => editHero(hero.id, { productionLevel: Number(event.target.value) })}>{hero.production.levels.map((_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>}
            <details><summary>{text.reference}</summary><p>{input.mode === "production" ? localized.production?.levels[own.productionLevel - 1] : localized.skill?.levels[(skillFor(own)?.level ?? 1) - 1]}</p></details>
          </>}
        </div>;
      })}</div>
      <details><summary>{sim.unsupported}</summary><p>{HEROES.filter((hero) => !eligible(hero.id)).map((hero) => hero.name).join(", ")}</p></details>
    </section>
    {input.mode === "combat" && <section className="panel"><h2>{text.items}</h2><p>{sim.itemsNote}</p><div className={styles.items}>{Object.entries(EXCLUSIVE_COLLECTION_HEROES).map(([id, hero]) => <label key={id}><input type="checkbox" disabled={!MODELED_ITEMS.has(id)} checked={input.options.items.includes(id)} onChange={(event) => options({ items: event.target.checked ? [...input.options.items, id] : input.options.items.filter((item) => item !== id) })} /><span>{itemName(id)}<small>{heroName(hero)}{!MODELED_ITEMS.has(id) ? " · " + text.unknown : ""}</small></span></label>)}</div>
      <h2>{text.collection}</h2><div className={styles.controls}>{input.options.collection.map((id, index) => <label key={index}>{text.collection} {index + 1}<select value={id} onChange={(event) => options({ collection: input.options.collection.map((item, slot) => slot === index ? event.target.value : item) })}><option value="">{text.empty}</option>{COLLECTION_ITEMS.map((item) => <option key={item.id} value={item.id} disabled={!MODELED_ITEMS.has(item.id) || (input.options.collection.includes(item.id) && item.id !== id)}>{itemName(item.id)}{!MODELED_ITEMS.has(item.id) ? " · " + text.unknown : ""}</option>)}</select></label>)}</div>
      <div className={styles.controls}><button className="button" disabled={input.options.collection.length >= 25} onClick={() => options({ collection: [...input.options.collection, ""] })}>{text.add}</button><button className="button" disabled={!input.options.collection.length} onClick={() => options({ collection: input.options.collection.slice(0, -1) })}>{text.remove}</button></div>
    </section>}
    <div className={styles.runbar}><button className="button" disabled={running} onClick={run}>{input.mode === "combat" ? sim.run : sim.productionRun}</button>{running && <><button className="button" onClick={stop}>{sim.cancel}</button><span role="status">{sim.running}: {progress} / {input.options.budget}</span></>}</div>
    {error && <p role="alert">{sim.notReady}</p>}
    {input.mode === "combat" && <section aria-label={sim.results}><h2>{sim.results}</h2>{!result ? <p>{sim.empty}</p> : <>
      {result.key !== signature && <p role="status">{sim.stale}</p>}
      <p>{sim.evaluated}: {result.data.evaluated} · {result.data.exhaustive ? sim.exhaustive : sim.sampled} · {sim.validation}: {result.data.validationTrials}</p>
      <div className={styles.results}>{result.data.candidates.map((candidate, index) => <article className="panel" key={candidate.team.map((hero) => hero.id).join(",")}><h3>{sim.best} {index + 1}</h3><strong className={styles.metric}>{fmt(candidate.damage / result.rounds)}</strong><p>{sim.perRound}</p><dl><dt>{sim.totalDamage}</dt><dd>{fmt(candidate.damage)}</dd><dt>{sim.deviation}</dt><dd>± {fmt(candidate.deviation)}</dd><dt>{sim.healing}</dt><dd>{fmt(candidate.healing)}</dd><dt>{sim.wins}</dt><dd>{result.dummy ? "—" : fmt(candidate.winRate * 100) + "%"}</dd><dt>{sim.remaining}</dt><dd>{fmt(candidate.remaining * 100)}%</dd></dl><ol className={styles.team}>{candidate.team.map((hero) => <li key={hero.id}><strong>{heroName(hero.id)}</strong><small>{hero.atk} ATK · {hero.hp} HP · {hero.stars} {sim.stars}</small></li>)}</ol></article>)}</div>
      <h3>{sim.timeline}</h3>{chart(result.data.trace.timeline.map((row) => ({ x: row.round, y: row.damage })), sim.timeline)}
      <details><summary>{sim.trace}</summary><p>{sim.logNote}</p><div className={styles.log}><table><thead><tr><th>{sim.round}</th><th>{sim.ally} / {sim.enemy}</th><th>{text.heroes}</th><th>{sim.action}</th><th>{sim.amount}</th></tr></thead><tbody>{result.data.trace.events.map((event, index) => <tr key={index}><td>{event.round}</td><td>{event.side === 0 ? sim.ally : sim.enemy}</td><td>{heroName(event.actor)}</td><td>{event.action.startsWith("fall:") ? sim.events.fall + ": " + heroName(event.action.slice(5)) : sim.events[event.action as keyof typeof sim.events] ?? event.action}</td><td>{fmt(event.amount)}</td></tr>)}</tbody></table></div></details>
    </>}</section>}
    {input.mode === "production" && production && <section aria-label={sim.results}><h2>{sim.results}</h2>{production.key !== signature && <p role="status">{sim.stale}</p>}<p>{sim.baseline}: {fmt(production.data.baseline)} · {sim.output}: <strong>{fmt(production.data.total)}</strong></p><div className={styles.results}>{production.data.assignments.map((slot, index) => <article className="panel" key={index}><h3>{buildingName(slot.building)}</h3><strong>{slot.hero ? heroName(slot.hero) : sim.noHero}</strong><p>+{fmt(slot.bonus)}% · {fmt(slot.rate)} {sim.perHour}</p></article>)}</div>{chart(production.data.timeline.map((row) => ({ x: row.hour, y: row.total })), sim.output)}<details><summary>{sim.duration}</summary>{production.data.timeline.map((row) => <p key={row.hour}>{fmt(row.hour)} {sim.hours}: {fmt(row.total)} ({sim.baseline}: {fmt(row.baseline)})</p>)}</details></section>}
    <footer className={styles.notice}><p>{text.saved}</p><p>{text.sources}: <Link href="/guides/heroes/">{t.guideEntries.heroes.title}</Link> · <Link href="/guides/hero-layouts/">{t.guideEntries.heroLayouts.title}</Link> · <Link href="/guides/collection/">{t.guideEntries.collection.title}</Link></p><p>{text.credit}</p></footer>
  </div>;
}
