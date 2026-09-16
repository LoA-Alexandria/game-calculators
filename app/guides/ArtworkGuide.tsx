"use client";

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { guideLayout } from "../../lib/content/guides";
import {
  PAINTING_RARITIES,
  PAINTING_SETS,
  artworkImageUrl,
  localizedPainting,
  localizedSet,
  originalTitle,
  searchCatalogue,
  setsByRarity,
  type Painting,
  type PaintingHit,
  type PaintingRarity,
  type PaintingSet,
  type PaintingStat,
  type PaintingTexts,
} from "../../lib/content/artwork";
import { CheckIcon, CloseIcon, PenIcon } from "../components/Icons";
import { LOCALE_CODES, fill, getDictionary, localeMeta, type Dictionary } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { HeroAvatar } from "../components/HeroAvatar";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["artwork"];

export function isArtworkGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "artwork";
}

function dash(value: string): string {
  return value.trim() ? value : "—";
}

function StatChips({
  stats,
  labels,
}: {
  stats: readonly PaintingStat[];
  labels: Guide["stats"];
}) {
  if (stats.length === 0) return <span>—</span>;
  return (
    <ul className="pick-list">
      {stats.map((stat, index) => (
        <li className="pick pick-stat" key={`${stat}-${index}`}>
          <span className="pick-name">{labels[stat]}</span>
        </li>
      ))}
    </ul>
  );
}

function HeroPicks({ heroes }: { heroes: readonly string[] }) {
  return (
    <ul className="pick-list">
      {heroes.map((name) => (
        <li className="pick" key={name}>
          <HeroAvatar name={name} />
          <span className="pick-name">{name}</span>
        </li>
      ))}
    </ul>
  );
}

/** Every language's catalogue, so the search and the detail list reach all of them. */
const CATALOGS = LOCALE_CODES.map((code) => ({ code, texts: getDictionary(code).guideEntries.artwork.catalogTexts as PaintingTexts }));

type OpenPainting = (setId: string, paintingId: string) => void;

/** A picture frame: the slot a painting's picture goes into. */
function FrameIcon() {
  return (
    <svg className="painting-art-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="5" y="7" width="38" height="34" rx="3" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <rect x="11" y="13" width="26" height="22" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M13 32l7-7 5 5 4-4 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function yearText(painting: Painting, guide: Guide): string {
  if (!painting.year) return "";
  return painting.circa ? fill(guide.circa, { year: painting.year }) : painting.year;
}

/** "Based on Café Terrace at Night · Vincent van Gogh, 1888", or only the artist when the game keeps the title. */
function OriginalLine({ painting, guide }: { painting: Painting; guide: Guide }) {
  const credit = [painting.artist ?? "", yearText(painting, guide)].filter(Boolean).join(", ");
  const renamed = Boolean(painting.original && painting.original !== painting.name);
  if (!renamed && !credit) return null;
  return (
    <p className="painting-original">
      {renamed ? (
        <>
          <span className="painting-original-label">{guide.originalLabel}</span> <cite>{painting.original}</cite>
          {credit ? <span className="painting-original-credit"> · {credit}</span> : null}
        </>
      ) : (
        <span className="painting-original-credit">{credit}</span>
      )}
    </p>
  );
}

function PaintingArt({
  painting,
  rarity,
  guide,
  onOpen,
}: {
  painting: Painting;
  rarity: PaintingRarity;
  guide: Guide;
  onOpen: () => void;
}) {
  if (!painting.image) {
    return (
      <div className="painting-art is-empty" data-rarity={rarity}>
        <FrameIcon />
        <span>{guide.imagePending}</span>
      </div>
    );
  }
  return (
    <button type="button" className="painting-art" data-rarity={rarity} aria-haspopup="dialog" onClick={onOpen} aria-label={fill(guide.openPicture, { painting: painting.name })}>
      {/* Small WebP cut from the game; a static export cannot optimise images. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artworkImageUrl(painting.image)} alt="" loading="lazy" decoding="async" />
    </button>
  );
}

function PaintingBlock({
  painting,
  rarity,
  setId,
  guide,
  onOpen,
}: {
  painting: Painting;
  rarity: PaintingRarity;
  setId: string;
  guide: Guide;
  onOpen: OpenPainting;
}) {
  return (
    <article className="painting-block">
      <PaintingArt painting={painting} rarity={rarity} guide={guide} onOpen={() => onOpen(setId, painting.id)} />
      <h4>{painting.name}</h4>
      <OriginalLine painting={painting} guide={guide} />
      <HeroPicks heroes={painting.heroes} />
      <dl className="painting-facts">
        <div>
          <dt>{painting.starStats ? guide.colLevel : guide.colStats}</dt>
          <dd><StatChips stats={painting.stats} labels={guide.stats} /></dd>
        </div>
        {painting.starStats ? (
          <div>
            <dt>{guide.colStar}</dt>
            <dd><StatChips stats={painting.starStats} labels={guide.stats} /></dd>
          </div>
        ) : null}
        <div>
          <dt>{guide.colProduce}</dt>
          <dd>{dash(painting.productivity)}</dd>
        </div>
      </dl>
    </article>
  );
}

function SetCard({ entry, guide, onOpen }: { entry: PaintingSet; guide: Guide; onOpen: OpenPainting }) {
  return (
    <article className="utility-card painting-set" data-rarity={entry.rarity}>
      <header className="painting-set-head">
        <span className="rarity" data-rarity={entry.rarity}>{entry.rarity}</span>
        <h3>{entry.name}</h3>
      </header>
      <p className="painting-effect">{entry.effect}</p>
      <div className="painting-grid">
        {entry.paintings.map((canvas) => (
          <PaintingBlock key={canvas.id} painting={canvas} rarity={entry.rarity} setId={entry.id} guide={guide} onOpen={onOpen} />
        ))}
      </div>
    </article>
  );
}

function RarityTabs({ guide, onOpen }: { guide: Guide; onOpen: OpenPainting }) {
  const base = useId();
  const [rarity, setRarity] = useState<PaintingRarity>("SSR");
  const sets = setsByRarity(rarity).map((set) => localizedSet(set, guide.catalogTexts as PaintingTexts));

  const tabId = (id: PaintingRarity) => `${base}-tab-${id}`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = PAINTING_RARITIES.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setRarity(PAINTING_RARITIES[next]);
    document.getElementById(tabId(PAINTING_RARITIES[next]))?.focus();
  };

  return (
    <>
      <div className="build-tabs" role="tablist" aria-label={guide.setsHeading}>
        {PAINTING_RARITIES.map((tier, index) => {
          const selected = tier === rarity;
          return (
            <button
              key={tier}
              id={tabId(tier)}
              type="button"
              role="tab"
              className="build-tab"
              data-build={tier}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setRarity(tier)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="build-dot" aria-hidden="true" />
              {tier}
            </button>
          );
        })}
      </div>
      <div
        className="build-panel painting-panel"
        data-build={rarity}
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={tabId(rarity)}
      >
        <div className="painting-sets">
          {sets.map((entry) => (
            <SetCard key={entry.id} entry={entry} guide={guide} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </>
  );
}

function groupHits(hits: PaintingHit[]): { set: PaintingSet; paintings: Painting[] }[] {
  const order: string[] = [];
  const map = new Map<string, { set: PaintingSet; paintings: Painting[] }>();
  for (const hit of hits) {
    const existing = map.get(hit.set.id);
    if (!existing) {
      order.push(hit.set.id);
      map.set(hit.set.id, { set: hit.set, paintings: [hit.painting] });
      continue;
    }
    existing.paintings.push(hit.painting);
  }
  return order.map((id) => map.get(id)).filter((row): row is { set: PaintingSet; paintings: Painting[] } => Boolean(row));
}

/**
 * One painting large, with the real artwork's title in every language the
 * site has, so a reader can look the original up.
 */
function PaintingDialog({ setId, paintingId, guide, onClose }: { setId: string; paintingId: string; guide: Guide; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const attach = useCallback((node: HTMLDialogElement | null) => {
    dialog.current = node;
    if (node && !node.open) node.showModal();
  }, []);
  const set = PAINTING_SETS.find((entry) => entry.id === setId);
  const raw = set?.paintings.find((canvas) => canvas.id === paintingId);
  if (!set || !raw) return null;
  const texts = guide.catalogTexts as PaintingTexts;
  const painting = localizedPainting(raw, texts);
  const localSet = localizedSet(set, texts);
  const titles = CATALOGS.map(({ code, texts: catalog }) => ({ code, title: originalTitle(raw, catalog) }));
  // A work the game keeps the name of can still have its own title in other languages.
  const translatedTitle = CATALOGS.some(({ texts: catalog }) => Boolean(catalog.paintings?.[raw.id]?.original));
  const credit = [raw.artist ?? "", yearText(raw, guide)].filter(Boolean).join(", ");

  return (
    <dialog ref={attach} className="painting-detail" data-rarity={set.rarity} aria-labelledby={`${id}-name`} onClose={onClose}>
      <button type="button" className="icon-button painting-detail-close" aria-label={guide.detailClose} onClick={() => dialog.current?.close()}>
        <CloseIcon className="icon icon-sm" />
      </button>
      <div className="painting-detail-art" data-rarity={set.rarity}>
        {raw.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artworkImageUrl(raw.image)} alt={painting.name} decoding="async" />
        ) : null}
      </div>
      <div className="painting-detail-body">
        <p className="painting-detail-set">
          <span className="rarity" data-rarity={set.rarity}>{set.rarity}</span>
          {localSet.name}
        </p>
        <h2 id={`${id}-name`}>{painting.name}</h2>
        {raw.original || translatedTitle || credit ? (
          <>
            <h3>{guide.detailOriginal}</h3>
            {credit ? <p className="painting-detail-credit">{credit}</p> : null}
            {raw.original || translatedTitle ? (
              <dl className="painting-detail-titles">
                {titles.map(({ code, title }) => (
                  <div key={code}>
                    <dt>{localeMeta(code).label}</dt>
                    <dd lang={localeMeta(code).htmlLang}><cite>{title}</cite></dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </>
        ) : null}
        {painting.heroes.length ? (
          <>
            <h3>{guide.detailHeroes}</h3>
            <HeroPicks heroes={painting.heroes} />
          </>
        ) : null}
      </div>
    </dialog>
  );
}

export function ArtworkGuide({ guide }: { guide: Guide }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<{ setId: string; paintingId: string } | null>(null);
  const onOpen = useCallback<OpenPainting>((setId, paintingId) => setOpen({ setId, paintingId }), []);
  const hits = useMemo(() => searchCatalogue(query, CATALOGS.map((entry) => entry.texts)), [query]);
  const grouped = useMemo(() => {
    const texts = guide.catalogTexts as PaintingTexts;
    return groupHits(hits).map((row) => ({ set: localizedSet(row.set, texts), paintings: row.paintings.map((canvas) => localizedPainting(canvas, texts)) }));
  }, [hits, guide.catalogTexts]);
  const { t } = useLocale();
  const { allows } = useAuth();

  return (
    <div className="guide-wide hero-layouts artwork-layouts">
      <p className="intro">{guide.intro}</p>
      <p className="guide-credit">
        <span>{guide.credit}</span>
        <span>{guide.creditDate}</span>
        {guide.status ? <span className="build-status">{guide.status}</span> : null}
      </p>

      <h2>{guide.notesHeading}</h2>
      <div className="formation-rules">
        {guide.glossary.map((item, index) => (
          <article className="formation-rule" key={item.abbr}>
            <span className="formation-rule-index" aria-hidden="true">{index + 1}</span>
            <h3>{item.abbr}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
      <ul className="tip-list">
        {guide.tips.map((tip) => (
          <li key={tip}>
            <CheckIcon className="icon icon-sm" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
      <p className="callout">
        <Link href="/guides/artwork-layouts/">{guide.layoutsLink}</Link>
      </p>

      <div className="tier-lists-head">
        <h2>{query.trim() ? guide.filterHeading : guide.setsHeading}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/artwork/edit/">
            <PenIcon className="icon icon-sm" />
            {t.artworkEditor.openEditor}
          </Link>
        ) : null}
      </div>
      {query.trim() ? null : guide.setsLede ? <p className="utility-lede">{guide.setsLede}</p> : null}
      <label className="hero-search artwork-filter">
        <span className="visually-hidden">{guide.filterLabel}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={guide.filterPlaceholder}
        />
      </label>
      {query.trim() ? (
        grouped.length === 0 ? (
          <p className="empty-state">{guide.empty}</p>
        ) : (
          <>
            <p className="hero-count">{fill(guide.countLabel, { count: hits.length })}</p>
            <div className="painting-sets">
              {grouped.map((row) => (
                <article className="utility-card painting-set" data-rarity={row.set.rarity} key={row.set.id}>
                  <header className="painting-set-head">
                    <span className="rarity" data-rarity={row.set.rarity}>{row.set.rarity}</span>
                    <h3>{row.set.name}</h3>
                  </header>
                  <p className="painting-effect">{row.set.effect}</p>
                  <div className="painting-grid">
                    {row.paintings.map((canvas) => (
                      <PaintingBlock key={canvas.id} painting={canvas} rarity={row.set.rarity} setId={row.set.id} guide={guide} onOpen={onOpen} />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          <p className="utility-lede">{guide.filterLede}</p>
          <RarityTabs guide={guide} onOpen={onOpen} />
        </>
      )}
      <p className="hero-credit">{guide.pictureCredit}</p>
      {open ? <PaintingDialog setId={open.setId} paintingId={open.paintingId} guide={guide} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
