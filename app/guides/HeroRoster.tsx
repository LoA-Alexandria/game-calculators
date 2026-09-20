"use client";

import Link from "next/link";
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { guideHref, guideLayout } from "../../lib/content/guides";
import { heroAppearances } from "../../lib/content/hero-links";
import { placementCaption } from "../../lib/content/hero-tiers";
import { layoutTexts, type BuildZone } from "../../lib/content/hero-layouts";
import type { PaintingTexts } from "../../lib/content/artwork";
import {
  HERO_ABILITY_KINDS,
  HERO_FRAGMENT_KEYS,
  HERO_RARITIES,
  HERO_STAR_COSTS,
  HEROES,
  abilityCount,
  heroImageUrl,
  heroesByRarity,
  localizedHero,
  searchHeroes,
  heroLoreTexts,
  mergeHeroTexts,
  type Hero,
  type HeroRarity,
  type HeroTexts,
} from "../../lib/content/heroes";
import { LOCALE_CODES, fill, getDictionary, type Dictionary } from "../../lib/i18n";
import { exclusiveCollectionSearchText, type CollectionTexts } from "../../lib/content/collection";
import { HERO_SKIN_GROUPS, HERO_SKINS, skinSearchText, skinsFor } from "../../lib/content/skins";
import { ChevronIcon, CloseIcon } from "../components/Icons";
import { heroChibiUrl } from "../../lib/content/hero-chibis";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";
import { HeroAbilities, HeroArtifact } from "./HeroAbilities";
import { SkinCatalog, SkinLines } from "./SkinCatalog";

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
  const { locale } = useLocale();
  const [rarity, setRarity] = useState<HeroRarity | "all">("all");
  const [query, setQuery] = useState("");
  // Search every language's wording, so a reader finds a skill or skin by the name they know.
  const skinCatalogs = useMemo(
    () => LOCALE_CODES.map((code) => getDictionary(code).guideEntries.heroes.skinTexts),
    [],
  );
  const heroCatalogs = useMemo(
    () => LOCALE_CODES.map((code) => mergeHeroTexts(getDictionary(code).guideEntries.heroes.heroTexts, heroLoreTexts(code))),
    [],
  );
  const collectionCatalogs = useMemo(
    () => LOCALE_CODES.map((code) => getDictionary(code).guideEntries.collection.collectionTexts as CollectionTexts),
    [],
  );
  const rows = useMemo(
    () =>
      searchHeroes(
        query,
        rarity,
        heroCatalogs,
        (hero) =>
          [
            skinSearchText(hero.name, HERO_SKINS, skinCatalogs),
            exclusiveCollectionSearchText(hero.id, collectionCatalogs),
          ].join(" "),
      ),
    [query, rarity, heroCatalogs, skinCatalogs, collectionCatalogs],
  );
  const grouped = rarity === "all" && !query.trim();
  const fragmentLabels = guide.fragments;

  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const openId = decodeURIComponent(hash.slice(1));
  const open = openId ? HEROES.find((hero) => hero.id === openId) ?? null : null;
  // Step through what is on screen, or the whole roster when a link opened a filtered-out hero.
  const stepList = open && rows.some((hero) => hero.id === open.id) ? rows : HEROES;

  const openHero = (hero: Hero) => openHeroHash(hero.id);
  // Everything starts closed, and which panels the reader opens stays open as
  // they step through the roster.
  const [panels, setPanels] = useState<PanelState>({});
  const togglePanel = useCallback(
    (id: string, open: boolean) => setPanels((current) => ({ ...current, [id]: open })),
    [],
  );
  const texts = useMemo(
    () => mergeHeroTexts(guide.heroTexts, heroLoreTexts(locale)),
    [guide.heroTexts, locale],
  );

  return (
    <div className="guide-wide hero-roster">
      <p className="intro">{guide.intro}</p>

      <div className="tier-lists-head">
        <h2>{guide.rosterHeading}</h2>
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
      <p className="hero-credit">{guide.figureCredit}</p>

      <h2>{guide.sourcesHeading}</h2>
      <div className="rule-grid">
        {guide.sources.map((source) => (
          <article className="rule-card source-card" key={source.title}>
            <div>
              <h3>{source.title}</h3>
              <p>{source.body}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="hero-credit">{guide.obtainCredit}</p>

      <h2>{guide.skinsHeading}</h2>
      <p className="guide-lede">{guide.skinsLede}</p>
      <div className="rule-grid">
        {guide.skinSources.map((source) => (
          <article className="rule-card source-card" key={source.title}>
            <div>
              <h3>{source.title}</h3>
              <p>{source.body}</p>
            </div>
          </article>
        ))}
      </div>
      <SkinCatalog
        skins={HERO_SKINS}
        groups={guide.skinGroups}
        groupOrder={HERO_SKIN_GROUPS}
        texts={guide.skinTexts}
        colName={guide.colName}
        colSkin={guide.colSkin}
        colObtain={guide.colObtain}
        missableLabel={guide.missableLabel}
        unconfirmedLabel={guide.unconfirmedLabel}
        ownerOf={(name) => {
          const hero = HEROES.find((entry) => entry.name === name);
          return {
            name,
            href: hero ? `${guideHref("heroes")}#${encodeURIComponent(hero.id)}` : null,
            rarity: hero?.rarity,
            src: hero?.images[0] ? heroImageUrl(hero.images[0]) : null,
          };
        }}
      />
      <p className="hero-credit">{guide.skinsCredit}</p>

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

      {guide.note ? <p className="callout">{guide.note}</p> : null}

      {open ? (
        <HeroDialog
          hero={open}
          guide={guide}
          texts={texts}
          list={stepList}
          panels={panels}
          onPanel={togglePanel}
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
  texts,
  list,
  panels,
  onPanel,
  onStep,
  onClose,
}: {
  hero: Hero;
  guide: Guide;
  texts: HeroTexts;
  list: readonly Hero[];
  panels: PanelState;
  onPanel: (id: string, open: boolean) => void;
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
      <HeroDetail
        key={hero.id}
        hero={hero}
        guide={guide}
        texts={texts}
        panels={panels}
        onPanel={onPanel}
        nameId={`${id}-name`}
      />
    </dialog>
  );
}

type PanelState = Record<string, boolean>;

/**
 * One section of the hero sheet. Closed it still says what is inside, so the
 * sheet reads as a short index card until the reader opens what they want.
 */
function HeroPanel({
  id,
  title,
  summary,
  panels,
  onPanel,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  panels: PanelState;
  onPanel: (id: string, open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="hero-panel"
      open={panels[id] ?? false}
      onToggle={(event) => onPanel(id, event.currentTarget.open)}
    >
      <summary>
        <span className="hero-panel-title">{title}</span>
        {summary ? <span className="hero-panel-summary">{summary}</span> : null}
        <ChevronIcon className="icon icon-sm hero-panel-mark" />
      </summary>
      <div className="hero-panel-body">{children}</div>
    </details>
  );
}

function HeroDetail({
  hero: row,
  guide,
  texts,
  panels,
  onPanel,
  nameId,
}: {
  hero: Hero;
  guide: Guide;
  texts: HeroTexts;
  panels: PanelState;
  onPanel: (id: string, open: boolean) => void;
  nameId: string;
}) {
  const { t, tf } = useLocale();
  const artworkTexts = t.guideEntries.artwork.catalogTexts as PaintingTexts;
  const collectionTexts = t.guideEntries.collection.collectionTexts as CollectionTexts;
  const [shown, setShown] = useState(0);
  // Name, rarity, and pictures are shared; the game text comes from the dictionary + lore.
  // Exclusive collection names come from the Collection guide, not from heroTexts.
  const hero = localizedHero(row, texts, collectionTexts);
  const file = hero.images[shown] ?? hero.images[0];
  const figure = heroChibiUrl(hero.id);
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
  const listedSkins = skinsFor(HERO_SKINS, hero.name);
  const troopLabel = hero.troop ? guide.troops[hero.troop] : null;
  const ageLabel = hero.age ? guide.ages[hero.age] : null;
  // What a closed panel says: the names inside it, so nobody has to open it to look.
  const abilityNames = HERO_ABILITY_KINDS.map((kind) => hero[kind]?.name)
    .filter((name): name is string => Boolean(name))
    .join(" · ");
  const guidesFound = [
    found.tiers.length ? guide.inTierList : "",
    found.builds.length || found.roles.length ? guide.inLayouts : "",
    found.paintings.length ? guide.inArtwork : "",
  ].filter(Boolean).join(" · ");

  return (
    <>
      <header className="hero-detail-head">
        <HeroPortrait name={hero.name} rarity={hero.rarity} src={file ? heroImageUrl(file) : null} className="hero-portrait-large" />
        <div className="hero-detail-title">
          <h2 id={nameId}>{hero.name}</h2>
          {hero.title ? <p className="hero-detail-epithet">{hero.title}</p> : null}
          <p>
            <span className="rarity" data-rarity={hero.rarity}>{hero.rarity}</span>
            {troopLabel ? <span className="hero-detail-fact">{troopLabel}</span> : null}
            {ageLabel ? <span className="hero-detail-fact">{ageLabel}</span> : null}
          </p>
          {hero.obtain ? (
            <p className="hero-detail-obtain">
              <span>{guide.colObtain}</span>
              {hero.obtain}
            </p>
          ) : null}
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
        {figure ? (
          // The in-game figure, free of its pedestal. Decoration next to the portrait.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="hero-detail-figure" src={figure} alt="" loading="lazy" decoding="async" />
        ) : null}
      </header>

      <div className="hero-detail-body">
        <HeroPanel
          id="skills"
          title={guide.skillsHeading}
          summary={abilityNames || guide.abilityMissing}
          panels={panels}
          onPanel={onPanel}
        >
          <HeroAbilities hero={hero} guide={guide} />
        </HeroPanel>

        {hero.artifact ? (
          <HeroPanel
            id="artifact"
            title={guide.artifactLabel}
            summary={hero.artifact.name}
            panels={panels}
            onPanel={onPanel}
          >
            <HeroArtifact artifact={hero.artifact} guide={guide} />
          </HeroPanel>
        ) : null}

        {listedSkins.length > 0 ? (
          <HeroPanel
            id="skins"
            title={guide.skinsHeading}
            summary={counted(listedSkins.length, guide.skinCountOne, guide.skinCount)}
            panels={panels}
            onPanel={onPanel}
          >
            <SkinLines
              skins={listedSkins}
              texts={guide.skinTexts}
              missableLabel={guide.missableLabel}
              unconfirmedLabel={guide.unconfirmedLabel}
            />
          </HeroPanel>
        ) : null}

        {hero.bio ? (
          <HeroPanel
            id="story"
            title={guide.bioHeading}
            summary={hero.bio}
            panels={panels}
            onPanel={onPanel}
          >
            <p className="hero-bio">{hero.bio}</p>
          </HeroPanel>
        ) : null}

        <HeroPanel
          id="guides"
          title={guide.appearsHeading}
          summary={guidesFound || guide.appearsNone}
          panels={panels}
          onPanel={onPanel}
        >
          {nothing ? (
            <p className="hero-pending">{guide.appearsNone}</p>
          ) : (
            <ul className="hero-links">
              {found.tiers.length > 0 ? (
                <li>
                  <Link href="/guides/hero-tier-list/">{guide.inTierList}</Link>
                  <span className="hero-link-values">
                    {found.tiers.map((entry, position) => (
                      <span className="hero-link-tier" data-tier={entry.tier} key={`${entry.tier}-${position}`}>
                        <strong>{entry.tier}</strong>
                        {entry.rarity || entry.variant ? <small>{placementCaption(tierGuide, entry)}</small> : null}
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
                      <span className="hero-link-chip" key={`${entry.setId}-${entry.paintingId}`}>
                        {artworkTexts.paintings?.[entry.paintingId]?.name?.trim() || entry.painting}
                        <small>{artworkTexts.sets?.[entry.setId]?.name?.trim() || entry.set}</small>
                      </span>
                    ))}
                  </span>
                </li>
              ) : null}
            </ul>
          )}
        </HeroPanel>
      </div>
    </>
  );
}
