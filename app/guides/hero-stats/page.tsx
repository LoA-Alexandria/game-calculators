"use client";

import { useMemo, useState } from "react";
import catalogData from "../../../lib/calculators/hero-stat-baselines.json" with { type: "json" };
import { estimatedHeldAngLevelOne, heldStatObservationsForHero } from "../../../lib/calculators/hero-stat-baselines";
import { HERO_RARITIES } from "../../../lib/content/heroes";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import styles from "./hero-stats.module.css";

type CatalogHero = (typeof catalogData.heroes)[number];
type GuideText = ReturnType<typeof useLocale>["t"]["guideEntries"]["heroStats"];

const catalog = catalogData as { heroes: CatalogHero[] };

export default function HeroStatsPage() {
  const { t, tf, n } = useLocale();
  const copy = t.guideEntries.heroStats;
  useDocumentTitle(copy.title);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const heroes = useMemo(() => catalog.heroes
    .filter((hero) => rarity === "all" || hero.rarity === rarity)
    .filter((hero) => hero.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "en")), [query, rarity]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>{t.nav.guides}</span>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>

      <section className={styles.explainer} aria-labelledby="hero-stat-meaning">
        <h2 id="hero-stat-meaning">{copy.caveatHeading}</h2>
        <p>{copy.caveat}</p>
        <details>
          <summary>{copy.formulaLabel}</summary>
          <p className={styles.formula}>{copy.formula}</p>
          <p className={styles.source}>{copy.source}</p>
        </details>
      </section>

      <section aria-label={copy.title}>
        <div className={styles.filters}>
          <label>
            <span>{copy.searchLabel}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
          </label>
          <label>
            <span>{copy.rarityLabel}</span>
            <select value={rarity} onChange={(event) => setRarity(event.target.value)}>
              <option value="all">{copy.allRarities}</option>
              {HERO_RARITIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <p className={styles.count}>{tf(copy.shown, { count: heroes.length })}</p>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">{copy.hero}</th>
                <th scope="col">{copy.troop}</th>
                <th scope="col">{copy.baseAttack}</th>
                <th scope="col">{copy.heldAttack}</th>
                <th scope="col">{copy.heldHp}</th>
                <th scope="col">{copy.observedReadings}</th>
                <th scope="col">{copy.scaling}</th>
              </tr>
            </thead>
            <tbody>
              {heroes.map((hero) => <StatRow key={hero.id} hero={hero} copy={copy} n={n} />)}
            </tbody>
          </table>
          {heroes.length === 0 ? <p className={styles.empty}>{copy.empty}</p> : null}
        </div>
      </section>
    </main>
  );
}

function StatRow({ hero, copy, n }: { hero: CatalogHero; copy: GuideText; n: (value: number) => string }) {
  const base = hero.combatBaseAttack;
  const status = base.status === "source-value" ? copy.statusSource
    : base.status === "source-blank" ? copy.statusBlank
      : base.status === "possible-name-match-needs-confirmation" ? copy.statusUnconfirmed : copy.unknown;
  const scaling = hero.heldStatScalingStatus === "reference-fit" ? copy.known
    : hero.heldStatScalingStatus === "partial-check" || hero.heldStatScalingStatus === "start-only" ? copy.partial : copy.unknown;
  const observations = heldStatObservationsForHero(hero.id);
  const estimateFrom = observations
    .filter((observation) => estimatedHeldAngLevelOne(observation) !== null)
    .sort((a, b) => b.level - a.level || Number(b.phase === "after-ascension" || b.phase === "after-enlightenment") - Number(a.phase === "after-ascension" || a.phase === "after-enlightenment"))[0];
  const estimatedAng = estimateFrom ? estimatedHeldAngLevelOne(estimateFrom) : null;
  const heldAngStart = hero.heldStatStart?.ang ?? estimatedAng;
  return (
    <tr id={`hero-${hero.id}`}>
      <th scope="row"><span className={styles.heroName}>{hero.name}</span><span className={styles.rarity}>{hero.rarity}</span></th>
      <td>{hero.troop}</td>
      <td><strong>{base.value === null ? "—" : n(base.value)}</strong><small>{status}</small></td>
      <td>{heldAngStart == null ? "—" : <><strong>{hero.heldStatStart?.ang == null ? "≈" : ""}{n(heldAngStart)}</strong><small>{hero.heldStatStart?.ang == null ? copy.estimatedFrom : copy.recordedStart}</small></>}</td>
      <td>{hero.heldStatStart?.lp == null ? "—" : n(hero.heldStatStart.lp)}</td>
      <td>
        {observations.length ? (
          <details className={styles.readings}>
            <summary>{copy.readingsCount.replace("{count}", String(observations.length))}</summary>
            <ul>
              {observations.map((observation, index) => (
                <li key={`${observation.level}-${observation.phase}-${index}`} data-warning={observation.dataQuality === "needs-confirmation" ? "true" : undefined}>
                  <span>{copy.levelShort} {observation.level} · {phaseLabel(observation.phase, copy)}</span>
                  <span>ANG {observation.dataQuality === "needs-confirmation" ? "⚠ " : "≈ "}{n(observation.heldAng)}</span>
                  <span>LP {observation.heldLp == null ? "—" : `≈ ${n(observation.heldLp)}`}</span>
                  <small>{observation.precision}</small>
                  {observation.dataQuality === "needs-confirmation" ? <small>{copy.needsConfirmation}</small> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : "—"}
      </td>
      <td><span className={styles.status} data-known={scaling === copy.known ? "true" : "false"}>{scaling}</span></td>
    </tr>
  );
}

function phaseLabel(phase: string, copy: GuideText): string {
  if (phase === "after-ascension") return copy.afterAscension;
  if (phase === "before-ascension") return copy.beforeAscension;
  if (phase === "after-enlightenment") return copy.afterEnlightenment;
  if (phase === "before-enlightenment") return copy.beforeEnlightenment;
  return copy.normalPhase;
}
