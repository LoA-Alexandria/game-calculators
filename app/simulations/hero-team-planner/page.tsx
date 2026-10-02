"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { HEROES, localizedHero, heroImageUrl } from "../../../lib/content/heroes";
import { COLLECTION_ITEMS, EXCLUSIVE_COLLECTION_HEROES, collectionImageUrl, localizedItem } from "../../../lib/content/collection";
import { CRYPTIDES, cryptideImageUrl, localizedCryptideName, skillText as cryptideSkillText } from "../../../lib/content/cryptides";
import { MODELED_HEROES, MODELED_ITEMS, skillFor, validateBattle, type Fighter, type BattleOptions, type CryptidSelection, type SearchResult } from "../../../lib/calculators/hero-battle";
import { baseValueSource } from "../../../lib/calculators/hero-base-value";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PageHead } from "../../components/Ui";
import { createPersistentStore } from "../../components/persistentStore";
import styles from "./planner.module.css";

type Saved = { heroes: Fighter[]; enemy: Fighter[]; heroLevel: number; options: BattleOptions };
const defaultCryptides = (): NonNullable<BattleOptions["cryptides"]> => [];
const fighter = (id: string): Fighter => ({ id, atk: baseValueSource(id)?.attack ?? 0, hp: 0, stars: 0 });
const initial: Saved = {
  heroes: [], enemy: [], heroLevel: 100,
  options: { rounds: 10, seed: 42, trials: 16, budget: 500, size: 3, enemyCount: 1, infiniteDummy: true, enemyFirst: false, objective: "damage", enemy: [], dummy: true, enemyReduction: 0, items: [], collection: [], collectionSlots: 6, cryptides: defaultCryptides() },
};
const store = createPersistentStore<Saved>({
  key: "popepoch-hero-simulator-v3", serverValue: initial, fallback: () => initial, serialize: JSON.stringify,
  parse: (raw) => {
    try {
      const value = JSON.parse(raw ?? "null") as Partial<Saved>;
      if (!value || !Array.isArray(value.heroes) || !value.options) return null;
      const valid = (unit: Fighter) => unit && typeof unit.id === "string" && HEROES.some((hero) => hero.id === unit.id) && [unit.atk, unit.hp, unit.stars].every(Number.isFinite);
      if (!value.heroes.every(valid) || (value.enemy !== undefined && (!Array.isArray(value.enemy) || !value.enemy.every(valid)))) return null;
      if (![value.options.rounds, value.options.seed, value.options.size, value.options.trials, value.options.budget, value.options.enemyReduction].every(Number.isFinite)) return null;
      if (!Array.isArray(value.options.items) || !Array.isArray(value.options.collection) || !Array.isArray(value.options.cryptides)) return null;
      const prior = value.options.cryptides.filter((entry): entry is CryptidSelection => Boolean(entry && CRYPTIDES.some((cryptide) => cryptide.id === entry.id) && [1, 2, 3].includes(entry.skills)));
      const cryptides = CRYPTIDES.map((entry) => prior.find((selection) => selection.id === entry.id) ?? null);
      return { heroes: value.heroes, enemy: value.enemy ?? [], heroLevel: Number.isFinite(value.heroLevel) ? value.heroLevel! : 100, options: { ...initial.options, ...value.options, cryptides } };
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
  const worker = useRef<Worker | null>(null);
  const signature = JSON.stringify(input);
  useDocumentTitle(sim.title);
  useEffect(() => () => worker.current?.terminate(), []);
  const stop = () => { worker.current?.terminate(); worker.current = null; setRunning(false); };
  const update = (patch: Partial<Saved>) => { stop(); setError(false); store.set({ ...input, ...patch }); };
  const options = (patch: Partial<BattleOptions>) => update({ options: { ...input.options, ...patch } });
  const editHero = (id: string, patch: Partial<Fighter>) => update({ heroes: input.heroes.map((hero) => hero.id === id ? { ...hero, ...patch } : hero) });
  const editEnemy = (id: string, patch: Partial<Fighter>) => update({ enemy: input.enemy.map((hero) => hero.id === id ? { ...hero, ...patch } : hero) });
  const heroName = (id: string) => HEROES.find((hero) => hero.id === id)?.name ?? id;
  const itemName = (id: string) => { const item = COLLECTION_ITEMS.find((entry) => entry.id === id); return item ? localizedItem(item, t.guideEntries.collection.collectionTexts).name : id; };
  const cryptideName = (id: string) => { const cryptide = CRYPTIDES.find((entry) => entry.id === id); return cryptide ? localizedCryptideName(cryptide, t.guideEntries.cryptides.cryptideTexts) : id; };
  const actorName = (id: string) => CRYPTIDES.some((entry) => entry.id === id) ? cryptideName(id) : COLLECTION_ITEMS.some((entry) => entry.id === id) ? itemName(id) : id === "dummy" ? sim.dummy : id === "allies" ? sim.ally : id === "enemies" ? sim.enemy : heroName(id);
  const fmt = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const toggleOwned = (id: string, checked: boolean) => update({ heroes: checked ? [...input.heroes, fighter(id)] : input.heroes.filter((hero) => hero.id !== id) });
  const toggleEnemy = (id: string, checked: boolean) => update({ enemy: checked ? [...input.enemy, fighter(id)] : input.enemy.filter((hero) => hero.id !== id) });
  const toggleCryptide = (id: string, checked: boolean) => {
    const selected = new Map((input.options.cryptides ?? defaultCryptides()).flatMap((entry) => entry ? [[entry.id, entry] as const] : []));
    if (checked) selected.set(id, { id, skills: 1 }); else selected.delete(id);
    options({ cryptides: CRYPTIDES.flatMap((entry) => selected.has(entry.id) ? [selected.get(entry.id)!] : []) });
  };
  const setCryptideSkill = (id: string, skills: 1 | 2 | 3) => options({ cryptides: (input.options.cryptides ?? defaultCryptides()).map((entry) => entry?.id === id ? { ...entry, skills } : entry) });
  const run = () => {
    stop(); setError(false);
    const dummy = input.enemy.length === 0;
    const config: BattleOptions = { ...input.options, dummy, enemy: input.enemy, items: input.options.items.filter((id) => MODELED_ITEMS.has(id)), collection: input.options.collection.filter((id) => MODELED_ITEMS.has(id) && !EXCLUSIVE_COLLECTION_HEROES[id]), collectionSlots: 6 };
    const pool = input.heroes.map((hero) => ({ ...hero, level: input.heroLevel }));
    try {
      validateBattle(pool, config);
      const next = new Worker(new URL("./battle.worker.ts", import.meta.url));
      worker.current = next; setProgress(0); setRunning(true); setResult(null);
      next.onmessage = (event: MessageEvent<{ done?: number; error?: boolean; result?: SearchResult }>) => {
        if (event.data.done !== undefined) setProgress(event.data.done);
        if (event.data.error) { setError(true); stop(); }
        if (event.data.result) { setResult({ data: event.data.result, key: signature, rounds: config.rounds, dummy }); stop(); }
      };
      next.onerror = () => { setError(true); stop(); };
      next.postMessage({ pool, options: config });
    } catch { setError(true); }
  };
  const chart = (rows: { x: number; y: number }[], label: string) => {
    const maxX = Math.max(1, ...rows.map((row) => row.x)), maxY = Math.max(1, ...rows.map((row) => row.y));
    return <svg className={styles.chart} viewBox="0 0 600 180" role="img" aria-label={label}><title>{label}</title><path d="M40 10 V150 H590" fill="none" stroke="currentColor" opacity=".4" /><polyline points={rows.map((row) => (40 + row.x / maxX * 550) + "," + (150 - row.y / maxY * 130)).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="3" /><text x="40" y="175">0</text><text x="560" y="175">{maxX}</text><text x="45" y="20">{fmt(maxY)}</text></svg>;
  };
  const roster = (enemy = false) => {
    const chosen = enemy ? input.enemy : input.heroes;
    const edit = enemy ? editEnemy : editHero;
    const toggle = enemy ? toggleEnemy : toggleOwned;
    return <div className={styles.roster} role="list">{HEROES.filter((hero) => hero.name.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale))).map((hero) => {
      const own = chosen.find((entry) => entry.id === hero.id);
      const localized = localizedHero(hero, t.guideEntries.heroes.heroTexts, t.guideEntries.collection.collectionTexts);
      const exclusive = Object.entries(EXCLUSIVE_COLLECTION_HEROES).find(([, owner]) => owner === hero.id);
      return <div className={styles.heroRow + (own ? " " + styles.owned : "")} key={(enemy ? "enemy-" : "ally-") + hero.id} role="listitem">
        <label className={styles.heroCheck}><input type="checkbox" checked={Boolean(own)} onChange={(event) => toggle(hero.id, event.target.checked)} />{hero.images[0] && <img src={heroImageUrl(hero.images[0])} alt="" width={34} height={34} loading="lazy" />}<span>{hero.name}<small>{hero.rarity}{!MODELED_HEROES.has(hero.id) ? " · " + sim.baseSkillOnly : ""}</small></span></label>
        {own && <><label>{sim.stars}<input aria-label={hero.name + ": " + sim.stars} type="number" min={0} max={1000} value={Number.isNaN(own.stars) ? "" : own.stars} onChange={(event) => edit(hero.id, { stars: event.target.valueAsNumber })} /></label>
          <label>{sim.atk}<input aria-label={hero.name + ": " + sim.atk} type="number" min={0} max={1e9} value={Number.isNaN(own.atk) ? "" : own.atk} onChange={(event) => edit(hero.id, { atk: event.target.valueAsNumber })} /></label>
          <label>{sim.hp}<input aria-label={hero.name + ": " + sim.hp} type="number" min={1} max={1e12} value={own.hp || ""} onChange={(event) => edit(hero.id, { hp: event.target.valueAsNumber })} /></label>
          {exclusive && !enemy && <label className={styles.inlineCheck}><input type="checkbox" checked={input.options.items.includes(exclusive[0])} onChange={(event) => options({ items: event.target.checked ? [...input.options.items, exclusive[0]] : input.options.items.filter((id) => id !== exclusive[0]) })} /><span>{itemName(exclusive[0])}</span></label>}
          <details className={styles.skillDetail}><summary>{text.reference}</summary><p>{localized.skill?.levels[(skillFor(own)?.level ?? 1) - 1] ?? hero.skill?.levels[0] ?? "Workbook direct-damage fallback; secondary skill effects are not recorded."}</p></details>
        </>}
      </div>;
    })}</div>;
  };
  const knownCollection = COLLECTION_ITEMS.filter((item) => !EXCLUSIVE_COLLECTION_HEROES[item.id]);
  const selectedCryptides = input.options.cryptides ?? defaultCryptides();
  const selectedHeroCount = input.heroes.length;
  const missingHp = [...input.heroes, ...input.enemy].filter((hero) => !Number.isFinite(hero.hp) || hero.hp <= 0).length;
  const unsupportedHeroes = input.heroes.filter((hero) => !MODELED_HEROES.has(hero.id)).map((hero) => heroName(hero.id));
  const unsupportedItems = [...input.options.items, ...input.options.collection].filter((id) => !MODELED_ITEMS.has(id)).map(itemName);
  return <div className={styles.planner}>
    <PageHead eyebrow={t.nav.simulations} title={sim.title} lede={sim.intro} />
    <aside className={styles.notice}><p>{sim.stats}</p><details><summary>{text.details}</summary><p>{sim.model}</p><p>{sim.searchNote}</p><p>{sim.combatFlow}</p></details></aside>
    <section className="panel">
      <h2>{sim.setup}</h2>
      <div className={styles.controls}>
        <label>{sim.size}<input type="number" min={1} max={25} value={Number.isNaN(input.options.size) ? "" : input.options.size} onChange={(event) => options({ size: event.target.valueAsNumber })} /></label>
        <label>{sim.heroLevel}<input type="number" min={1} max={1000} value={Number.isNaN(input.heroLevel) ? "" : input.heroLevel} onChange={(event) => update({ heroLevel: event.target.valueAsNumber })} /></label>
        <label>{sim.round}<input type="number" min={1} max={100} value={Number.isNaN(input.options.rounds) ? "" : input.options.rounds} onChange={(event) => options({ rounds: event.target.valueAsNumber })} /></label>
        <label>{sim.trials}<input type="number" min={1} max={128} value={Number.isNaN(input.options.trials) ? "" : input.options.trials} onChange={(event) => options({ trials: event.target.valueAsNumber })} /></label>
        <label>{sim.budget}<input type="number" min={1} max={1000} value={Number.isNaN(input.options.budget) ? "" : input.options.budget} onChange={(event) => options({ budget: event.target.valueAsNumber })} /></label>
        <label className={styles.inlineCheck}><input type="checkbox" checked={input.options.enemyFirst} onChange={(event) => options({ enemyFirst: event.target.checked })} />{sim.enemyFirst}</label>
        <label>{sim.reduction}<input type="number" min={0} max={0.9} step={0.05} value={Number.isNaN(input.options.enemyReduction) ? "" : input.options.enemyReduction} onChange={(event) => options({ enemyReduction: event.target.valueAsNumber })} /></label>
      </div>
      <p>{sim.inventoryNote} · {text.heroes}: {selectedHeroCount} · {sim.size}: {input.options.size}</p>
      <div className={styles.controls}><label>{text.search}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="button" onClick={() => update({ heroes: [] })}>{text.none}</button></div>
      <h3>{text.heroes}</h3>{roster()}
      <details className={styles.subsection}><summary>{sim.enemy} · {input.enemy.length} / 25</summary><p>{sim.trainingTargetNote}</p>{roster(true)}</details>
    </section>
    <section className="panel">
      <h2>{sim.cryptidSetup}</h2>
      <p>{sim.cryptidOrderNote}</p>
      <div className={styles.items}>{CRYPTIDES.map((cryptide) => {
        const selection = selectedCryptides.find((entry) => entry?.id === cryptide.id);
        const skillLevel = selection?.skills ?? 1;
        return <div className={styles.cryptideRow} key={cryptide.id}>
          <label className={styles.inlineCheck}><input type="checkbox" checked={Boolean(selection)} onChange={(event) => toggleCryptide(cryptide.id, event.target.checked)} />{cryptideImageUrl(cryptide.image) && <img src={cryptideImageUrl(cryptide.image)} alt="" width={38} height={38} />}<span>{cryptideName(cryptide.id)}</span></label>
          {selection && <label>{sim.unlockedSkills}<select value={skillLevel} onChange={(event) => setCryptideSkill(cryptide.id, Number(event.target.value) as 1 | 2 | 3)}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>}
          {selection && <details><summary>{sim.cryptidSkills}</summary>{cryptide.skills.slice(0, skillLevel).map((skill) => { const translated = cryptideSkillText(cryptide.id, skill.id, t.guideEntries.cryptides.cryptideTexts); return <p key={skill.id}><strong>{translated.name}</strong>: {translated.body}</p>; })}</details>}
          <small>{sim.autoOrder}</small>
        </div>;
      })}</div>
    </section>
    <section className="panel">
      <h2>{sim.collectionOwned}</h2><p>{sim.itemsNote}</p>
      <label>{sim.collectionSearch}<input type="search" value={collectionSearch} onChange={(event) => setCollectionSearch(event.target.value)} /></label>
      <div className={styles.items}>{knownCollection.filter((item) => itemName(item.id).toLocaleLowerCase(locale).includes(collectionSearch.toLocaleLowerCase(locale))).map((item) => {
        const supported = MODELED_ITEMS.has(item.id);
        return <label className={styles.itemRow} key={item.id}><input type="checkbox" checked={input.options.collection.includes(item.id)} onChange={(event) => options({ collection: event.target.checked ? [...input.options.collection, item.id] : input.options.collection.filter((owned) => owned !== item.id) })} /><img src={collectionImageUrl(item.image)} alt="" width={34} height={34} loading="lazy" /><span>{itemName(item.id)}</span><small>{supported ? sim.modeled : sim.dataGap}</small></label>;
      })}</div>
      <details className={styles.subsection}><summary>{sim.unsupportedCollection}</summary><p>{COLLECTION_ITEMS.filter((item) => EXCLUSIVE_COLLECTION_HEROES[item.id]).map((item) => itemName(item.id)).join(", ")}</p></details>
    </section>
    <section className={styles.gaps} aria-label={sim.dataGaps}><h2>{sim.dataGaps}</h2><ul>
      <li>{sim.gapLevel}</li><li>{sim.gapSkills}</li><li>{sim.gapSystems}</li><li>{sim.gapCryptides}</li>
      {missingHp > 0 && <li>{sim.gapHp.replace("{count}", String(missingHp))}</li>}
      {unsupportedHeroes.length > 0 && <li>{sim.gapHeroes}: {unsupportedHeroes.join(", ")}.</li>}
      {unsupportedItems.length > 0 && <li>{sim.gapItems}: {unsupportedItems.join(", ")}.</li>}
    </ul></section>
    <div className={styles.runbar}><button className="button" disabled={running || selectedHeroCount < input.options.size || missingHp > 0} onClick={run}>{sim.run}</button>{running && <><button className="button" onClick={stop}>{sim.cancel}</button><span role="status">{sim.running}: {progress} / {input.options.budget}</span></>}</div>
    {error && <p role="alert">{sim.notReady}</p>}
    <section aria-label={sim.results}><h2>{sim.results}</h2>{!result ? <p>{sim.empty}</p> : <>
      {result.key !== signature && <p role="status">{sim.stale}</p>}
      <p>{sim.evaluated}: {result.data.evaluated} · {result.data.exhaustive ? sim.exhaustive : sim.sampled} · {sim.validation}: {result.data.validationTrials}</p>
      <div className={styles.results}>{result.data.candidates.map((candidate, index) => <article className="panel" key={candidate.team.map((hero) => hero.id).join(",") + "|" + candidate.collection.join(",")}><h3>{sim.best} {index + 1}</h3><strong className={styles.metric}>{fmt(candidate.damage / result.rounds)}</strong><p>{sim.perRound}</p><dl><dt>{sim.totalDamage}</dt><dd>{fmt(candidate.damage)}</dd><dt>{sim.deviation}</dt><dd>± {fmt(candidate.deviation)}</dd><dt>{sim.healing}</dt><dd>{fmt(candidate.healing)}</dd><dt>{sim.wins}</dt><dd>{result.dummy ? "—" : fmt(candidate.winRate * 100) + "%"}</dd><dt>{sim.remaining}</dt><dd>{fmt(candidate.remaining * 100)}%</dd></dl><ol className={styles.team}>{candidate.team.map((hero) => { const exclusive = Object.entries(EXCLUSIVE_COLLECTION_HEROES).find(([id, owner]) => owner === hero.id && input.options.items.includes(id)); return <li key={hero.id}><strong>{heroName(hero.id)}</strong><small>{hero.stars} {sim.stars} · Lv. {hero.level} · ATK {fmt(hero.atk)} · HP {fmt(hero.hp)}{exclusive ? " · " + itemName(exclusive[0]) : ""}</small></li>; })}</ol><h4>{sim.bestCollection}</h4><ul className={styles.team}>{candidate.collection.map((id) => <li key={id}>{itemName(id)}</li>)}</ul></article>)}</div>
      <h3>{sim.timeline}</h3>{chart(result.data.trace.timeline.map((row) => ({ x: row.round, y: row.damage })), sim.timeline)}
      <details open><summary>{sim.trace} · {result.data.trace.events.length} {sim.eventsLogged}</summary><p>{sim.logNote}</p><div className={styles.log}><table><thead><tr><th>{sim.round}</th><th>{text.heroes}</th><th>{sim.action}</th><th>{sim.enemy}</th><th>{sim.amount}</th><th>{sim.hp}</th></tr></thead><tbody>{result.data.trace.events.map((event, index) => <tr key={index}><td>{event.round}</td><td>{actorName(event.actor)}</td><td>{event.action.startsWith("fall:") ? sim.events.fall : event.action === "skillRoll" ? sim.skillRoll : event.action === "buff" ? sim.buff : event.action === "debuff" ? sim.debuff : sim.events[event.action as keyof typeof sim.events] ?? event.action}{event.effectKey ? ` · ${sim.effects[event.effectKey as keyof typeof sim.effects] ?? actorName(event.effectKey)}` : ""}{event.duration ? ` · ${event.duration}t` : ""}</td><td>{event.target ? actorName(event.target) : "—"}</td><td>{event.action === "skillRoll" ? `${fmt((event.chance ?? 0) * 100)}% ${event.succeeded ? "✓" : "×"}` : `${fmt(event.amount)}${event.raw !== undefined && event.raw !== event.amount ? ` (raw ${fmt(event.raw)})` : ""}`}</td><td>{event.hpBefore !== undefined ? `${fmt(event.hpBefore)} → ${fmt(event.hpAfter ?? event.hpBefore)}` : "—"}</td></tr>)}</tbody></table></div></details>
    </>}</section>
    <footer className={styles.notice}><p>{text.saved}</p><p>{text.sources}: <Link href="/guides/heroes/">{t.guideEntries.heroes.title}</Link> · <Link href="/guides/hero-layouts/">{t.guideEntries.heroLayouts.title}</Link> · <Link href="/guides/collection/">{t.guideEntries.collection.title}</Link></p><p>{text.credit}</p></footer>
  </div>;
}
