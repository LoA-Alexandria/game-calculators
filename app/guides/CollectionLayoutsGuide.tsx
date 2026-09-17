"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  COLLECTION_AGES,
  COLLECTION_LAYOUTS_DATA,
  layoutItem,
  localizedOptionNote,
  localizedSetup,
  optionForItem,
  optionsForAge,
  type CollectionLayoutTag,
  type CollectionOption,
  type CollectionSetup,
} from "../../lib/content/collection-layouts";
import { guideHref, guideLayout } from "../../lib/content/guides";
import { fill, type Dictionary } from "../../lib/i18n";
import type { CollectionTexts } from "../../lib/content/collection";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["collectionLayouts"];

export function isCollectionLayoutsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "collectionLayouts";
}

/** How many published setups equip a collection. */
const SETUP_USES = new Map<string, number>();
for (const setup of COLLECTION_LAYOUTS_DATA.setups) {
  for (const age of COLLECTION_AGES) {
    const id = setup.slots[age];
    if (id) SETUP_USES.set(id, (SETUP_USES.get(id) ?? 0) + 1);
  }
}

/** Tags any option carries, in the order the registry lists them. */
const OPTION_TAGS = [...new Set(COLLECTION_LAYOUTS_DATA.options.flatMap((option) => option.tags))];

function fold(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function Tags({ tags, guide }: { tags: readonly CollectionLayoutTag[]; guide: Guide }) {
  if (tags.length === 0) return null;
  return (
    <span className="cl-tags">
      {tags.map((tag) => <span className="cl-tag" data-tag={tag} key={tag}>{guide.tags[tag]}</span>)}
    </span>
  );
}

function ItemArt({ image, name, pending, label }: { image: string | null; name: string; pending: boolean; label: string }) {
  if (image) {
    // Pictures come from the Collection guide; a static export cannot optimise images.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" loading="lazy" decoding="async" />;
  }
  return (
    <span className="cl-pending" title={pending ? label : undefined}>
      <span aria-hidden="true">{name.slice(0, 1)}</span>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

function SetupCard({ setup, guide, names }: { setup: CollectionSetup; guide: Guide; names: CollectionTexts }) {
  const text = localizedSetup(setup, guide.setupTexts);
  return (
    <article className="cl-setup" id={setup.id}>
      <header className="cl-setup-head">
        <div>
          <h3>{text.title}</h3>
          <p className="cl-credit">{setup.credit}</p>
        </div>
        <Tags tags={setup.tags} guide={guide} />
      </header>
      {text.lede ? <p className="cl-lede">{text.lede}</p> : null}
      <ol className="cl-slots">
        {COLLECTION_AGES.map((age) => {
          const slot = setup.slots[age];
          // The option row carries the English name for a collection the Collection guide does not have yet.
          const item = layoutItem(slot, optionForItem(slot)?.name ?? slot, names);
          return (
            <li className="cl-slot" key={age} data-age={age}>
              <span className="cl-slot-age">{guide.ages[age]}</span>
              <span className={item.image ? "cl-slot-art" : "cl-slot-art is-pending"}>
                <ItemArt image={item.image} name={item.name} pending={!item.known} label={guide.pendingLabel} />
              </span>
              <span className="cl-slot-name">{item.name}</span>
            </li>
          );
        })}
      </ol>
      {text.notes.length > 0 ? (
        <ul className="cl-notes">
          {text.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      ) : null}
    </article>
  );
}

function OptionCard({ option, guide, names }: { option: CollectionOption; guide: Guide; names: CollectionTexts }) {
  const item = layoutItem(option.item, option.name, names);
  const uses = SETUP_USES.get(option.item) ?? 0;
  return (
    <article className="cl-card" id={`option-${option.item}`}>
      <div className={item.image ? "cl-card-art" : "cl-card-art is-pending"}>
        <ItemArt image={item.image} name={item.name} pending={!item.known} label={guide.pendingLabel} />
      </div>
      <div className="cl-card-body">
        <header className="cl-card-head">
          {item.known ? (
            <h4><Link href={`${guideHref("collection")}#${option.item}`}>{item.name}</Link></h4>
          ) : (
            <h4>{item.name}</h4>
          )}
          {uses > 0 ? (
            <span className="cl-uses">{uses === 1 ? guide.usedInOne : fill(guide.usedIn, { count: uses })}</span>
          ) : null}
        </header>
        <Tags tags={option.tags} guide={guide} />
        <p>{localizedOptionNote(option, guide.optionTexts)}</p>
      </div>
    </article>
  );
}

export function CollectionLayoutsGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  // Pictures and names come from the Collection guide, in the reader's language.
  const names = t.guideEntries.collection.collectionTexts as CollectionTexts;
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<CollectionLayoutTag | null>(null);
  const needle = fold(query.trim());

  const ages = useMemo(
    () =>
      COLLECTION_AGES.map((age) => ({
        age,
        options: optionsForAge(age).filter((option) => {
          if (tag && !option.tags.includes(tag)) return false;
          if (!needle) return true;
          const item = layoutItem(option.item, option.name, names);
          const words = [item.name, option.name, localizedOptionNote(option, guide.optionTexts), ...option.tags.map((entry) => guide.tags[entry])];
          return fold(words.join(" ")).includes(needle);
        }),
      })).filter((entry) => entry.options.length > 0),
    [guide, names, needle, tag],
  );
  const shown = ages.reduce((sum, entry) => sum + entry.options.length, 0);
  const pending = COLLECTION_LAYOUTS_DATA.options.some((option) => !layoutItem(option.item, option.name, names).known);

  return (
    <div className="guide-wide collection-layouts">
      <p className="intro">{guide.intro}</p>

      <h2>{guide.setupsHeading}</h2>
      <p className="guide-lede">{guide.setupsLede}</p>
      <div className="cl-setups">
        {COLLECTION_LAYOUTS_DATA.setups.map((setup) => <SetupCard key={setup.id} setup={setup} guide={guide} names={names} />)}
      </div>
      {pending ? <p className="callout cl-pending-note">{guide.pendingNote}</p> : null}

      <h2>{guide.optionsHeading}</h2>
      <p className="guide-lede">{guide.optionsLede}</p>
      <div className="cl-toolbar">
        <label className="hero-search">
          <span className="visually-hidden">{guide.searchLabel}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={guide.searchPlaceholder} />
        </label>
        <div className="cl-filters" role="group" aria-label={guide.optionsHeading}>
          <button type="button" className="cl-filter" aria-pressed={tag === null} onClick={() => setTag(null)}>{guide.filterAll}</button>
          {OPTION_TAGS.map((entry) => (
            <button
              key={entry}
              type="button"
              className="cl-filter"
              data-tag={entry}
              aria-pressed={tag === entry}
              onClick={() => setTag(tag === entry ? null : entry)}
            >
              {guide.tags[entry]}
            </button>
          ))}
        </div>
      </div>
      <p className="hero-count" aria-live="polite">{fill(guide.countLabel, { count: shown })}</p>

      {ages.length === 0 ? (
        <p className="empty-state">{guide.empty}</p>
      ) : (
        <ol className="gl-phases cl-ages">
          {ages.map(({ age, options }) => (
            <li className="gl-phase" key={age} data-age={age} aria-labelledby={`age-${age}`}>
              <header className="gl-phase-head">
                <span className="gl-phase-number" aria-hidden="true">{COLLECTION_AGES.indexOf(age) + 1}</span>
                <div>
                  <p className="gl-phase-kicker">{fill(guide.countLabel, { count: options.length })}</p>
                  <h3 id={`age-${age}`}>{guide.ages[age]}</h3>
                </div>
              </header>
              <div className="cl-grid">
                {options.map((option) => <OptionCard key={option.item} option={option} guide={guide} names={names} />)}
              </div>
            </li>
          ))}
        </ol>
      )}

      <h2>{guide.buildsHeading}</h2>
      {guide.buildsBody.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      <div className="cl-shapes">
        <article className="cl-shape">
          <h3>{guide.deepTitle}</h3>
          <p>{guide.deepBody}</p>
        </article>
        <article className="cl-shape">
          <h3>{guide.wideTitle}</h3>
          <p>{guide.wideBody}</p>
        </article>
      </div>
      <p className="callout">{guide.buildsNote}</p>

      <h2>{guide.prioritiesHeading}</h2>
      <div className="cl-priorities">
        {[
          { title: guide.starsTitle, credit: guide.starsCredit, items: guide.starsItems },
          { title: guide.levelsTitle, credit: guide.levelsCredit, items: guide.levelsItems },
        ].map((column) => (
          <article className="cl-priority" key={column.title}>
            <header>
              <h3>{column.title}</h3>
              <p className="cl-credit">{column.credit}</p>
            </header>
            <ol>
              {column.items.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </article>
        ))}
      </div>

      <h2>{guide.adviceHeading}</h2>
      <ul className="cl-advice">
        {guide.advice.map((entry) => (
          <li key={entry.text}>
            <p className="cl-credit">{entry.credit}</p>
            <p>{entry.text}</p>
          </li>
        ))}
      </ul>

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
