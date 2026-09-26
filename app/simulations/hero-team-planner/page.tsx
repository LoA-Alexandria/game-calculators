"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { HEROES, localizedHero, heroImageUrl } from "../../../lib/content/heroes";
import { COLLECTION_ITEMS, EXCLUSIVE_COLLECTION_HEROES, localizedItem } from "../../../lib/content/collection";
import { BUILDINGS, localizedBuildingName } from "../../../lib/content/buildings";
import { layoutTexts } from "../../../lib/content/hero-layouts";
import { planHeroTeams, PRODUCTION_BUILDINGS, type TeamInput, type OwnedHero } from "../../../lib/calculators/hero-team";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PageHead } from "../../components/Ui";
import styles from "./planner.module.css";
import { createPersistentStore } from "../../components/persistentStore";

const initial: TeamInput = { heroes: [], items: [], collection: ["", "", ""], size: 5, mode: "combat", building: PRODUCTION_BUILDINGS[0] };
const storageKey = "popepoch-hero-team-v1";
const store = createPersistentStore<TeamInput>({
  key: storageKey, serverValue: initial, fallback: () => initial, serialize: JSON.stringify,
  parse: (raw) => {
    try {
      const value = JSON.parse(raw ?? "null") as TeamInput;
      if (!value || !Array.isArray(value.heroes) || !Array.isArray(value.items) || !Array.isArray(value.collection) || value.collection.length > 25) return null;
      if (!value.items.every((id) => typeof id === "string") || !value.collection.every((id) => typeof id === "string")) return null;
      if (!value.heroes.every((hero) => hero && HEROES.some((entry) => entry.id === hero.id))) return null;
      planHeroTeams(value);
      return value;
    } catch { return null; }
  },
});

export default function HeroTeamPlanner() {
  const { t } = useLocale();
  const text = t.heroTeamPlanner;
  const layouts = layoutTexts(t.guideEntries.heroLayouts);
  const input = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [search, setSearch] = useState("");
  useDocumentTitle(text.title);
  let results: ReturnType<typeof planHeroTeams> = [];
  let invalid = false;
  try { results = planHeroTeams(input); } catch { invalid = true; }
  const update = (patch: Partial<TeamInput>) => store.set({ ...input, ...patch });
  const editHero = (id: string, patch: Partial<OwnedHero>) => update({ heroes: input.heroes.map((hero) => hero.id === id ? { ...hero, ...patch } : hero) });
  const buildingName = (name: string) => { const building = BUILDINGS.find((entry) => entry.name === name); return building ? localizedBuildingName(building, t.guideEntries.buildings.buildingTexts) : name === "Forge" ? text.forge : name === "Masonry Workshop" ? text.masonry : name; };
  const heroName = (id: string) => HEROES.find((hero) => hero.id === id)?.name ?? id;
  const itemName = (id: string) => { const item = COLLECTION_ITEMS.find((item) => item.id === id); return item ? localizedItem(item, t.guideEntries.collection.collectionTexts).name : id; };
  return <div className={styles.planner}>
    <PageHead eyebrow={t.nav.simulations} title={text.title} lede={text.intro} />
    <aside className={styles.notice}><p>{text.scaling}</p><details><summary>{text.details}</summary><p>{input.mode === "combat" ? text.note : text.prodNote}</p></details></aside>
    <section className={"panel " + styles.controls}>
      <label>{text.mode}<select value={input.mode} onChange={(event) => update({ mode: event.target.value as TeamInput["mode"] })}><option value="combat">{text.combat}</option><option value="production">{text.production}</option></select></label>
      <label>{text.size}<input type="number" min={1} max={25} step={1} value={Number.isNaN(input.size) ? "" : input.size} onChange={(event) => update({ size: event.target.valueAsNumber })} /></label>
      {input.mode === "production" && <label>{text.building}<select value={input.building} onChange={(event) => update({ building: event.target.value })}>{PRODUCTION_BUILDINGS.map((building) => <option key={building} value={building}>{buildingName(building)}</option>)}</select></label>}
    </section>
    <section className="panel">
      <h2>{text.heroes} <span className={styles.count}>{input.heroes.length} / {HEROES.length}</span></h2>
      <div className={styles.controls}><label>{text.search}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="button" onClick={() => update({ heroes: HEROES.map((hero) => input.heroes.find((own) => own.id === hero.id) ?? { id: hero.id }) })}>{text.all}</button><button className="button" onClick={() => update({ heroes: [] })}>{text.none}</button></div>
      <div className={styles.roster}>{HEROES.filter((hero) => hero.name.toLowerCase().includes(search.toLowerCase())).map((hero) => {
        const own = input.heroes.find((entry) => entry.id === hero.id);
        const localized = localizedHero(hero, t.guideEntries.heroes.heroTexts, t.guideEntries.collection.collectionTexts);
        return <div className={styles.hero + (own ? " " + styles.owned : "")} key={hero.id}>
          <label className={styles.heroCheck}><input type="checkbox" checked={Boolean(own)} onChange={(event) => update({ heroes: event.target.checked ? [...input.heroes, { id: hero.id }] : input.heroes.filter((entry) => entry.id !== hero.id) })} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {hero.images[0] && <img src={heroImageUrl(hero.images[0])} alt="" width={44} height={44} loading="lazy" />}<span>{hero.name}<small>{hero.rarity}</small></span>
          </label>
          {own && <div className={styles.heroFields}>{(["level", "stars"] as const).map((field) => <label key={field}>{field === "level" ? text.level : text.stars}<input aria-label={hero.name + ": " + (field === "level" ? text.level : text.stars)} type="number" min={field === "level" ? 1 : 0} step={1} placeholder={text.unknown} value={own[field] ?? ""} onChange={(event) => editHero(hero.id, { [field]: event.target.value === "" ? undefined : event.target.valueAsNumber })} /></label>)}
            {input.mode === "production" && hero.production && <label>{text.ability}<select aria-label={hero.name + ": " + text.ability} value={own.productionLevel ?? 1} onChange={(event) => editHero(hero.id, { productionLevel: Number(event.target.value) })}>{hero.production.levels.map((_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>}
            <details><summary>{text.reference}</summary><p>{input.mode === "production" ? localized.production?.levels[(own.productionLevel ?? 1) - 1] ?? text.unknown : localized.skill?.levels[0] ?? text.unknown}</p></details>
          </div>}
        </div>;
      })}</div>
    </section>
    {input.mode === "combat" && <section className="panel"><h2>{text.items}</h2><div className={styles.items}>{Object.entries(EXCLUSIVE_COLLECTION_HEROES).map(([id, hero]) => <label key={id}><input type="checkbox" checked={input.items.includes(id)} onChange={(event) => update({ items: event.target.checked ? [...input.items, id] : input.items.filter((item) => item !== id) })} /><span>{itemName(id)}<small>{heroName(hero)}</small></span></label>)}</div>
      <h2>{text.collection}</h2><p>{text.collectionNote}</p><div className={styles.controls}>{input.collection.map((id, index) => <label key={index}>{text.collection} {index + 1}<select value={id} onChange={(event) => update({ collection: input.collection.map((item, slot) => slot === index ? event.target.value : item) })}><option value="">{text.empty}</option>{COLLECTION_ITEMS.map((item) => <option key={item.id} value={item.id} disabled={input.collection.includes(item.id) && item.id !== id}>{itemName(item.id)}</option>)}</select></label>)}</div>
      <div className={styles.controls}><button className="button" disabled={input.collection.length >= 25} onClick={() => update({ collection: [...input.collection, ""] })}>{text.add}</button><button className="button" disabled={!input.collection.length} onClick={() => update({ collection: input.collection.slice(0, -1) })}>{text.remove}</button></div>
    </section>}
    <section aria-label={text.results}><h2>{text.results}</h2>{invalid ? <p role="alert">{text.invalid}</p> : <>
      {input.mode === "combat" && <p>{text.alternatives}</p>}
      <div className={styles.results}>{results.map((result) => <article className="panel" key={result.id}>
        <h3>{result.id === "production" ? buildingName(input.building) : layouts.buildTexts[result.id].name}</h3>
        {input.mode === "combat" && <><strong>{result.score} {text.points}</strong><p>{layouts.buildTexts[result.id].tagline}</p></>}
        {!result.members.length ? <p>{text.noTeam}</p> : <ul className={styles.team}>{result.members.map((member) => <li key={member.id}><strong>{heroName(member.id)}</strong><span>{member.production !== undefined ? "+" + member.production + "%" : member.points + " " + text.points}</span>{member.zone && <small>{text[member.zone as "key" | "important" | "other"]}</small>}{member.requiredStars !== undefined && <small>{text.conditions}: ≥ {member.requiredStars} {text.stars}</small>}{member.roles.length > 0 && <small>{member.roles.map((role) => layouts.roleNames[role]).join(" · ")}</small>}{member.conditions.length > 0 && <small>{text.conditions}: {member.conditions.map((condition) => layouts.pickNotes[condition]).join(", ")}</small>}</li>)}</ul>}
        {result.members.length < input.size && <p className="assumption">{text.short}</p>}
        {result.collection.length > 0 && <p>{text.collection}: {result.collection.map(itemName).join(", ")}</p>}
        {result.missing.length > 0 && <p>{text.missing}: {result.missing.join(", ")}</p>}
        {result.unmodeled.length > 0 && <details><summary>{text.unmodeled} ({result.unmodeled.length})</summary><p>{result.unmodeled.map(heroName).join(", ")}</p></details>}
        {input.mode === "combat" && <details><summary>{text.conditions}</summary><ul>{[...layouts.buildTexts[result.id].cons, ...layouts.buildTexts[result.id].notes].map((note) => <li key={note}>{note}</li>)}</ul></details>}
      </article>)}</div></>}
    </section>
    <footer className={styles.notice}><p>{text.saved}</p><p>{text.sources}: <Link href="/guides/heroes/">{t.guideEntries.heroes.title}</Link> · <Link href="/guides/hero-layouts/">{t.guideEntries.heroLayouts.title}</Link> · <Link href="/guides/collection/">{t.guideEntries.collection.title}</Link></p><p>{text.credit}</p></footer>
  </div>;
}
