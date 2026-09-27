"use client";

import Link from "next/link";
import { CRYPTID_TOWER_BUILDS } from "../../lib/content/cryptid-tower-layouts";
import { collectionImageUrl, collectionItemById, localizedItem, type CollectionTexts } from "../../lib/content/collection";
import { heroImageUrl, HEROES, localizedHero, type HeroTexts } from "../../lib/content/heroes";
import { CRYPTIDES, cryptideImageUrl, localizedCryptideName, type CryptideTexts } from "../../lib/content/cryptides";
import { guideHref } from "../../lib/content/guides";
import type { Dictionary } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";

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
    <ul className="ct-hero-picks">
      {ids.map((id) => {
        const hero = HEROES.find((row) => row.id === id);
        if (!hero) return null;
        const local = localizedHero(hero, heroTexts, collectionTexts);
        const note = positions[hero.id];
        const positionText = note ? guide.positionNotes[note as keyof Guide["positionNotes"]] : "";
        return (
          <li key={id}>
            <Link href={`${guideHref("heroes")}#${encodeURIComponent(id)}`} className="ct-hero-pick">
              {hero.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImageUrl(hero.images[0])} alt="" loading="lazy" decoding="async" />
              ) : null}
              <span>{local.name}</span>
            </Link>
            {positionText ? <small>{positionText}</small> : null}
          </li>
        );
      })}
    </ul>
  );
}

function CollectionSlot({ ids, number, guide, texts }: {
  ids: readonly string[];
  number: number;
  guide: Guide;
  texts: CollectionTexts;
}) {
  return (
    <li className="ct-collection-slot">
      <span className="ct-slot-number" aria-label={`${guide.slotLabel} ${number}`}>{number}</span>
      <ul>
        {ids.map((id) => {
          const item = collectionItemById(id);
          if (!item) return null;
          const local = localizedItem(item, texts);
          return (
            <li key={id}>
              <Link href={`${guideHref("collection")}#${encodeURIComponent(id)}`} title={local.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={collectionImageUrl(item.image)} alt="" loading="lazy" decoding="async" />
                <span>{local.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
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
      <section className="ct-level-guidance" aria-labelledby="ct-level-guidance-heading">
        <h2 id="ct-level-guidance-heading">{guide.levelGuidanceHeading}</h2>
        <p>{guide.levelGuidanceIntro}</p>
        <ul>
          <li>{guide.levelGuidanceEveryHero}</li>
          <li>{guide.levelGuidanceUr}</li>
          <li>{guide.levelGuidanceSsr}</li>
          <li>{guide.levelGuidanceRsSr}</li>
        </ul>
        <p>{guide.levelGuidanceNote}</p>
      </section>
      <div className="ct-towers">
        {CRYPTID_TOWER_BUILDS.map((build) => {
          const text = guide.towerBuilds[build.id];
          const cryptide = CRYPTIDES.find((entry) => entry.id === build.cryptide);
          const cryptideName = cryptide ? localizedCryptideName(cryptide, cryptideTexts) : build.cryptide;
          return (
            <article className="ct-tower-card" id={`${build.id}-tower`} key={build.id}>
              <header className="ct-tower-head" data-tower={build.id}>
                <div>
                  <p className="ct-kicker">{guide.towerLabel}</p>
                  <h2>{text.title}</h2>
                </div>
                {cryptide ? (
                  <Link className="ct-cryptide" href={`${guideHref("cryptides")}#${cryptide.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cryptideImageUrl(cryptide.image)} alt="" loading="lazy" decoding="async" />
                    <span>{cryptideName}</span>
                    <small>{guide.cryptidTurn.replace("{turn}", String(build.turn))}</small>
                  </Link>
                ) : null}
              </header>
              <div className="ct-tower-copy">
                {text.description.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </div>
              <div className="ct-recommendations">
                <section>
                  <h3>{guide.keyHeroesHeading}</h3>
                  <HeroPicks ids={build.key} guide={guide} positions={build.positions} heroTexts={heroTexts} collectionTexts={collectionTexts} />
                </section>
                <section>
                  <h3>{guide.importantHeroesHeading}</h3>
                  <HeroPicks ids={build.important} guide={guide} heroTexts={heroTexts} collectionTexts={collectionTexts} />
                  {text.importantNote ? <p className="ct-inline-note">{text.importantNote}</p> : null}
                </section>
              </div>
              <section className="ct-collections">
                <h3>{guide.collectionHeading}</h3>
                {text.collectionNote ? <p className="ct-inline-note">{text.collectionNote}</p> : null}
                <ol>
                  {build.collections.map((ids, index) => <CollectionSlot key={index} ids={ids} number={index + 1} guide={guide} texts={collectionTexts} />)}
                </ol>
                {text.collectionTips.map((tip, index) => <p className="ct-inline-note" key={index}>{tip}</p>)}
              </section>
            </article>
          );
        })}
      </div>
      <p className="hero-credit">{guide.sourceNote}</p>
    </div>
  );
}
