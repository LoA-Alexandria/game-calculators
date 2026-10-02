"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { HEROES, localizedHero, heroImageUrl } from "../../../lib/content/heroes";
import { COLLECTION_ITEMS, EXCLUSIVE_COLLECTION_HEROES, collectionImageUrl, localizedItem } from "../../../lib/content/collection";
import { CRYPTIDES, cryptideImageUrl, localizedCryptideName, skillText as cryptideSkillText } from "../../../lib/content/cryptides";
import { MODELED_HEROES, MODELED_ITEMS, skillFor, validateBattle, type Fighter, type BattleOptions, type BattleEvent, type CryptidSelection, type SearchResult } from "../../../lib/calculators/hero-battle";
import { baseValueSource } from "../../../lib/calculators/hero-base-value";
import { FORMATION_COLUMNS, FORMATION_ORDER } from "../../../lib/content/hero-layouts";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PageHead } from "../../components/Ui";
import { createPersistentStore } from "../../components/persistentStore";
import styles from "./planner.module.css";

type Saved = { heroes: Fighter[]; enemy: Fighter[]; heroLevel: number; options: BattleOptions };
const defaultCryptides = (): NonNullable<BattleOptions["cryptides"]> => [];
// Compact mode uses one fixed profile so selecting a roster never asks for per-hero stats.
const DEFAULT_HERO_HP = 100_000;
const DEFAULT_HERO_STARS = 40;
const fighter = (id: string): Fighter => {
  const source = baseValueSource(id);
  return { id, atk: source?.attack ?? 5, hp: DEFAULT_HERO_HP, stars: source ? Math.max(0, (source.starColor - 1) * 5) : DEFAULT_HERO_STARS };
};
const withDefaultProfile = (unit: Fighter): Fighter => ({ ...unit, ...fighter(unit.id) });
const initial: Saved = {
  heroes: [], enemy: [], heroLevel: 100,
  options: { rounds: 10, seed: 42, trials: 16, budget: 500, size: 3, enemyCount: 1, infiniteDummy: true, objective: "damage", enemy: [], dummy: true, enemyReduction: 0, items: [], collection: [], collectionSlots: 6, cryptides: defaultCryptides() },
};
const store = createPersistentStore<Saved>({
  key: "popepoch-hero-simulator-v3", serverValue: initial, fallback: () => initial, serialize: JSON.stringify,
  parse: (raw) => {
    try {
      const value = JSON.parse(raw ?? "null") as Partial<Saved>;
      if (!value || !Array.isArray(value.heroes) || !value.options) return null;
      const valid = (unit: Fighter) => unit && typeof unit.id === "string" && HEROES.some((hero) => hero.id === unit.id);
      if (!value.heroes.every(valid) || (value.enemy !== undefined && (!Array.isArray(value.enemy) || !value.enemy.every(valid)))) return null;
      if (![value.options.rounds, value.options.seed, value.options.size, value.options.trials, value.options.budget, value.options.enemyReduction].every(Number.isFinite)) return null;
      if (!Array.isArray(value.options.items) || !Array.isArray(value.options.collection) || !Array.isArray(value.options.cryptides)) return null;
      const prior = value.options.cryptides.filter((entry): entry is CryptidSelection => Boolean(entry && CRYPTIDES.some((cryptide) => cryptide.id === entry.id) && [1, 2, 3].includes(entry.skills)));
      const cryptides = CRYPTIDES.flatMap((entry) => { const selection = prior.find((candidate) => candidate.id === entry.id); return selection ? [selection] : []; });
      return { heroes: value.heroes.map(withDefaultProfile), enemy: (value.enemy ?? []).map(withDefaultProfile), heroLevel: Number.isFinite(value.heroLevel) ? value.heroLevel! : 100, options: { ...initial.options, ...value.options, cryptides } };
    } catch { return null; }
  },
});

export default function HeroSimulator() {
  const { t, locale } = useLocale();
  const text = t.heroTeamPlanner, sim = t.heroBattle;
  const input = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
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
  const heroName = (id: string) => HEROES.find((hero) => hero.id === id)?.name ?? id;
  const itemName = (id: string) => { const item = COLLECTION_ITEMS.find((entry) => entry.id === id); return item ? localizedItem(item, t.guideEntries.collection.collectionTexts).name : id; };
  const cryptideName = (id: string) => { const cryptide = CRYPTIDES.find((entry) => entry.id === id); return cryptide ? localizedCryptideName(cryptide, t.guideEntries.cryptides.cryptideTexts) : id; };
  const actorName = (id: string) => CRYPTIDES.some((entry) => entry.id === id) ? cryptideName(id) : COLLECTION_ITEMS.some((entry) => entry.id === id) ? itemName(id) : id === "dummy" ? sim.dummy : id === "allies" ? sim.ally : id === "enemies" ? sim.enemy : heroName(id);
  const fmt = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const toggleOwned = (id: string, checked: boolean) => update({ heroes: checked ? [...input.heroes, fighter(id)] : input.heroes.filter((hero) => hero.id !== id) });
  const toggleEnemy = (id: string, checked: boolean) => update({ enemy: checked ? [...input.enemy, fighter(id)] : input.enemy.filter((hero) => hero.id !== id) });
  const toggleAllHeroes = () => update({ heroes: HEROES.map((hero) => input.heroes.find((owned) => owned.id === hero.id) ?? fighter(hero.id)) });
  const toggleCryptide = (id: string, checked: boolean) => {
    const selected = new Map((input.options.cryptides ?? defaultCryptides()).flatMap((entry) => entry ? [[entry.id, entry] as const] : []));
    if (checked) selected.set(id, { id, skills: 1 }); else selected.delete(id);
    options({ cryptides: CRYPTIDES.flatMap((entry) => { const selection = selected.get(entry.id); return selection ? [selection] : []; }) });
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
    const toggle = enemy ? toggleEnemy : toggleOwned;
    const filtered = HEROES.filter((hero) => hero.name.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale))
      && (enemy || rarityFilter === "all" || hero.rarity === rarityFilter)
      && (enemy || !showSelectedOnly || chosen.some((entry) => entry.id === hero.id)));
    return <div className={styles.roster} role="list">{filtered.map((hero) => {
      const own = chosen.find((entry) => entry.id === hero.id);
      const localized = localizedHero(hero, t.guideEntries.heroes.heroTexts, t.guideEntries.collection.collectionTexts);
      const exclusive = Object.entries(EXCLUSIVE_COLLECTION_HEROES).find(([, owner]) => owner === hero.id);
      const profile = own ? withDefaultProfile(own) : fighter(hero.id);
      const selectedSkill = skillFor(profile);
      const skill = localized.skill?.levels[selectedSkill ? Math.max(0, selectedSkill.level - 1) : 0] ?? hero.skill?.levels[0] ?? "No battle-skill record is published for this hero yet.";
      const skillInfo = `${skill}\n\n${MODELED_HEROES.has(hero.id) ? sim.modeled : sim.heroEffectNotModeled}`;
      return <div className={styles.heroRow + (own ? " " + styles.owned : "")} key={(enemy ? "enemy-" : "ally-") + hero.id} role="listitem">
        <label className={styles.heroCheck} title={skillInfo}><input type="checkbox" aria-label={`${hero.name}: ${text.heroes}`} checked={Boolean(own)} onChange={(event) => toggle(hero.id, event.target.checked)} />{hero.images[0] && <img src={heroImageUrl(hero.images[0])} alt="" width={34} height={34} loading="lazy" />}<span>{hero.name}<small>{hero.rarity}{!MODELED_HEROES.has(hero.id) ? " · " + sim.baseSkillOnly : ""}</small></span></label>
        {exclusive && !enemy ? <label className={styles.exclusiveCheck} title={`${itemName(exclusive[0])}: ${localizedItem(COLLECTION_ITEMS.find((item) => item.id === exclusive[0])!, t.guideEntries.collection.collectionTexts).skillText}`}><input type="checkbox" aria-label={`${hero.name}: ${itemName(exclusive[0])}`} checked={input.options.items.includes(exclusive[0])} onChange={(event) => options({ items: event.target.checked ? [...input.options.items, exclusive[0]] : input.options.items.filter((id) => id !== exclusive[0]) })} /><img src={collectionImageUrl(COLLECTION_ITEMS.find((item) => item.id === exclusive[0])!.image)} alt="" width={28} height={28} /><span>{itemName(exclusive[0])}</span></label> : !enemy ? <span className={styles.noExclusive} aria-hidden="true">—</span> : null}
      </div>;
    })}</div>;
  };
  const knownCollection = COLLECTION_ITEMS.filter((item) => !EXCLUSIVE_COLLECTION_HEROES[item.id]);
  const selectedCryptides = (input.options.cryptides ?? defaultCryptides()).filter((entry): entry is CryptidSelection => entry !== null);
  const selectedHeroCount = input.heroes.length;
  const replay = result?.data.trace;
  const best = result?.data.candidates[0];
  const eventsByRound = new Map<number, BattleEvent[]>();
  replay?.events.forEach((event) => {
    const rows = eventsByRound.get(event.round) ?? [];
    rows.push(event);
    eventsByRound.set(event.round, rows);
  });
  const unsupportedHeroes = input.heroes.filter((hero) => !MODELED_HEROES.has(hero.id)).map((hero) => heroName(hero.id));
  const unsupportedItems = [...input.options.items, ...input.options.collection].filter((id) => !MODELED_ITEMS.has(id)).map(itemName);
  return <div className={styles.planner}>
    <PageHead eyebrow={t.nav.simulations} title={sim.title} lede={sim.intro} />
    <aside className={styles.notice} title={`${sim.model}\n\n${sim.searchNote}`}><p>{sim.stats}</p><p>{sim.combatFlow}</p></aside>
    <section className="panel">
      <h2>{sim.setup}</h2>
      <div className={styles.controls}>
        <label>{sim.size}<input type="number" min={1} max={25} value={Number.isNaN(input.options.size) ? "" : input.options.size} onChange={(event) => options({ size: event.target.valueAsNumber })} /></label>
        <label>{sim.heroLevel}<input type="number" min={1} max={1000} value={Number.isNaN(input.heroLevel) ? "" : input.heroLevel} onChange={(event) => update({ heroLevel: event.target.valueAsNumber })} /></label>
        <label>{sim.round}<input type="number" min={1} max={100} value={Number.isNaN(input.options.rounds) ? "" : input.options.rounds} onChange={(event) => options({ rounds: event.target.valueAsNumber })} /></label>
        <label>{sim.trials}<input type="number" min={1} max={128} value={Number.isNaN(input.options.trials) ? "" : input.options.trials} onChange={(event) => options({ trials: event.target.valueAsNumber })} /></label>
        <label>{sim.budget}<input type="number" min={1} max={1000} value={Number.isNaN(input.options.budget) ? "" : input.options.budget} onChange={(event) => options({ budget: event.target.valueAsNumber })} /></label>
        <label>{sim.reduction}<input type="number" min={0} max={0.9} step={0.05} value={Number.isNaN(input.options.enemyReduction) ? "" : input.options.enemyReduction} onChange={(event) => options({ enemyReduction: event.target.valueAsNumber })} /></label>
      </div>
      <p>{sim.inventoryNote} · {sim.fixedProfile} · {text.heroes}: {selectedHeroCount} · {sim.size}: {input.options.size}</p>
      <div className={styles.rosterToolbar}>
        <label>{text.search}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>{sim.rarityFilter}<select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)}><option value="all">{sim.allRarities}</option>{[...new Set(HEROES.map((hero) => hero.rarity))].map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}</select></label>
        <label className={styles.inlineCheck}><input type="checkbox" checked={showSelectedOnly} onChange={(event) => setShowSelectedOnly(event.target.checked)} />{sim.showSelectedOnly}</label>
        <span className={styles.rosterCount}>{input.heroes.length} / {HEROES.length} {text.heroes}</span>
        <div className={styles.rosterActions}><button className="button" onClick={toggleAllHeroes}>{sim.selectEveryHero}</button><button className="button" onClick={() => update({ heroes: [] })}>{text.none}</button></div>
      </div>
      <h3>{text.heroes}</h3>{roster()}
      <div className={styles.subsection}><h3>{sim.enemy} · {input.enemy.length} / 25</h3><p>{sim.trainingTargetNote}</p>{roster(true)}</div>
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
          {selection && <span className={styles.hoverInfo} title={cryptide.skills.slice(0, skillLevel).map((skill) => { const translated = cryptideSkillText(cryptide.id, skill.id, t.guideEntries.cryptides.cryptideTexts); return `${translated.name}: ${translated.body}`; }).join("\n\n")}>{sim.cryptidSkills} ⓘ</span>}
        </div>;
      })}</div>
    </section>
    <section className="panel">
      <h2>{sim.collectionOwned}</h2><p>{sim.itemsNote}</p>
      <label>{sim.collectionSearch}<input type="search" value={collectionSearch} onChange={(event) => setCollectionSearch(event.target.value)} /></label>
      <div className={styles.items}>{knownCollection.filter((item) => itemName(item.id).toLocaleLowerCase(locale).includes(collectionSearch.toLocaleLowerCase(locale))).map((item) => {
        const supported = MODELED_ITEMS.has(item.id);
        return <label className={styles.itemRow} key={item.id} title={item.skill.text}><input type="checkbox" checked={input.options.collection.includes(item.id)} onChange={(event) => options({ collection: event.target.checked ? [...input.options.collection, item.id] : input.options.collection.filter((owned) => owned !== item.id) })} /><img src={collectionImageUrl(item.image)} alt="" width={34} height={34} loading="lazy" /><span>{itemName(item.id)}</span><small>{supported ? sim.modeled : sim.effectNotModeled}</small></label>;
      })}</div>
    </section>
    <section className={styles.gaps} aria-label={sim.dataGaps}><h2>{sim.dataGaps}</h2><ul>
      <li>{sim.gapLevel}</li><li>{sim.gapSkills}</li><li>{sim.gapSystems}</li><li>{sim.gapCryptides}</li>
      {unsupportedHeroes.length > 0 && <li>{sim.gapHeroes}: {unsupportedHeroes.join(", ")}.</li>}
      {unsupportedItems.length > 0 && <li>{sim.gapItems}: {unsupportedItems.join(", ")}.</li>}
    </ul></section>
    <div className={styles.runbar}><button className="button" disabled={running || selectedHeroCount < input.options.size} onClick={run}>{sim.run}</button>{running && <><button className="button" onClick={stop}>{sim.cancel}</button><span role="status">{sim.running}: {progress} / {input.options.budget}</span></>}</div>
    {error && <p role="alert">{sim.notReady}</p>}
    <section aria-label={sim.results}><h2>{sim.results}</h2>{!result ? <p>{sim.empty}</p> : <>
      {result.key !== signature && <p role="status">{sim.stale}</p>}
      <p>{sim.evaluated}: {result.data.evaluated} · {result.data.exhaustive ? sim.exhaustive : sim.sampled} · {sim.validation}: {result.data.validationTrials}</p>
      {best && <article className={`panel ${styles.bestResult}`}>
        <h3>{sim.bestLayout}</h3>
        <p>{sim.actionLimitNote}</p>
        <div className={styles.formationWrap} aria-label={sim.bestLayout}>
          {FORMATION_ORDER.map((column) => <div className={styles.formationColumn} key={column}>
            <h4>{sim[`formation${column[0].toUpperCase()}${column.slice(1)}` as "formationBack" | "formationMiddle" | "formationFront"]}</h4>
            {FORMATION_COLUMNS[column].map((slot) => {
              const hero = slot ? best.team[slot - 1] : null;
              const sourceHero = hero ? HEROES.find((entry) => entry.id === hero.id) : undefined;
              return <div className={styles.formationCell + (hero ? " " + styles.occupied : " " + styles.emptySlot)} key={slot || `${column}-empty`}>
                {hero ? <>{sourceHero?.images[0] && <img src={heroImageUrl(sourceHero.images[0])} alt="" width={36} height={36} />}<span className={styles.slotNumber}>{slot}</span><strong>{heroName(hero.id)}</strong><small>{slot}{Object.entries(EXCLUSIVE_COLLECTION_HEROES).some(([id, owner]) => owner === hero.id && input.options.items.includes(id)) ? ` · ${sim.exclusiveEquipped}` : ""}</small></> : <span aria-hidden="true">·</span>}
              </div>;
            })}
          </div>)}
        </div>
        <h4>{sim.bestCollection}</h4>
        <div className={styles.resultItems}>{best.collection.map((id) => { const item = COLLECTION_ITEMS.find((entry) => entry.id === id); return <div className={styles.resultItem} key={id}>{item && <img src={collectionImageUrl(item.image)} alt="" width={32} height={32} />}<span>{itemName(id)}</span></div>; })}</div>
        <h4>{sim.autoOrder}</h4>
        <div className={styles.resultItems}>{best.cryptides.flatMap((selection, index) => selection ? [<div className={styles.resultItem} key={`${selection.id}-${index}`}><img src={cryptideImageUrl(CRYPTIDES.find((entry) => entry.id === selection.id)!.image)} alt="" width={32} height={32} /><span>{sim.round} {index + 1} · {cryptideName(selection.id)} · {sim.unlockedSkills} {selection.skills}</span></div>] : [])}</div>
        <div className={styles.results}><dl><dt>{sim.meanDamage}</dt><dd>{fmt(best.damage)}</dd><dt>{sim.perRound}</dt><dd>{fmt(best.damage / result.rounds)}</dd><dt>{sim.deviation}</dt><dd>± {fmt(best.deviation)}</dd><dt>{sim.healing}</dt><dd>{fmt(best.healing)}</dd><dt>{sim.wins}</dt><dd>{result.dummy ? "—" : fmt(best.winRate * 100) + "%"}</dd><dt>{sim.remaining}</dt><dd>{fmt(best.remaining * 100)}%</dd></dl></div>
      </article>}
      <h3>{sim.timeline}</h3>{chart(result.data.trace.timeline.map((row) => ({ x: row.round, y: row.damage })), sim.timeline)}
      <section className={styles.battleLog} aria-label={sim.trace}>
        <h3>{sim.trace} · {result.data.trace.events.length} {sim.eventsLogged}</h3><p>{sim.logNote}</p>
        <div className={styles.roundList}>{[...eventsByRound.entries()].map(([round, events]) => {
          const mainAction = events.find((event) => event.action === "heroAction");
          const enemyAction = events.find((event) => event.action === "heroAction" && event.side === 1);
          const cryptidAction = events.find((event) => event.action === "cryptidAction");
          return <article className={styles.roundCard} key={round}>
            <header><strong>{sim.round} {round}</strong><span>{mainAction ? `${actorName(mainAction.actor)} · ${mainAction.effectKey === "skillAttack" ? sim.skillAttack : sim.normalAttack} · ${fmt(mainAction.amount)} ${sim.damageUnit}` : sim.noHeroAttack}</span>{enemyAction && <span>{sim.enemyAction}: {actorName(enemyAction.actor)} · {enemyAction.effectKey === "skillAttack" ? sim.skillAttack : sim.normalAttack} · {fmt(enemyAction.amount)} {sim.damageUnit}</span>}{cryptidAction && <span className={styles.cryptidBadge}>{actorName(cryptidAction.actor)} · {sim.cryptidActionLabel} · {sim.onceOnly}</span>}</header>
            <div className={styles.roundTable}><table><thead><tr><th>{sim.action}</th><th>{sim.target}</th><th>{sim.amount}</th><th>{sim.hp}</th></tr></thead><tbody>{events.filter((event) => event.action !== "heroAction").map((event, index) => <tr key={`${event.actor}-${event.action}-${index}`}><td><strong>{event.action.startsWith("fall:") ? sim.events.fall : event.action === "skillRoll" ? sim.skillRoll : event.action === "buff" ? sim.buff : event.action === "debuff" ? sim.debuff : sim.events[event.action as keyof typeof sim.events] ?? event.action}</strong>{event.effectKey ? <small>{sim.effects[event.effectKey as keyof typeof sim.effects] ?? actorName(event.effectKey)}</small> : null}{event.duration ? <small>{event.duration}t</small> : null}{event.action === "skillRoll" && <small>{fmt((event.chance ?? 0) * 100)}% · {event.selected ? sim.rollSelected : !event.eligible ? sim.rollAlreadyUsed : event.succeeded ? sim.rollPassedNotSelected : sim.skillFailed}</small>}</td><td>{event.target ? actorName(event.target) : "—"}</td><td>{event.action === "skillRoll" ? "—" : `${fmt(event.amount)}${event.raw !== undefined && event.raw !== event.amount ? ` (${sim.rawDamage}: ${fmt(event.raw)})` : ""}`}</td><td>{event.hpBefore !== undefined ? `${fmt(event.hpBefore)} → ${fmt(event.hpAfter ?? event.hpBefore)}` : <span>{sim.ally}: {fmt(event.allyHp)} · {sim.enemy}: {fmt(event.enemyHp)}</span>}</td></tr>)}</tbody></table></div>
          </article>;
        })}</div>
      </section>
    </>}</section>
    <footer className={styles.notice}><p>{text.saved}</p><p>{text.sources}: <Link href="/guides/heroes/">{t.guideEntries.heroes.title}</Link> · <Link href="/guides/hero-layouts/">{t.guideEntries.heroLayouts.title}</Link> · <Link href="/guides/collection/">{t.guideEntries.collection.title}</Link></p><p>{text.credit}</p></footer>
  </div>;
}
