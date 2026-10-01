"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { HEROES, localizedHero, heroImageUrl } from "../../../lib/content/heroes";
import { COLLECTION_ITEMS, EXCLUSIVE_COLLECTION_HEROES, collectionImageUrl, localizedItem } from "../../../lib/content/collection";
import { CRYPTIDES, cryptideImageUrl, localizedCryptideName, skillText as cryptideSkillText } from "../../../lib/content/cryptides";
import { BUILDINGS, localizedBuildingName } from "../../../lib/content/buildings";
import { MODELED_HEROES, MODELED_ITEMS, skillFor, validateBattle, type Fighter, type BattleOptions, type SearchResult } from "../../../lib/calculators/hero-battle";
import { simulateProduction, PRODUCTION_BUILDINGS, type ProductionSlot } from "../../../lib/calculators/hero-team";
import { baseValueSource, scoreBaseLineup, STAR_COLORS, type BaseValueInput } from "../../../lib/calculators/hero-base-value";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PageHead } from "../../components/Ui";
import { createPersistentStore } from "../../components/persistentStore";
import styles from "./planner.module.css";

type Owned = Fighter & { productionLevel: number };
type PlannerMode = "combat" | "production" | "base-value";
type BaseOwned = BaseValueInput;
type Saved = { heroes: Owned[]; baseHeroes: BaseOwned[]; baseSlots: number; heroLevel: number; options: BattleOptions; mode: PlannerMode; opponent: "dummy" | "standard" | "custom"; slots: ProductionSlot[]; hours: number };
const lineupSelected = (lineup: BattleOptions["cryptides"], id: string, currentSlot: number) => Boolean(lineup?.some((entry, slot) => slot !== currentSlot && entry?.id === id));
const defaultCryptides = () => CRYPTIDES.map((entry) => ({ id: entry.id, skills: 1 as const }));
const fighter = (id: string): Owned => ({ id, atk: 100, hp: 1000, stars: 0, productionLevel: 1 });
const standard = ["achilles", "caesar", "da-vinci"].map(fighter);
const initial: Saved = {
  heroes: [], baseHeroes: [], baseSlots: 4, heroLevel: 100, mode: "combat", opponent: "dummy", hours: 24,
  slots: [{ building: "Coal Plant", baseRate: 100 }, { building: "Farm", baseRate: 100 }],
  options: { rounds: 10, seed: 42, trials: 16, budget: 500, size: 3, enemyCount: 1, infiniteDummy: true, enemyFirst: false, objective: "damage", enemy: standard, dummy: true, enemyReduction: 0, items: [], collection: [], collectionSlots: 6, cryptides: defaultCryptides() },
};
const store = createPersistentStore<Saved>({
  key: "popepoch-hero-simulator-v2", serverValue: initial, fallback: () => initial, serialize: JSON.stringify,
  parse: (raw) => {
    try {
      const value = JSON.parse(raw ?? "null") as Saved;
      if (!value || !["combat", "production", "base-value"].includes(value.mode) || !["dummy", "standard", "custom"].includes(value.opponent)) return null;
      if (!Array.isArray(value.heroes) || !Array.isArray(value.slots) || !value.slots.length || value.slots.length > 25 || !value.options) return null;
      const valid = (hero: Fighter) => hero && typeof hero.id === "string" && HEROES.some((entry) => entry.id === hero.id) && [hero.atk, hero.hp, hero.stars].every(Number.isFinite);
      if (!value.heroes.every(valid) || !Array.isArray(value.options.enemy) || !value.options.enemy.every(valid)) return null;
      if (!Array.isArray(value.options.items) || !Array.isArray(value.options.collection) || value.options.collection.length > 25 || ![...value.options.items, ...value.options.collection].every((id) => typeof id === "string")) return null;
      if (![value.hours, value.options.rounds, value.options.seed, value.options.size, value.options.trials, value.options.budget, value.options.enemyReduction].every(Number.isFinite)) return null;
      if (value.heroLevel !== undefined && (!Number.isInteger(value.heroLevel) || value.heroLevel < 1 || value.heroLevel > 1000)) return null;
      if (!value.slots.every((slot) => slot && typeof slot.building === "string" && Number.isFinite(slot.baseRate))) return null;
      const savedCryptides = Array.isArray(value.options.cryptides) ? value.options.cryptides.filter((entry): entry is NonNullable<BattleOptions["cryptides"]>[number] => Boolean(entry && CRYPTIDES.some((cryptide) => cryptide.id === entry.id) && [1, 2, 3].includes(entry.skills))) : [];
      const uniqueCryptides = savedCryptides.filter((entry, index) => savedCryptides.findIndex((candidate) => candidate?.id === entry?.id) === index);
      const cryptideLineup = [...uniqueCryptides, ...defaultCryptides().filter((entry) => !uniqueCryptides.some((saved) => saved?.id === entry.id))].slice(0, 4);
      const baseHeroes = Array.isArray(value.baseHeroes) ? value.baseHeroes.filter((hero) => hero && typeof hero.id === "string" && baseValueSource(hero.id) && (hero.attack === null || (Number.isFinite(hero.attack) && hero.attack >= 0)) && Number.isInteger(hero.starColor) && hero.starColor >= 1 && hero.starColor <= STAR_COLORS.length) : [];
      return { ...value, baseHeroes, baseSlots: Number.isInteger(value.baseSlots) && value.baseSlots >= 1 && value.baseSlots <= 25 ? value.baseSlots : 4, opponent: "dummy", heroLevel: Number.isFinite(value.heroLevel) ? value.heroLevel : 100, options: { ...value.options, enemyCount: [1, 5, 10, 20, 30].includes(value.options.enemyCount ?? 1) ? value.options.enemyCount ?? 1 : 1, infiniteDummy: typeof value.options.infiniteDummy === "boolean" ? value.options.infiniteDummy : true, collectionSlots: 6, cryptides: cryptideLineup } };
    } catch { return null; }
  },
});

export default function HeroSimulator() {
  const { t, locale } = useLocale();
  const text = t.heroTeamPlanner, sim = t.heroBattle;
  const input = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [search, setSearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<{ data: SearchResult; key: string; rounds: number; dummy: boolean } | null>(null);
  const [production, setProduction] = useState<{ data: ReturnType<typeof simulateProduction>; key: string } | null>(null);
  const [baseResult, setBaseResult] = useState<{ data: ReturnType<typeof scoreBaseLineup>; key: string } | null>(null);
  const worker = useRef<Worker | null>(null);
  const signature = JSON.stringify(input);
  useDocumentTitle(sim.title);
  useEffect(() => () => worker.current?.terminate(), []);
  const stop = () => { worker.current?.terminate(); worker.current = null; setRunning(false); };
  const update = (patch: Partial<Saved>) => { stop(); setError(false); store.set({ ...input, ...patch }); };
  const options = (patch: Partial<BattleOptions>) => update({ options: { ...input.options, ...patch } });
  const editHero = (id: string, patch: Partial<Owned>) => update({ heroes: input.heroes.map((hero) => hero.id === id ? { ...hero, ...patch } : hero) });
  const editBaseHero = (id: string, patch: Partial<BaseOwned>) => store.set({ ...input, baseHeroes: input.baseHeroes.map((hero) => hero.id === id ? { ...hero, ...patch } : hero) });
  const heroName = (id: string) => HEROES.find((hero) => hero.id === id)?.name ?? id;
  const itemName = (id: string) => { const item = COLLECTION_ITEMS.find((item) => item.id === id); return item ? localizedItem(item, t.guideEntries.collection.collectionTexts).name : id; };
  const collectionPool = COLLECTION_ITEMS.filter((item) => !EXCLUSIVE_COLLECTION_HEROES[item.id] && MODELED_ITEMS.has(item.id));
  const cryptideName = (id: string) => { const cryptide = CRYPTIDES.find((entry) => entry.id === id); return cryptide ? localizedCryptideName(cryptide, t.guideEntries.cryptides.cryptideTexts) : id; };
  const actorName = (id: string) => CRYPTIDES.some((entry) => entry.id === id) ? cryptideName(id) : heroName(id);
  const buildingName = (name: string) => { const building = BUILDINGS.find((entry) => entry.name === name); return building ? localizedBuildingName(building, t.guideEntries.buildings.buildingTexts) : name === "Forge" ? text.forge : name === "Masonry Workshop" ? text.masonry : name; };
  const fmt = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const eligible = (id: string) => input.mode === "combat" ? MODELED_HEROES.has(id) : Boolean(HEROES.find((hero) => hero.id === id)?.production);
  const run = () => {
    stop(); setError(false);
    if (input.mode === "base-value") {
      try { setBaseResult({ data: scoreBaseLineup(input.baseHeroes.filter((hero) => hero.attack !== null), input.baseSlots), key: signature }); }
      catch { setError(true); }
      return;
    }
    if (input.mode === "production") {
      try { setProduction({ data: simulateProduction(input.heroes.filter((hero) => eligible(hero.id)), input.slots, input.hours), key: signature }); }
      catch { setError(true); }
      return;
    }
    const config = { ...input.options, cryptides: input.options.cryptides ?? defaultCryptides(), dummy: true, enemy: [], collection: input.options.collection.filter(Boolean), collectionSlots: 6 };
    const pool = input.heroes.filter((hero) => MODELED_HEROES.has(hero.id)).map((hero) => ({ ...hero, level: input.heroLevel, atk: 100, hp: 1000 }));
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
    <aside className={styles.notice}><p>{sim.stats}</p><details><summary>{text.details}</summary><p>{sim.model}</p><p>{sim.searchNote}</p></details></aside>
    <div className={styles.modes} role="group" aria-label={sim.modeLabel}>
      <button className="button" aria-pressed={input.mode === "combat"} onClick={() => update({ mode: "combat" })}>{sim.modeCombat}</button>
      <button className="button" aria-pressed={input.mode === "base-value"} onClick={() => update({ mode: "base-value" })}>{sim.modeBaseValue}</button>
      <button className="button" aria-pressed={input.mode === "production"} onClick={() => update({ mode: "production" })}>{sim.modeProduction}</button>
    </div>
    {input.mode === "base-value" && <>
      <section className="panel">
        <div className={styles.baseHeading}><div><h2>{sim.baseValueTitle}</h2><p>{sim.baseValueIntro}</p></div>
          <label>{sim.baseValueSlots}<input type="number" min={1} max={25} step={1} value={Number.isNaN(input.baseSlots) ? "" : input.baseSlots} onChange={(event) => update({ baseSlots: event.target.valueAsNumber })} /></label>
        </div>
        <p className={styles.formula}>{sim.baseValueFormula}</p>
        <div className={styles.controls}><label>{sim.baseValueSearch}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <button className="button" onClick={() => update({ baseHeroes: HEROES.map((hero) => {
            const current = input.baseHeroes.find((owned) => owned.id === hero.id);
            const source = baseValueSource(hero.id);
            return source ? current ?? { id: hero.id, ...source } : null;
          }).filter((entry): entry is BaseOwned => entry !== null) })}>{sim.modeSelectAll}</button>
          <button className="button" onClick={() => update({ baseHeroes: [] })}>{sim.modeClear}</button>
        </div>
        <p>{sim.baseValueSelected.replace("{count}", String(input.baseHeroes.length))} · {sim.baseValueMissing.replace("{count}", String(input.baseHeroes.filter((hero) => hero.attack === null).length))}</p>
        <div className={styles.baseRoster}>{HEROES.filter((hero) => baseValueSource(hero.id) && hero.name.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale))).map((hero) => {
          const own = input.baseHeroes.find((entry) => entry.id === hero.id);
          return <article className={styles.baseHero + (own ? " " + styles.owned : "")} key={hero.id}>
            <label className={styles.heroCheck}><input type="checkbox" checked={Boolean(own)} onChange={(event) => {
              if (!event.target.checked) update({ baseHeroes: input.baseHeroes.filter((entry) => entry.id !== hero.id) });
              else { const source = baseValueSource(hero.id); if (source) update({ baseHeroes: [...input.baseHeroes, { id: hero.id, ...source }] }); }
            }} />{hero.images[0] && <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImageUrl(hero.images[0])} alt="" width={44} height={44} loading="lazy" />
            </>}<span>{hero.name}<small>{hero.rarity} · {hero.troop}</small></span></label>
            {own && <div className={styles.heroFields}>
              <label>{sim.baseValueAttack}<input type="number" min={0} max={1e9} step="any" value={own.attack ?? ""} placeholder={sim.baseValueEnterAttack} onChange={(event) => editBaseHero(hero.id, { attack: event.target.value === "" ? null : event.target.valueAsNumber })} /></label>
              <label>{sim.baseValueStar}<select value={own.starColor} onChange={(event) => editBaseHero(hero.id, { starColor: Number(event.target.value) })}>{STAR_COLORS.map((color, index) => <option key={color} value={index + 1}>{sim.baseStarColors[index]}</option>)}</select></label>
            </div>}
          </article>;
        })}</div>
      </section>
    </>}
    {input.mode === "combat" ? <section className="panel">
      <h2>{sim.setup}</h2>
      <div className={styles.controls}>
        <label>{sim.size}<input type="number" min={1} max={25} value={Number.isNaN(input.options.size) ? "" : input.options.size} onChange={(event) => options({ size: event.target.valueAsNumber })} /></label>
        <label>{sim.heroLevel}<input type="number" min={1} max={1000} value={Number.isNaN(input.heroLevel) ? "" : input.heroLevel} onChange={(event) => update({ heroLevel: event.target.valueAsNumber })} /></label>
        <label>{sim.targetHp}<select value={input.options.infiniteDummy === false ? String(input.options.enemyCount ?? 1) : "infinite"} onChange={(event) => options({ infiniteDummy: event.target.value === "infinite", enemyCount: event.target.value === "infinite" ? input.options.enemyCount : Number(event.target.value) as 1 | 5 | 10 | 20 | 30 })}><option value="infinite">{sim.unlimitedHp}</option>{[1, 5, 10, 20, 30].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
      </div>
      {input.options.infiniteDummy === false && <p>{sim.finitePoolNote.replace("{count}", String(input.options.enemyCount ?? 1))}</p>}
      <h3>{sim.cryptidSetup}</h3>
      <p>{sim.cryptidOrderNote}</p>
      <div className={styles.roster}>{[0, 1, 2, 3].map((slot) => {
        const selection = input.options.cryptides?.[slot] ?? defaultCryptides()[slot];
        const cryptide = selection && CRYPTIDES.find((entry) => entry.id === selection.id);
        return <div className={styles.hero} key={slot}>
          <label>{sim.cryptidRound} {slot + 1}<select value={selection?.id ?? ""} onChange={(event) => {
            const lineup = [...(input.options.cryptides ?? defaultCryptides())];
            lineup[slot] = { id: event.target.value, skills: selection.skills };
            options({ cryptides: lineup });
          }}>{CRYPTIDES.map((entry) => <option key={entry.id} value={entry.id} disabled={Boolean(lineupSelected(input.options.cryptides, entry.id, slot))}>{cryptideName(entry.id)}</option>)}</select></label>
          {selection && cryptide && <>
            <label>{sim.unlockedSkills}<select value={selection.skills} onChange={(event) => { const lineup = [...(input.options.cryptides ?? defaultCryptides())]; lineup[slot] = { ...selection, skills: Number(event.target.value) as 1 | 2 | 3 }; options({ cryptides: lineup }); }}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cryptideImageUrl(cryptide.image)} alt="" width={52} height={52} loading="lazy" />
            <details><summary>{sim.cryptidSkills}</summary>{cryptide.skills.slice(0, selection.skills).map((skill) => <p key={skill.id}><strong>{cryptideSkillText(cryptide.id, skill.id, t.guideEntries.cryptides.cryptideTexts).name}</strong>: {cryptideSkillText(cryptide.id, skill.id, t.guideEntries.cryptides.cryptideTexts).body}</p>)}</details>
            <div className={styles.controls}><button className="button" disabled={slot === 0} onClick={() => { const lineup = [...(input.options.cryptides ?? defaultCryptides())]; [lineup[slot - 1], lineup[slot]] = [lineup[slot], lineup[slot - 1]]; options({ cryptides: lineup }); }}>{sim.up}</button><button className="button" disabled={slot === 3} onClick={() => { const lineup = [...(input.options.cryptides ?? defaultCryptides())]; [lineup[slot + 1], lineup[slot]] = [lineup[slot], lineup[slot + 1]]; options({ cryptides: lineup }); }}>{sim.down}</button></div>
          </>}
        </div>;
      })}</div>
    </section> : input.mode === "production" ? <section className="panel"><h2>{text.production}</h2><label>{sim.hours}<input type="number" min={0} max={168} step="any" value={input.hours} onChange={(event) => update({ hours: event.target.valueAsNumber })} /></label>{input.slots.map((slot, index) => <div className={styles.controls} key={index}><label>{text.building} {index + 1}<select value={slot.building} onChange={(event) => update({ slots: input.slots.map((entry, i) => i === index ? { ...entry, building: event.target.value } : entry) })}>{PRODUCTION_BUILDINGS.map((building) => <option key={building} value={building}>{buildingName(building)}</option>)}</select></label><label>{sim.baseRate} {index + 1}<input type="number" min={0} step="any" value={slot.baseRate} onChange={(event) => update({ slots: input.slots.map((entry, i) => i === index ? { ...entry, baseRate: event.target.valueAsNumber } : entry) })} /></label><button className="button" disabled={input.slots.length === 1} onClick={() => update({ slots: input.slots.filter((_, i) => i !== index) })}>{sim.remove}</button></div>)}<button className="button" disabled={input.slots.length >= 25} onClick={() => update({ slots: [...input.slots, { building: "Farm", baseRate: 100 }] })}>{sim.addBuilding}</button></section> : null}
    {input.mode !== "base-value" && <section className="panel">
      <h2>{text.heroes} <span className={styles.count}>{input.heroes.filter((hero) => eligible(hero.id)).length} / {MODELED_HEROES.size}</span></h2>
      <p>{sim.inventoryNote}</p>
      <div className={styles.controls}><label>{text.search}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="button" onClick={() => update({ heroes: [] })}>{text.none}</button></div>
      <div className={styles.roster}>{HEROES.filter((hero) => MODELED_HEROES.has(hero.id) && hero.name.toLowerCase().includes(search.toLowerCase())).map((hero) => {
        const own = input.heroes.find((entry) => entry.id === hero.id);
        const exclusive = Object.entries(EXCLUSIVE_COLLECTION_HEROES).find(([, owner]) => owner === hero.id);
        const localized = localizedHero(hero, t.guideEntries.heroes.heroTexts, t.guideEntries.collection.collectionTexts);
        return <div className={styles.hero + (own ? " " + styles.owned : "")} key={hero.id} title={[hero.bio, own ? localized.skill?.levels[(skillFor(own)?.level ?? 1) - 1] : hero.skill?.levels[0]].filter(Boolean).join("\n\n")}>
          <label className={styles.heroCheck}><input type="checkbox" checked={Boolean(own)} onChange={(event) => update({ heroes: event.target.checked ? [...input.heroes, fighter(hero.id)] : input.heroes.filter((entry) => entry.id !== hero.id) })} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {hero.images[0] && <img src={heroImageUrl(hero.images[0])} alt="" width={44} height={44} loading="lazy" />}<span>{hero.name}<small>{hero.rarity}</small></span>
          </label>
          {own && <><label>{sim.stars}<input aria-label={hero.name + ": " + sim.stars} type="number" min={0} max={1000} value={Number.isNaN(own.stars) ? "" : own.stars} onChange={(event) => editHero(hero.id, { stars: event.target.valueAsNumber })} /></label>
            {exclusive && <label className={styles.itemOwned}><input type="checkbox" disabled={!MODELED_ITEMS.has(exclusive[0])} checked={input.options.items.includes(exclusive[0])} onChange={(event) => options({ items: event.target.checked ? [...input.options.items, exclusive[0]] : input.options.items.filter((id) => id !== exclusive[0]) })} /><span>{sim.heroItemOwned}: {itemName(exclusive[0])}</span></label>}
            <details><summary>{text.reference}</summary><p>{localized.skill?.levels[(skillFor(own)?.level ?? 1) - 1]}</p></details>
          </>}
        </div>;
      })}</div>
      <details><summary>{sim.unsupported}</summary><p>{HEROES.filter((hero) => !eligible(hero.id)).map((hero) => hero.name).join(", ")}</p></details>
    </section>}
    {input.mode === "combat" && <section className="panel"><h2>{sim.collectionOwned}</h2><p>{sim.itemsNote}</p><label>{sim.collectionSearch}<input type="search" value={collectionSearch} onChange={(event) => setCollectionSearch(event.target.value)} /></label>
      <div className={styles.items}>{collectionPool.filter((item) => itemName(item.id).toLocaleLowerCase(locale).includes(collectionSearch.toLocaleLowerCase(locale))).map((item) => <label key={item.id}><input type="checkbox" checked={input.options.collection.includes(item.id)} onChange={(event) => options({ collection: event.target.checked ? [...input.options.collection, item.id] : input.options.collection.filter((owned) => owned !== item.id) })} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={collectionImageUrl(item.image)} alt="" width={40} height={40} loading="lazy" /><span>{itemName(item.id)}</span></label>)}</div>
      <details><summary>{sim.unsupportedCollection}</summary><p>{COLLECTION_ITEMS.filter((item) => !EXCLUSIVE_COLLECTION_HEROES[item.id] && !MODELED_ITEMS.has(item.id)).map((item) => itemName(item.id)).join(", ")}</p></details>
    </section>}
    <div className={styles.runbar}><button className="button" disabled={running} onClick={run}>{input.mode === "combat" ? sim.run : input.mode === "production" ? sim.productionRun : sim.baseValueRun}</button>{running && <><button className="button" onClick={stop}>{sim.cancel}</button><span role="status">{sim.running}: {progress} / {input.options.budget}</span></>}</div>
    {error && <p role="alert">{sim.notReady}</p>}
    {input.mode === "combat" && <section aria-label={sim.results}><h2>{sim.results}</h2>{!result ? <p>{sim.empty}</p> : <>
      {result.key !== signature && <p role="status">{sim.stale}</p>}
      <p>{sim.evaluated}: {result.data.evaluated} · {result.data.exhaustive ? sim.exhaustive : sim.sampled} · {sim.validation}: {result.data.validationTrials}</p>
      <div className={styles.results}>{result.data.candidates.map((candidate, index) => <article className="panel" key={candidate.team.map((hero) => hero.id).join(",") + "|" + candidate.collection.join(",")}><h3>{sim.best} {index + 1}</h3><strong className={styles.metric}>{fmt(candidate.damage / result.rounds)}</strong><p>{sim.perRound}</p><dl><dt>{sim.totalDamage}</dt><dd>{fmt(candidate.damage)}</dd><dt>{sim.deviation}</dt><dd>± {fmt(candidate.deviation)}</dd><dt>{sim.healing}</dt><dd>{fmt(candidate.healing)}</dd><dt>{sim.wins}</dt><dd>{result.dummy ? "—" : fmt(candidate.winRate * 100) + "%"}</dd><dt>{sim.remaining}</dt><dd>{fmt(candidate.remaining * 100)}%</dd></dl><ol className={styles.team}>{candidate.team.map((hero) => { const exclusive = Object.entries(EXCLUSIVE_COLLECTION_HEROES).find(([id, owner]) => owner === hero.id && input.options.items.includes(id)); return <li key={hero.id}><strong>{heroName(hero.id)}</strong><small>{hero.stars} {sim.stars} · Lv. {input.heroLevel}{exclusive ? " · " + itemName(exclusive[0]) : ""}</small></li>; })}</ol><h4>{sim.bestCollection}</h4><ul className={styles.team}>{candidate.collection.map((id) => <li key={id}>{itemName(id)}</li>)}</ul></article>)}</div>
      <h3>{sim.timeline}</h3>{chart(result.data.trace.timeline.map((row) => ({ x: row.round, y: row.damage })), sim.timeline)}
      <details><summary>{sim.trace}</summary><p>{sim.logNote}</p><div className={styles.log}><table><thead><tr><th>{sim.round}</th><th>{sim.ally} / {sim.enemy}</th><th>{text.heroes}</th><th>{sim.action}</th><th>{sim.amount}</th></tr></thead><tbody>{result.data.trace.events.map((event, index) => <tr key={index}><td>{event.round}</td><td>{event.side === 0 ? sim.ally : sim.enemy}</td><td>{actorName(event.actor)}</td><td>{event.action.startsWith("fall:") ? sim.events.fall + ": " + heroName(event.action.slice(5)) : sim.events[event.action as keyof typeof sim.events] ?? event.action}</td><td>{fmt(event.amount)}</td></tr>)}</tbody></table></div></details>
    </>}</section>}
    {input.mode === "production" && production && <section aria-label={sim.results}><h2>{sim.results}</h2>{production.key !== signature && <p role="status">{sim.stale}</p>}<p>{sim.baseline}: {fmt(production.data.baseline)} · {sim.output}: <strong>{fmt(production.data.total)}</strong></p><div className={styles.results}>{production.data.assignments.map((slot, index) => <article className="panel" key={index}><h3>{buildingName(slot.building)}</h3><strong>{slot.hero ? heroName(slot.hero) : sim.noHero}</strong><p>+{fmt(slot.bonus)}% · {fmt(slot.rate)} {sim.perHour}</p></article>)}</div>{chart(production.data.timeline.map((row) => ({ x: row.hour, y: row.total })), sim.output)}<details><summary>{sim.duration}</summary>{production.data.timeline.map((row) => <p key={row.hour}>{fmt(row.hour)} {sim.hours}: {fmt(row.total)} ({sim.baseline}: {fmt(row.baseline)})</p>)}</details></section>}
    {input.mode === "base-value" && baseResult && <section aria-label={sim.baseValueResults}>
      <h2>{sim.baseValueResults}</h2>{baseResult.key !== signature && <p role="status">{sim.stale}</p>}
      <article className={"panel " + styles.baseSummary}><p>{sim.baseValueRecommended.replace("{count}", String(baseResult.data.lineup.length))}</p><strong className={styles.metric}>{fmt(baseResult.data.totalScore)}</strong><small>{sim.baseValueTotal}</small></article>
      <h3>{sim.baseValueLineup}</h3>
      {baseResult.data.lineup.length === 0 ? <p>{sim.baseValueEmpty}</p> : <div className={styles.baseCards}>{baseResult.data.lineup.map((row, index) => <article className="panel" key={row.id}><span className={styles.rank}>{index + 1}</span><div><h4>{row.name}</h4><p>{row.rarity} · {sim.baseStarColors[row.starColor - 1]}</p></div><strong>{fmt(row.score)}</strong><small>{fmt(row.attack)} × {fmt(row.activationChance * 100)}% × {fmt(row.skillDamage * 100)}%</small></article>)}</div>}
      <details open><summary>{sim.baseValueAllRanked.replace("{count}", String(baseResult.data.rows.length))}</summary><div className={styles.baseTable}><table><thead><tr><th scope="col">#</th><th scope="col">{sim.baseValueHero}</th><th scope="col">{sim.baseValueAttack}</th><th scope="col">{sim.baseValueStar}</th><th scope="col">{sim.baseValueChance}</th><th scope="col">{sim.baseValueDamage}</th><th scope="col">{sim.baseValueScore}</th></tr></thead><tbody>{baseResult.data.rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><th scope="row">{row.name} <small>{row.rarity}</small></th><td>{fmt(row.attack)}</td><td>{sim.baseStarColors[row.starColor - 1]}</td><td>{fmt(row.activationChance * 100)}%</td><td>{fmt(row.skillDamage * 100)}%</td><td><strong>{fmt(row.score)}</strong></td></tr>)}</tbody></table></div></details>
      <p className={styles.baseNotice}>{sim.baseValueLimitations}</p>
    </section>}
    <footer className={styles.notice}><p>{text.saved}</p><p>{text.sources}: <Link href="/guides/heroes/">{t.guideEntries.heroes.title}</Link> · <Link href="/guides/hero-layouts/">{t.guideEntries.heroLayouts.title}</Link> · <Link href="/guides/collection/">{t.guideEntries.collection.title}</Link></p><p>{text.credit}</p></footer>
  </div>;
}
