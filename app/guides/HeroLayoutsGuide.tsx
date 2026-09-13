"use client";

import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { Dictionary } from "../../lib/i18n";
import {
  COLLECTION_ITEMS,
  FORMATION_COLUMNS,
  FORMATION_ORDER,
  pickName,
  pickNote,
  slotWeight,
  type LayoutPick,
} from "../../lib/content/hero-layouts";
import { useLocale } from "../components/LocaleProvider";
import { CheckIcon, CloseIcon } from "../components/Icons";

type Guide = Dictionary["guideEntries"]["heroLayouts"];

/*
 * The dictionary infers a union per array (a build with no "other" heroes is
 * `never[]`); these shapes are what the page actually relies on, and assigning
 * the dictionary to them is the type check.
 */
type PickGroup = { label: string; picks: readonly LayoutPick[] };
type Build = {
  id: string;
  name: string;
  status: string;
  tagline: string;
  key: readonly LayoutPick[];
  important: readonly LayoutPick[];
  other: readonly LayoutPick[];
  collection: readonly LayoutPick[];
  counters: readonly PickGroup[];
  pros: readonly string[];
  cons: readonly string[];
  notes: readonly string[];
};
type UtilityRole = { role: string; groups: readonly PickGroup[] };

export function isHeroLayoutsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return "builds" in guide && Array.isArray((guide as { builds?: unknown }).builds);
}

function initial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

function Pick({ pick, guide }: { pick: LayoutPick; guide: Guide }) {
  const name = pickName(pick);
  const note = pickNote(pick);
  const item = COLLECTION_ITEMS.has(name);
  return (
    <li className={item ? "pick pick-item" : "pick"}>
      <span className="pick-avatar" aria-hidden="true">{item ? "◆" : initial(name)}</span>
      <span className="pick-name">{name}</span>
      {note ? <small className="pick-note">{note}</small> : null}
      {item ? <span className="visually-hidden"> ({guide.legendCollection})</span> : null}
    </li>
  );
}

function PickList({ picks, guide }: { picks: readonly LayoutPick[]; guide: Guide }) {
  return (
    <ul className="pick-list">
      {picks.map((pick) => (
        <Pick key={`${pickName(pick)}-${pickNote(pick)}`} pick={pick} guide={guide} />
      ))}
    </ul>
  );
}

function FormationBoard({ guide }: { guide: Guide }) {
  const { tf } = useLocale();
  const columnLabel = { back: guide.columnBack, middle: guide.columnMiddle, front: guide.columnFront };
  return (
    <figure className="formation-board">
      <div className="formation-columns">
        {FORMATION_ORDER.map((column) => (
          <div className={`formation-column formation-${column}`} key={column}>
            <p className="formation-column-label">{columnLabel[column]}</p>
            <ol className="formation-slots">
              {FORMATION_COLUMNS[column].map((slot, row) =>
                slot === 0 ? (
                  <li className="formation-slot is-empty" aria-hidden="true" key={`empty-${row}`} />
                ) : (
                  <li
                    className="formation-slot"
                    key={slot}
                    style={{ "--w": slotWeight(slot) } as CSSProperties}
                    aria-label={tf(guide.slotLabel, { slot })}
                  >
                    {slot}
                  </li>
                ),
              )}
            </ol>
          </div>
        ))}
      </div>
      {/* The frontline is on the right, so the legend runs first-to-last left to right. */}
      <div className="formation-legend" aria-hidden="true">
        <span>{guide.legendFirst}</span>
        <span>{guide.legendLast}</span>
      </div>
      <figcaption>{guide.boardCaption}</figcaption>
    </figure>
  );
}

function BuildTabs({ guide }: { guide: Guide }) {
  const builds: readonly Build[] = guide.builds;
  const base = useId();
  const [activeId, setActiveId] = useState(builds[0]?.id ?? "");
  const active = builds.find((build) => build.id === activeId) ?? builds[0];
  if (!active) return null;

  const tabId = (id: string) => `${base}-tab-${id}`;

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
    setActiveId(builds[next].id);
    document.getElementById(tabId(builds[next].id))?.focus();
  };

  const tiers = [
    { id: "key", label: guide.labelKey, picks: active.key },
    { id: "important", label: guide.labelImportant, picks: active.important },
    { id: "other", label: guide.labelOther, picks: active.other },
    { id: "collection", label: guide.labelCollection, picks: active.collection },
  ].filter((tier) => tier.picks.length > 0);

  return (
    <>
      <div className="build-tabs" role="tablist" aria-label={guide.buildsHeading}>
        {builds.map((build, index) => {
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
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(build.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="build-dot" aria-hidden="true" />
              {build.name}
            </button>
          );
        })}
      </div>

      <div
        className="build-panel"
        data-build={active.id}
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={tabId(active.id)}
      >
        <header className="build-head">
          <div className="build-title">
            <h3>{active.name}</h3>
            {active.status ? <span className="build-status">{active.status}</span> : null}
          </div>
          <p>{active.tagline}</p>
        </header>

        <div className="build-body">
          <div className="build-tiers">
            {tiers.map((tier) => (
              <div className="build-tier" data-tier={tier.id} key={tier.id}>
                <h4>{tier.label}</h4>
                <PickList picks={tier.picks} guide={guide} />
              </div>
            ))}
          </div>

          <aside className="build-counters">
            <h4>{guide.labelCounters}</h4>
            <ul>
              {active.counters.map((counter) => (
                <li key={counter.label}>
                  <span className="counter-label">{counter.label}</span>
                  {counter.picks.length > 0 ? <PickList picks={counter.picks} guide={guide} /> : null}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <div className="procon-grid">
          <div className="procon procon-pros">
            <h4><CheckIcon className="icon icon-sm" />{guide.labelPros}</h4>
            <ul>
              {active.pros.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          <div className="procon procon-cons">
            <h4><CloseIcon className="icon icon-sm" />{guide.labelCons}</h4>
            <ul>
              {active.cons.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </div>

        {active.notes.length > 0 ? (
          <div className="build-notes">
            {active.notes.map((line) => <p key={line}>{line}</p>)}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function HeroLayoutsGuide({ guide }: { guide: Guide }) {
  const utility: readonly UtilityRole[] = guide.utility;
  return (
    <div className="guide-wide hero-layouts">
      <p className="intro">{guide.intro}</p>
      <p className="guide-credit">
        <span>{guide.credit}</span>
        <span>{guide.creditDate}</span>
      </p>

      <div className="formation-intro">
        <div>
          <h2>{guide.boardHeading}</h2>
          <FormationBoard guide={guide} />
        </div>
        <div>
          <h2>{guide.rulesHeading}</h2>
          <div className="rule-grid">
            {guide.sections.map((section, index) => (
              <article className="rule-card" key={section.heading}>
                <span className="rule-index" aria-hidden="true">{index + 1}</span>
                <h3>{section.heading}</h3>
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </article>
            ))}
          </div>
        </div>
      </div>

      <h2>{guide.tipsHeading}</h2>
      <ul className="tip-list">
        {guide.tips.map((tip) => (
          <li key={tip}>
            <CheckIcon className="icon icon-sm" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
      {guide.note ? <p className="callout">{guide.note}</p> : null}

      <h2>{guide.buildsHeading}</h2>
      <div className="build-lede">
        <p>{guide.buildsLede}</p>
        <ul className="pick-list pick-legend" aria-hidden="true">
          <li className="pick"><span className="pick-avatar">A</span><span className="pick-name">{guide.legendHero}</span></li>
          <li className="pick pick-item"><span className="pick-avatar">◆</span><span className="pick-name">{guide.legendCollection}</span></li>
        </ul>
      </div>
      <BuildTabs guide={guide} />

      <h2>{guide.utilityHeading}</h2>
      <p className="utility-lede">{guide.utilityLede}</p>
      <div className="utility-grid">
        {utility.map((role) => (
          <article className="utility-card" key={role.role}>
            <h3>{role.role}</h3>
            {role.groups.map((group) => (
              <div className="utility-group" key={group.label || role.role}>
                {group.label ? <h4>{group.label}</h4> : null}
                <PickList picks={group.picks} guide={guide} />
              </div>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}
