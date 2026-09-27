"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { CRYPTID_TOWER_BUILDS, type CryptidTowerBuildId } from "../../lib/content/cryptid-tower-layouts";
import { collectionItemById, localizedItem, type CollectionTexts } from "../../lib/content/collection";
import { HEROES, localizedHero, type HeroTexts } from "../../lib/content/heroes";
import { CRYPTIDES, cryptideImageUrl, localizedCryptideName, type CryptideTexts } from "../../lib/content/cryptides";
import { guideHref } from "../../lib/content/guides";
import type { Dictionary } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";
import { CheckIcon } from "../components/Icons";
import { CollectionAvatar } from "../components/CollectionAvatar";
import { HeroAvatar } from "../components/HeroAvatar";

type Guide = Dictionary["guideEntries"]["cryptidTowerLayout"];

export function isCryptidTowerLayoutGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return "towerBuilds" in guide;
}

function HeroPicks({ ids, guide, positions = {}, heroTexts, collectionTexts }: {
  ids: readonly string[];
  guide: Guide;
  positions?: Readonly<Record<string, string>>;
  heroTexts: HeroTexts;
  collectionTexts: CollectionTexts;
}) {
  return (
    <ul className="pick-list">
      {ids.map((id) => {
        const hero = HEROES.find((row) => row.id === id);
        if (!hero) return null;
        const local = localizedHero(hero, heroTexts, collectionTexts);
        const note = positions[hero.id];
        const positionText = note ? guide.positionNotes[note as keyof Guide["positionNotes"]] : "";
        return (
          <li key={id}>
            <Link href={`${guideHref("heroes")}#${encodeURIComponent(id)}`} className="pick ct-linked-pick">
              <HeroAvatar name={hero.name} />
              <span className="pick-name">{local.name}</span>
              {positionText ? <small className="pick-note">{positionText}</small> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CollectionPicks({ ids, texts }: { ids: readonly string[]; texts: CollectionTexts }) {
  return (
    <ul className="pick-list">
      {ids.map((id) => {
        const item = collectionItemById(id);
        if (!item) return null;
        const local = localizedItem(item, texts);
        return (
          <li key={id}>
            <Link href={`${guideHref("collection")}#${encodeURIComponent(id)}`} className="pick pick-item ct-linked-pick" title={local.name}>
              <CollectionAvatar id={id} />
              <span className="pick-name">{local.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TowerTabs({ guide, heroTexts, collectionTexts, cryptideTexts }: {
  guide: Guide;
  heroTexts: HeroTexts;
  collectionTexts: CollectionTexts;
  cryptideTexts: CryptideTexts;
}) {
  const base = useId();
  const [activeId, setActiveId] = useState<CryptidTowerBuildId>(CRYPTID_TOWER_BUILDS[0]?.id ?? "pike");
  useEffect(() => {
    const selectTowerFromHash = () => {
      const requestedId = window.location.hash.slice(1).replace(/-tower$/, "");
      const requestedBuild = CRYPTID_TOWER_BUILDS.find((build) => build.id === requestedId);
      if (requestedBuild) setActiveId(requestedBuild.id);
    };

    selectTowerFromHash();
    window.addEventListener("hashchange", selectTowerFromHash);
    return () => window.removeEventListener("hashchange", selectTowerFromHash);
  }, []);

  const active = CRYPTID_TOWER_BUILDS.find((build) => build.id === activeId) ?? CRYPTID_TOWER_BUILDS[0];
  if (!active) return null;

  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = `${active.id}-tower`;
  const selectTower = (id: CryptidTowerBuildId) => {
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}-tower`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = CRYPTID_TOWER_BUILDS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    const nextId = CRYPTID_TOWER_BUILDS[next].id;
    selectTower(nextId);
    document.getElementById(tabId(nextId))?.focus();
  };

  const text = guide.towerBuilds[active.id];
  const cryptide = CRYPTIDES.find((entry) => entry.id === active.cryptide);
  const cryptideName = cryptide ? localizedCryptideName(cryptide, cryptideTexts) : active.cryptide;

  return (
    <>
      <div className="build-tabs" role="tablist" aria-label={guide.towerLabel}>
        {CRYPTID_TOWER_BUILDS.map((build, index) => {
          const selected = build.id === active.id;
          return (
            <button
              key={build.id}
              id={tabId(build.id)}
              type="button"
              role="tab"
              className="build-tab"
              data-build={build.id}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTower(build.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="build-dot" aria-hidden="true" />
              {guide.towerBuilds[build.id].title}
            </button>
          );
        })}
      </div>

      <div className="build-panel" data-build={active.id} id={panelId} role="tabpanel" aria-labelledby={tabId(active.id)}>
        <header className="build-head ct-build-head">
          <div>
            <div className="build-title"><h3>{text.title}</h3></div>
            {text.description.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
          {cryptide ? (
            <Link className="ct-cryptide" href={`${guideHref("cryptides")}#${cryptide.id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cryptideImageUrl(cryptide.image)} alt="" loading="lazy" decoding="async" />
              <span>{cryptideName}</span>
              <small>{guide.cryptidTurn.replace("{turn}", String(active.turn))}</small>
            </Link>
          ) : null}
        </header>

        <div className="build-body">
          <div className="build-tiers">
            <section className="build-tier" data-tier="key">
              <h4>{guide.keyHeroesHeading}</h4>
              <HeroPicks ids={active.key} guide={guide} positions={active.positions} heroTexts={heroTexts} collectionTexts={collectionTexts} />
            </section>
            <section className="build-tier" data-tier="important">
              <h4>{guide.importantHeroesHeading}</h4>
              <HeroPicks ids={active.important} guide={guide} heroTexts={heroTexts} collectionTexts={collectionTexts} />
              {text.importantNote ? <p className="utility-lede">{text.importantNote}</p> : null}
            </section>
          </div>

          <aside className="build-counters">
            <h4>{guide.collectionHeading}</h4>
            {text.collectionNote ? <p className="utility-lede">{text.collectionNote}</p> : null}
            <ul>
              {active.collections.map((ids, index) => (
                <li key={index}>
                  <span className="counter-label">{guide.slotLabel} {index + 1}</span>
                  <CollectionPicks ids={ids} texts={collectionTexts} />
                </li>
              ))}
            </ul>
            {text.collectionTips.map((tip, index) => <p className="utility-lede" key={index}>{tip}</p>)}
          </aside>
        </div>
      </div>
    </>
  );
}

export function CryptidTowerLayoutGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const heroTexts = t.guideEntries.heroes.heroTexts as HeroTexts;
  const collectionTexts = t.guideEntries.collection.collectionTexts as CollectionTexts;
  const cryptideTexts = t.guideEntries.cryptides.cryptideTexts as CryptideTexts;

  return (
    <div className="guide-wide cryptid-tower-layout">
      <p className="intro">{guide.intro}</p>
      <p className="ct-progress-note">{guide.progressNote}</p>
      <p className="callout">{guide.itemAliasNote}</p>

      <h2>{guide.levelGuidanceHeading}</h2>
      <p className="utility-lede">{guide.levelGuidanceIntro}</p>
      <ul className="tip-list">
        {[guide.levelGuidanceEveryHero, guide.levelGuidanceUr, guide.levelGuidanceSsr, guide.levelGuidanceRsSr].map((line) => (
          <li key={line}><CheckIcon className="icon icon-sm" /><span>{line}</span></li>
        ))}
      </ul>
      <p className="callout">{guide.levelGuidanceNote}</p>

      <div className="tier-lists-head">
        <h2>{guide.towerLabel}</h2>
      </div>
      <TowerTabs guide={guide} heroTexts={heroTexts} collectionTexts={collectionTexts} cryptideTexts={cryptideTexts} />
      <p className="hero-credit">{guide.sourceNote}</p>
    </div>
  );
}
