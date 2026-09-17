"use client";

import { useMemo, useState } from "react";
import {
  COLLECTION_ITEMS,
  COLLECTION_RARITIES,
  collectionImageUrl,
  itemsByRarity,
  localizedItem,
  searchCollection,
  type CollectionItem,
  type CollectionRarity,
} from "../../lib/content/collection";
import { guideLayout } from "../../lib/content/guides";
import { fill, type Dictionary } from "../../lib/i18n";
import { counted } from "./HeroRoster";

type Guide = Dictionary["guideEntries"]["collection"];

export function isCollectionGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "collection";
}

/** Rarities that have at least one item, so an empty R filter does not show. */
const USED_RARITIES = COLLECTION_RARITIES.filter((rarity) => itemsByRarity(rarity).length > 0);

function ItemCard({ item, guide }: { item: CollectionItem; guide: Guide }) {
  const text = localizedItem(item, guide.collectionTexts);
  return (
    <article className="collection-card" data-rarity={item.rarity} id={item.id}>
      <div className="collection-card-art">
        {/* Small WebP cut-outs; a static export cannot optimise images. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={collectionImageUrl(item.image)} alt="" loading="lazy" decoding="async" />
      </div>
      <div className="collection-card-body">
        <header className="collection-card-head">
          <h3>{text.name}</h3>
          <span className="rarity" data-rarity={item.rarity}>{item.rarity}</span>
        </header>
        <div className="collection-skill">
          <div className="collection-skill-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="collection-skill-icon" src={collectionImageUrl(item.skill.icon)} alt={guide.skillIconLabel} loading="lazy" decoding="async" />
            <p className="collection-skill-name">
              <strong>{text.skillName}</strong>
              <span className="collection-skill-level">{fill(guide.skillLevel, { level: item.skill.level })}</span>
            </p>
          </div>
          <p className="collection-skill-effect">{text.skillText}</p>
        </div>
      </div>
    </article>
  );
}

export function CollectionGuide({ guide }: { guide: Guide }) {
  const [rarity, setRarity] = useState<CollectionRarity | "all">("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => searchCollection(query, rarity, guide.collectionTexts), [query, rarity, guide.collectionTexts]);
  const grouped = rarity === "all" && !query.trim();

  return (
    <div className="guide-wide collection-guide">
      <p className="intro">{guide.intro}</p>

      <h2>{guide.itemsHeading}</h2>
      <p className="guide-lede">{guide.itemsLede}</p>

      <div className="hero-toolbar">
        <div className="hero-filters" role="group" aria-label={guide.filterLabel}>
          <button type="button" className="hero-filter" aria-pressed={rarity === "all"} onClick={() => setRarity("all")}>
            {guide.filterAll}
            <span className="hero-filter-count">{COLLECTION_ITEMS.length}</span>
          </button>
          {USED_RARITIES.map((tier) => (
            <button key={tier} type="button" className="hero-filter" data-rarity={tier} aria-pressed={rarity === tier} onClick={() => setRarity(tier)}>
              {tier}
              <span className="hero-filter-count">{itemsByRarity(tier).length}</span>
            </button>
          ))}
        </div>
        <label className="hero-search">
          <span className="visually-hidden">{guide.searchLabel}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={guide.searchPlaceholder} />
        </label>
      </div>
      <p className="hero-count" aria-live="polite">{fill(guide.countLabel, { count: rows.length })}</p>

      {rows.length === 0 ? (
        <p className="empty-state">{guide.empty}</p>
      ) : grouped ? (
        USED_RARITIES.map((tier) => {
          const items = rows.filter((item) => item.rarity === tier);
          return (
            <section className="hero-group collection-group" data-rarity={tier} key={tier} aria-label={tier}>
              <h3 className="hero-group-head">
                <span className="rarity" data-rarity={tier}>{tier}</span>
                <small>{counted(items.length, guide.groupCountOne, guide.groupCount)}</small>
              </h3>
              <div className="collection-grid">
                {items.map((item) => <ItemCard key={item.id} item={item} guide={guide} />)}
              </div>
            </section>
          );
        })
      ) : (
        <div className="collection-grid">
          {rows.map((item) => <ItemCard key={item.id} item={item} guide={guide} />)}
        </div>
      )}

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
