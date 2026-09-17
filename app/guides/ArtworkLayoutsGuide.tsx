"use client";

import { useId, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { guideHref, guideLayout } from "../../lib/content/guides";
import { ARTWORK_LAYOUT_DATA, setSkillRank } from "../../lib/content/artwork-layouts";
import { PAINTING_SETS, artworkImageUrl, localizedSet, type Painting, type PaintingSet, type PaintingTexts } from "../../lib/content/artwork";
import type { Dictionary } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["artworkLayouts"];

export function isArtworkLayoutsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "artworkLayouts";
}

function labelOf(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

/** Link straight to a set on the Artwork page. */
const setHref = (id: string) => `${guideHref("artwork")}#${encodeURIComponent(id)}`;

/** A few paintings with a picture, for the link card at the top. */
const COVER_PAINTINGS = PAINTING_SETS.flatMap((set) => set.paintings.filter((canvas) => canvas.image)).slice(0, 4);

function PaintingTile({ painting, rarity }: { painting: Painting; rarity: string }) {
  return (
    <span className="al-canvas" data-rarity={rarity} title={painting.name}>
      {/* In-game crops, already small WebP files; a static export cannot optimise them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artworkImageUrl(painting.image ?? "")} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

/** A set nobody has added pictures for yet keeps the strip, as an empty frame. */
function EmptyFrame({ rarity }: { rarity: string }) {
  return (
    <span className="al-canvas is-empty" data-rarity={rarity} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="m6 16 4-5 3 3 2-2 3 4" />
        <circle cx="9" cy="8.5" r="1.3" />
      </svg>
    </span>
  );
}

function SetCard({ set, rank, reason, guide }: { set: PaintingSet; rank: number; reason: string; guide: Guide }) {
  // Only paintings that already have a picture; the names below cover the rest.
  const withPictures = set.paintings.filter((canvas) => canvas.image);
  return (
    <article className="al-set" data-rarity={set.rarity}>
      <div className="al-set-art" data-count={withPictures.length} aria-hidden="true">
        {withPictures.length > 0
          ? withPictures.map((canvas) => <PaintingTile key={canvas.id} painting={canvas} rarity={set.rarity} />)
          : <EmptyFrame rarity={set.rarity} />}
      </div>
      <div className="al-set-body">
        <header className="al-set-head">
          <span className="al-rank" aria-hidden="true">{rank}</span>
          <div>
            <h3>{set.name}</h3>
            <p className="al-reason">{reason}</p>
          </div>
          <span className="rarity" data-rarity={set.rarity}>{set.rarity}</span>
        </header>
        <p className="al-effect">{set.effect}</p>
        <ul className="al-canvas-names">
          {set.paintings.map((canvas) => <li key={canvas.id}>{canvas.name}</li>)}
        </ul>
        <Link className="al-set-link" href={setHref(set.id)}>{guide.openSet} →</Link>
      </div>
    </article>
  );
}

function SetSkillTabs({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const artworkTexts = t.guideEntries.artwork.catalogTexts as PaintingTexts;
  const base = useId();
  const builds = ARTWORK_LAYOUT_DATA.builds;
  const [buildId, setBuildId] = useState(builds[0]?.id ?? "");
  const build = builds.find((entry) => entry.id === buildId) ?? builds[0];
  const rows = build ? setSkillRank(build.id) : [];
  const tabId = (id: string) => `${base}-tab-${id}`;
  const names = guide.buildNames as Record<string, string>;
  const notes = guide.notes as Record<string, string>;
  const reasons = guide.reasons as Record<string, string>;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = builds.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setBuildId(builds[next].id);
    document.getElementById(tabId(builds[next].id))?.focus();
  };

  const note = build?.note ? notes[build.note] : "";

  return (
    <>
      <div className="build-tabs" role="tablist" aria-label={guide.setSkillsHeading}>
        {builds.map((tab, index) => {
          const selected = tab.id === build?.id;
          return (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              className="build-tab"
              data-build={tab.id}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setBuildId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="build-dot" aria-hidden="true" />
              {labelOf(names, tab.id)}
            </button>
          );
        })}
      </div>
      <div
        className="build-panel al-panel"
        data-build={build?.id}
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={build ? tabId(build.id) : undefined}
      >
        <ol className="al-sets">
          {rows.map((row, index) => (
            <li key={`${row.set.id}-${index}`}>
              <SetCard
                set={localizedSet(row.set, artworkTexts)}
                rank={index + 1}
                reason={labelOf(reasons, row.reason)}
                guide={guide}
              />
              {row.insert ? <p className="al-insert">{guide.hybridSlot}</p> : null}
            </li>
          ))}
        </ol>
        {note ? <p className="callout al-note">{note}</p> : null}
      </div>
    </>
  );
}

export function ArtworkLayoutsGuide({ guide }: { guide: Guide }) {
  return (
    <div className="guide-wide artwork-layouts">
      <p className="intro">{guide.intro}</p>

      <Link className="guide-link-card" href={guideHref("artwork")}>
        <span className="guide-link-card-art" aria-hidden="true">
          {COVER_PAINTINGS.map((canvas) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={canvas.id} src={artworkImageUrl(canvas.image ?? "")} alt="" loading="lazy" decoding="async" />
          ))}
        </span>
        <span className="guide-link-card-text">
          <span>{guide.catalogueLede}</span>
          <strong>{guide.catalogueLink} →</strong>
        </span>
      </Link>

      <h2>{guide.spendHeading}</h2>
      <ol className="al-steps">
        {guide.steps.map((step, index) => (
          <li className="al-step" key={step.title} data-step={index + 1}>
            <span className="al-step-number" aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2>{guide.levelsHeading}</h2>
      {guide.levelsLede ? <p className="guide-lede">{guide.levelsLede}</p> : null}
      <ol className="al-levels">
        {guide.levels.map((row) => (
          <li className="al-level" key={`${row.rarity}-${row.stat}`} data-rarity={row.rarity}>
            <span className="al-level-rank" aria-hidden="true">{row.rank}</span>
            <span className="rarity" data-rarity={row.rarity}>{row.rarity}</span>
            <strong className="al-level-stat">{row.stat}</strong>
          </li>
        ))}
      </ol>

      <h2>{guide.setSkillsHeading}</h2>
      <p className="guide-lede">{guide.setSkillsLede}</p>
      <SetSkillTabs guide={guide} />
    </div>
  );
}
