"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { guideLayout } from "../../lib/content/guides";
import { heroAppearances } from "../../lib/content/hero-links";
import { layoutTexts, type BuildZone } from "../../lib/content/hero-layouts";
import {
  HERO_FRAGMENT_KEYS,
  HERO_RARITIES,
  HERO_STAR_COSTS,
  HEROES,
  abilityCount,
  heroImageUrl,
  heroesByRarity,
  searchHeroes,
  type Hero,
  type HeroRarity,
} from "../../lib/content/heroes";
import { fill, type Dictionary } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { ChevronIcon, CloseIcon, PenIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";
import { HeroAbilities } from "./HeroAbilities";

type Guide = Dictionary["guideEntries"]["heroes"];

export function isHeroesGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Dictionary["guideEntries"]["heroes"] {
  return guideLayout(guide) === "heroes";
}

export function counted(count: number, one: string, many: string): string {
  return count === 1 ? one : fill(many, { count });
}

function HeroTile({ hero, guide, onOpen }: { hero: Hero; guide: Guide; onOpen: (hero: Hero) => void }) {
  const skins = hero.images.length - 1;
  return (
    <li>
      <button type="button" className="hero-tile" data-rarity={hero.rarity} aria-haspopup="dialog" onClick={() => onOpen(hero)}>
        <HeroPortrait name={hero.name} rarity={hero.rarity} src={hero.images[0] ? heroImageUrl(hero.images[0]) : null} />
        <span className="hero-tile-name">{hero.name}</span>
        <span className="hero-tile-meta">
          <span className="rarity" data-rarity={hero.rarity}>{hero.rarity}</span>
          {abilityCount(hero) > 0 ? (
            <span className="hero-tile-skills">{fill(guide.abilityProgress, { count: abilityCount(hero) })}</span>
          ) : null}
        </span>
        {skins > 0 ? (
          <span className="hero-tile-skins">
            <span aria-hidden="true">+{skins}</span>
            <span className="visually-hidden">{counted(skins, guide.skinCountOne, guide.skinCount)}</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

const subscribeHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

/**
 * The open hero lives in the URL hash, so a hero can be linked. Opening pushes
 * a history entry that Back or closing the dialog removes again; stepping to
 * another hero replaces it. Next.js merges its router state into these calls.
 */
function heroUrl(id: string | null): string {
  return `${window.location.pathname}${window.location.search}${id ? `#${encodeURIComponent(id)}` : ""}`;
}

function notifyHash() {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function openHeroHash(id: string) {
  window.history.pushState({ heroDialog: true }, "", heroUrl(id));
  notifyHash();
}

function stepHeroHash(id: string) {
  window.history.replaceState(window.history.state, "", heroUrl(id));
  notifyHash();
}

function closeHeroHash() {
  if ((window.history.state as { heroDialog?: boolean } | null)?.heroDialog) {
    window.history.back();
    return;
  }
  window.history.replaceState(window.history.state, "", heroUrl(null));
  notifyHash();
}

export function HeroRoster({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const { allows } = useAuth();
  const [rarity, setRarity] = useState<HeroRarity | "all">("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => searchHeroes(query, rarity), [query, rarity]);
  const grouped = rarity === "all" && !query.trim();
  const fragmentLabels = guide.fragments;

  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const openId = decodeURIComponent(hash.slice(1));
  const open = openId ? HEROES.find((hero) => hero.id === openId) ?? null : null;
  // Step through what is on screen, or the whole roster when a link opened a filtered-out hero.
  const stepList = open && rows.some((hero) => hero.id === open.id) ? rows : HEROES;

  const openHero = (hero: Hero) => openHeroHash(hero.id);

  return (
    <div className="guide-wide hero-roster">
      <p className="intro">{guide.intro}</p>

      <div className="tier-lists-head">
        <h2>{guide.rosterHeading}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/heroes/edit/">
            <PenIcon className="icon icon-sm" />
            {t.heroEditor.openEditor}
          </Link>
        ) : null}
      </div>
      <p className="guide-lede">{guide.rosterLede}</p>

      <div className="hero-toolbar">
        <div className="hero-filters" role="group" aria-label={guide.filterLabel}>
          <button type="button" className="hero-filter" aria-pressed={rarity === "all"} onClick={() => setRarity("all")}>
            {guide.filterAll}
            <span className="hero-filter-count">{HEROES.length}</span>
          </button>
          {HERO_RARITIES.map((tier) => (
            <button
              key={tier}
              type="button"
              className="hero-filter"
              data-rarity={tier}
              aria-pressed={rarity === tier}
              onClick={() => setRarity(tier)}
            >
              {tier}
              <span className="hero-filter-count">{heroesByRarity(tier).length}</span>
            </button>
          ))}
        </div>
        <label className="hero-search">
          <span className="visually-hidden">{guide.searchLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={guide.searchPlaceholder}
          />
        </label>
      </div>
      <p className="hero-count" aria-live="polite">{fill(guide.countLabel, { count: rows.length })}</p>

      {rows.length === 0 ? (
        <p className="empty-state">{guide.empty}</p>
      ) : grouped ? (
        HERO_RARITIES.map((tier) => {
          const heroes = rows.filter((hero) => hero.rarity === tier);
          if (heroes.length === 0) return null;
          return (
            <section className="hero-group" data-rarity={tier} key={tier} aria-label={tier}>
              <h3 className="hero-group-head">
                <span className="rarity" data-rarity={tier}>{tier}</span>
                <small>{counted(heroes.length, guide.groupCountOne, guide.groupCount)}</small>
              </h3>
              <ul className="hero-tiles">
                {heroes.map((hero) => <HeroTile key={hero.id} hero={hero} guide={guide} onOpen={openHero} />)}
              </ul>
            </section>
          );
        })
      ) : (
        <ul className="hero-tiles">
          {rows.map((hero) => <HeroTile key={hero.id} hero={hero} guide={guide} onOpen={openHero} />)}
        </ul>
      )}
      <p className="hero-credit">{guide.portraitCredit}</p>

      <h2>{guide.basicsHeading}</h2>
      <div className="rule-grid">
        {guide.basics.map((step, index) => (
          <article className="rule-card" key={step.title}>
            <span className="phase-index" aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </article>
        ))}
      </div>

      <h2>{guide.starHeading}</h2>
      <div className="table-scroll panel guide-table-panel">
        <table className="data-table data-table-wide">
          <thead>
            <tr>
              <th>{guide.colStar}</th>
              {HERO_FRAGMENT_KEYS.map((key) => (
                <th key={key}>{fragmentLabels[key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HERO_STAR_COSTS.map((row) => (
              <tr key={row.star}>
                <td data-label={guide.colStar}><strong className="mono">{row.star}★</strong></td>
                {row.costs.map((cost, index) => (
                  <td key={HERO_FRAGMENT_KEYS[index]} data-label={fragmentLabels[HERO_FRAGMENT_KEYS[index]]}>
                    <span className="mono">{cost}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <HeroDialog
          hero={open}
          guide={guide}
          list={stepList}
          onStep={(hero) => stepHeroHash(hero.id)}
          onClose={closeHeroHash}
        />
      ) : null}
    </div>
  );
}

function HeroDialog({
  hero,
  guide,
  list,
  onStep,
  onClose,
}: {
  hero: Hero;
  guide: Guide;
  list: readonly Hero[];
  onStep: (hero: Hero) => void;
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  // Stable, so a re-render while Back is still removing the hash cannot reopen a closed dialog.
  const attach = useCallback((node: HTMLDialogElement | null) => {
    dialog.current = node;
    if (node && !node.open) node.showModal();
  }, []);
  const index = list.findIndex((entry) => entry.id === hero.id);
  const previous = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    const target = event.key === "ArrowLeft" ? previous : event.key === "ArrowRight" ? next : null;
    if (!target) return;
    event.preventDefault();
    onStep(target);
  };

  return (
    <dialog
      ref={attach}
      className="hero-detail"
      data-rarity={hero.rarity}
      aria-labelledby={`${id}-name`}
      onClose={onClose}
      onKeyDown={onKeyDown}
    >
      <div className="hero-detail-nav">
        <button type="button" className="icon-button hero-detail-prev" aria-label={guide.previousHero} disabled={!previous} onClick={() => previous && onStep(previous)}>
          <ChevronIcon className="icon icon-sm" />
        </button>
        <span className="hero-detail-position">{index >= 0 ? `${index + 1} / ${list.length}` : ""}</span>
        <button type="button" className="icon-button" aria-label={guide.nextHero} disabled={!next} onClick={() => next && onStep(next)}>
          <ChevronIcon className="icon icon-sm" />
        </button>
        <button type="button" className="icon-button hero-detail-close" aria-label={guide.close} onClick={() => dialog.current?.close()}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>
      <HeroDetail key={hero.id} hero={hero} guide={guide} nameId={`${id}-name`} />
    </dialog>
  );
}

function HeroDetail({ hero, guide, nameId }: { hero: Hero; guide: Guide; nameId: string }) {
  const { t, tf } = useLocale();
  const [shown, setShown] = useState(0);
  const file = hero.images[shown] ?? hero.images[0];
  const found = heroAppearances(hero.name);
  const layouts = layoutTexts(t.guideEntries.heroLayouts);
  const layoutGuide = t.guideEntries.heroLayouts;
  const tierGuide = t.guideEntries.heroTierList;
  const zoneLabel: Record<BuildZone | "counter", string> = {
    key: layoutGuide.labelKey,
    important: layoutGuide.labelImportant,
    other: layoutGuide.labelOther,
    collection: layoutGuide.labelCollection,
    counter: layoutGuide.labelCounters,
  };
  const nothing = !found.tiers.length && !found.builds.length && !found.roles.length && !found.paintings.length;

  return (
    <>
      <header className="hero-detail-head">
        <HeroPortrait name={hero.name} rarity={hero.rarity} src={file ? heroImageUrl(file) : null} className="hero-portrait-large" />
        <div className="hero-detail-title">
          <h2 id={nameId}>{hero.name}</h2>
          <p>
            <span className="rarity" data-rarity={hero.rarity}>{hero.rarity}</span>
            {hero.obtain ? <span className="hero-obtain">{guide.colObtain}: {hero.obtain}</span> : null}
          </p>
          {hero.images.length > 1 ? (
            <div className="hero-skins" role="group" aria-label={guide.imagesLabel}>
              {hero.images.map((image, position) => (
                <button
                  key={image}
                  type="button"
                  className="hero-skin"
                  aria-pressed={position === shown}
                  aria-label={position === 0 ? guide.portraitLabel : tf(guide.skinLabel, { number: position })}
                  onClick={() => setShown(position)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroImageUrl(image)} alt="" width={120} height={121} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="hero-detail-body">
        <h3>{guide.skillsHeading}</h3>
        <HeroAbilities hero={hero} guide={guide} />

        <h3>{guide.appearsHeading}</h3>
        {nothing ? (
          <p className="hero-pending">{guide.appearsNone}</p>
        ) : (
          <ul className="hero-links">
            {found.tiers.length > 0 ? (
              <li>
                <Link href="/guides/hero-tier-list/">{guide.inTierList}</Link>
                <span className="hero-link-values">
                  {found.tiers.map((entry, position) => (
                    <span className="hero-link-tier" data-tier={entry.tier} key={`${entry.tier}-${entry.variant ?? position}`}>
                      <strong>{entry.tier}</strong>
                      {entry.variant ? <small>{tierGuide.variants[entry.variant]}</small> : null}
                    </span>
                  ))}
                </span>
              </li>
            ) : null}
            {found.builds.length > 0 ? (
              <li>
                <Link href="/guides/hero-layouts/">{guide.inLayouts}</Link>
                <span className="hero-link-values">
                  {found.builds.map((entry) => (
                    <span className="hero-link-chip" key={entry.build}>
                      {layouts.buildTexts[entry.build]?.name ?? entry.build}
                      <small>{zoneLabel[entry.zone]}</small>
                    </span>
                  ))}
                </span>
              </li>
            ) : null}
            {found.roles.length > 0 ? (
              <li>
                <Link href="/guides/hero-layouts/">{layoutGuide.utilityHeading}</Link>
                <span className="hero-link-values">
                  {found.roles.map((role) => (
                    <span className="hero-link-chip" key={role}>{layouts.roleNames[role] ?? role}</span>
                  ))}
                </span>
              </li>
            ) : null}
            {found.paintings.length > 0 ? (
              <li>
                <Link href="/guides/artwork/">{guide.inArtwork}</Link>
                <span className="hero-link-values">
                  {found.paintings.map((entry) => (
                    <span className="hero-link-chip" key={`${entry.set}-${entry.painting}`}>
                      {entry.painting}
                      <small>{entry.set}</small>
                    </span>
                  ))}
                </span>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </>
  );
}
